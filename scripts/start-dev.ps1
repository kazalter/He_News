param([switch]$Headless)

$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Root 'backend'
$Frontend = Join-Path $Root 'frontend'
$RuntimeDir = Join-Path $Root '.runtime'
$BackendOut = Join-Path $RuntimeDir 'backend.out.log'
$BackendErr = Join-Path $RuntimeDir 'backend.err.log'
$FrontendOut = Join-Path $RuntimeDir 'frontend.out.log'
$FrontendErr = Join-Path $RuntimeDir 'frontend.err.log'
$PidJournalPath = Join-Path $RuntimeDir 'launcher.pids'

$script:Stopping = $false
$script:LogPositions = @{}
$script:JobHandle = [IntPtr]::Zero
$script:JobInheritance = $false
$script:PidJournal = ''   # Path set after $RuntimeDir is defined.

function Save-SpawnedPid {
  param([int] $ProcessId)
  if (-not $script:PidJournal) { return }
  try {
    Add-Content -LiteralPath $script:PidJournal -Value $ProcessId -ErrorAction Stop
  } catch {
    Write-Step "Could not append PID $ProcessId to journal: $($_.Exception.Message)" 'DarkYellow'
  }
}

function Stop-ProcessTree {
  param(
    [int] $ProcessId,
    [string] $Label
  )

  if (-not $ProcessId) { return }
  $proc = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
  if (-not $proc) { return }

  # taskkill /F /T walks the process tree from $ProcessId downward and force-
  # terminates every descendant. This catches grandchildren that Stop-Process
  # (which targets a single PID) would miss.
  $tag = if ($Label) { " ($Label)" } else { '' }
  Write-Step "Killing process tree from PID ${ProcessId}${tag}..." 'DarkGray'
  & taskkill.exe /F /T /PID $ProcessId 2>$null | Out-Null
}

function Clear-PreviousLauncherSurvivors {
  if (-not $script:PidJournal -or -not (Test-Path -LiteralPath $script:PidJournal)) { return }

  $stale = @(Get-Content -LiteralPath $script:PidJournal -ErrorAction SilentlyContinue) |
    Where-Object { $_ -match '^\d+$' } |
    ForEach-Object { [int]$_ }

  if ($stale.Count -eq 0) {
    Remove-FileWithRetry -Path $script:PidJournal
    return
  }

  $killed = 0
  foreach ($id in $stale) {
    $proc = Get-CimInstance Win32_Process -Filter ("ProcessId={0}" -f $id) -ErrorAction SilentlyContinue
    if (-not $proc) { continue }
    # Only kill if its command line still looks like an HE_News launcher child
    # -- avoids accidentally nuking a recycled PID belonging to an unrelated
    # process.
    if ($proc.CommandLine -and ($proc.CommandLine -match 'HE_News' -or
                                $proc.CommandLine -match 'nest start --watch' -or
                                $proc.CommandLine -match '\bvite\b' -or
                                $proc.CommandLine -match 'npm-cli\.js')) {
      Stop-ProcessTree -ProcessId $id -Label 'previous run'
      $killed++
    }
  }
  if ($killed -gt 0) {
    Write-Step "Cleaned up $killed survivor(s) from a previous launcher session." 'Yellow'
  }
  Remove-FileWithRetry -Path $script:PidJournal
}

# Cleanup strategy combines three layers because no single mechanism on
# Windows is fully reliable across all exit paths:
#
#   1. Job Object with KILL_ON_JOB_CLOSE (best-effort) - works in some envs
#      but observed to *not* fire under Windows Terminal + nested jobs.
#   2. taskkill /F /T in the finally block - walks the process tree from each
#      spawned root (npm wrapper) downward through cmd shim and nest/vite.
#      Reliable for Ctrl+C / Q / one-service-exited paths.
#   3. PID journal file - PIDs of spawned roots are persisted to
#      .runtime\launcher.pids on spawn. The next launcher run reads it and
#      taskkill /T any survivors before starting fresh. Catches the
#      window-close ('X') path where finally never runs.
Add-Type -ErrorAction SilentlyContinue -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class HeNewsJobObject {
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern IntPtr CreateJobObject(IntPtr lpJobAttributes, string lpName);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool SetInformationJobObject(IntPtr hJob, int infoClass, IntPtr lpInfo, uint cbInfo);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool AssignProcessToJobObject(IntPtr hJob, IntPtr hProcess);

    [StructLayout(LayoutKind.Sequential)]
    public struct JOBOBJECT_BASIC_LIMIT_INFORMATION {
        public long PerProcessUserTimeLimit;
        public long PerJobUserTimeLimit;
        public uint LimitFlags;
        public IntPtr MinimumWorkingSetSize;
        public IntPtr MaximumWorkingSetSize;
        public uint ActiveProcessLimit;
        public IntPtr Affinity;
        public uint PriorityClass;
        public uint SchedulingClass;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct IO_COUNTERS {
        public ulong ReadOperationCount;
        public ulong WriteOperationCount;
        public ulong OtherOperationCount;
        public ulong ReadTransferCount;
        public ulong WriteTransferCount;
        public ulong OtherTransferCount;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION {
        public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
        public IO_COUNTERS IoInfo;
        public IntPtr ProcessMemoryLimit;
        public IntPtr JobMemoryLimit;
        public IntPtr PeakProcessMemoryUsed;
        public IntPtr PeakJobMemoryUsed;
    }

    public const int JobObjectExtendedLimitInformation = 9;
    public const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x2000;
}
'@

function New-KillOnExitJob {
  $job = [HeNewsJobObject]::CreateJobObject([IntPtr]::Zero, $null)
  if ($job -eq [IntPtr]::Zero) {
    Write-Step 'Could not create Job Object; child processes may survive window close.' 'DarkYellow'
    return [IntPtr]::Zero
  }

  $info = New-Object HeNewsJobObject+JOBOBJECT_EXTENDED_LIMIT_INFORMATION
  $info.BasicLimitInformation.LimitFlags = [HeNewsJobObject]::JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
  $size = [System.Runtime.InteropServices.Marshal]::SizeOf($info)
  $ptr = [System.Runtime.InteropServices.Marshal]::AllocHGlobal($size)
  try {
    [System.Runtime.InteropServices.Marshal]::StructureToPtr($info, $ptr, $false)
    $ok = [HeNewsJobObject]::SetInformationJobObject($job, [HeNewsJobObject]::JobObjectExtendedLimitInformation, $ptr, [uint32]$size)
    if (-not $ok) {
      Write-Step 'Could not set KILL_ON_JOB_CLOSE on Job Object.' 'DarkYellow'
    }
  } finally {
    [System.Runtime.InteropServices.Marshal]::FreeHGlobal($ptr)
  }
  return $job
}

function Add-ToJob {
  param([System.Diagnostics.Process] $Process)

  if ($script:JobHandle -eq [IntPtr]::Zero -or -not $Process) { return }
  try {
    $ok = [HeNewsJobObject]::AssignProcessToJobObject($script:JobHandle, $Process.Handle)
    if (-not $ok) {
      $err = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
      Write-Step "AssignProcessToJobObject failed for PID $($Process.Id) (Win32=$err)." 'DarkYellow'
    }
  } catch {
    Write-Step "AssignProcessToJobObject threw: $($_.Exception.Message)" 'DarkYellow'
  }
}

function Write-Step {
  param(
    [string] $Message,
    [ConsoleColor] $Color = 'Cyan'
  )

  Write-Host $Message -ForegroundColor $Color
}

function Get-NpmCommand {
  $Command = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if ($Command) {
    return $Command.Source
  }

  $Command = Get-Command npm -ErrorAction SilentlyContinue
  if ($Command) {
    return $Command.Source
  }

  throw 'npm was not found. Please install Node.js first.'
}

function Assert-Tooling {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js was not found. Please install Node.js first.'
  }

  [void](Get-NpmCommand)
}

function Stop-Port {
  param([int] $Port)

  $Connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  $ProcessIds = $Connections |
    Select-Object -ExpandProperty OwningProcess -Unique |
    Where-Object { $_ -and $_ -ne $PID }

  foreach ($ProcessId in $ProcessIds) {
    try {
      $Process = Get-Process -Id $ProcessId -ErrorAction Stop
      Write-Step "Cleaning port ${Port}: stopping $($Process.ProcessName) [$ProcessId]" 'Yellow'
      Stop-Process -Id $ProcessId -Force -ErrorAction Stop
      # Stop-Process returns immediately, but the OS releases the dead
      # process's file handles asynchronously. Wait so log files are safe
      # to overwrite in the next step.
      Wait-Process -Id $ProcessId -Timeout 5 -ErrorAction SilentlyContinue
    } catch {
      Write-Step "Cleaning port ${Port}: process $ProcessId already stopped" 'DarkYellow'
    }
  }
}

function Remove-FileWithRetry {
  param(
    [string] $Path,
    [int] $MaxAttempts = 10,
    [int] $DelayMs = 200
  )

  for ($Attempt = 1; $Attempt -le $MaxAttempts; $Attempt++) {
    try {
      Remove-Item -LiteralPath $Path -Force -ErrorAction Stop
      return
    } catch {
      if ($Attempt -eq $MaxAttempts) {
        Write-Step "Could not delete $Path after $MaxAttempts attempts; truncating instead." 'DarkYellow'
        try {
          Set-Content -LiteralPath $Path -Value '' -NoNewline -Encoding utf8 -ErrorAction Stop
        } catch {
          Write-Step "Truncate also failed ($($_.Exception.Message)); leaving file as-is." 'DarkYellow'
        }
        return
      }
      Start-Sleep -Milliseconds $DelayMs
    }
  }
}

function Clear-Runtime {
  New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null

  foreach ($Path in @($BackendOut, $BackendErr, $FrontendOut, $FrontendErr)) {
    if (Test-Path -LiteralPath $Path) {
      Remove-FileWithRetry -Path $Path
    }

    if (-not (Test-Path -LiteralPath $Path)) {
      New-Item -ItemType File -Force -Path $Path | Out-Null
    }
    $script:LogPositions[$Path] = 0
  }

  foreach ($OldLog in @(
      'backend-dev.log',
      'backend-dev.err.log',
      'frontend-dev.log',
      'frontend-dev.err.log'
    )) {
    $OldPath = Join-Path $Root $OldLog
    if (Test-Path -LiteralPath $OldPath) {
      Remove-Item -LiteralPath $OldPath -Force
    }
  }
}

function Ensure-Dependencies {
  param(
    [string] $ProjectDir,
    [string] $Name
  )

  if (Test-Path -LiteralPath (Join-Path $ProjectDir 'node_modules')) {
    return
  }

  Write-Step "Installing $Name dependencies..." 'Cyan'
  Push-Location -LiteralPath $ProjectDir
  try {
    & (Get-NpmCommand) install
  } finally {
    Pop-Location
  }
}

function Start-NpmProcess {
  param(
    [string] $Name,
    [string] $WorkingDirectory,
    [string[]] $Arguments,
    [string] $OutLog,
    [string] $ErrLog
  )

  Write-Step "Starting $Name..." 'Green'
  $proc = Start-Process `
    -FilePath (Get-NpmCommand) `
    -ArgumentList $Arguments `
    -WorkingDirectory $WorkingDirectory `
    -RedirectStandardOutput $OutLog `
    -RedirectStandardError $ErrLog `
    -WindowStyle Hidden `
    -PassThru

  # When PowerShell itself is already in the job (the common path), children
  # inherit membership automatically at CreateProcess time -- no race, all
  # descendants are captured. Only fall back to per-child assignment if the
  # self-assign at startup did not work.
  if (-not $script:JobInheritance) {
    Add-ToJob -Process $proc
  }
  # Persist the spawned root PID so a future launcher run can clean up any
  # survivors if this session ends without finally running (e.g. window-close).
  Save-SpawnedPid -ProcessId $proc.Id
  return $proc
}

function Read-NewLogLines {
  param(
    [string] $Path,
    [string] $Prefix,
    [ConsoleColor] $Color
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    return
  }

  $Stream = [System.IO.File]::Open($Path, 'Open', 'Read', 'ReadWrite')
  try {
    $Position = 0
    if ($script:LogPositions.ContainsKey($Path)) {
      $Position = $script:LogPositions[$Path]
    }

    [void] $Stream.Seek($Position, [System.IO.SeekOrigin]::Begin)
    $Reader = [System.IO.StreamReader]::new($Stream, [System.Text.Encoding]::UTF8, $true, 4096, $true)
    try {
      while (-not $Reader.EndOfStream) {
        $Line = $Reader.ReadLine()
        if (-not [string]::IsNullOrWhiteSpace($Line)) {
          Write-Host "$Prefix $Line" -ForegroundColor $Color
        }
      }

      $script:LogPositions[$Path] = $Stream.Position
    } finally {
      $Reader.Dispose()
    }
  } finally {
    $Stream.Dispose()
  }
}

function Wait-ForPort {
  # $Host is an automatic PowerShell variable; use $TargetHost to avoid
  # shadowing it in the function scope.
  param(
    [string] $TargetHost = '127.0.0.1',
    [int] $Port,
    [int] $TimeoutSeconds = 45
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $client = $null
    try {
      $client = New-Object System.Net.Sockets.TcpClient
      $task = $client.ConnectAsync($TargetHost, $Port)
      if ($task.Wait(500) -and $client.Connected) {
        return $true
      }
    } catch {
      # connection refused / timeout -- keep polling
    } finally {
      if ($client) { $client.Dispose() }
    }
    Start-Sleep -Milliseconds 300
  }
  return $false
}

function Stop-StartedProcess {
  param($Process)

  if ($Process -and -not $Process.HasExited) {
    try {
      Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
    } catch {
      # The port cleanup below handles already-detached child processes.
    }
  }
}

if (-not $Headless) { try { [System.Console]::Title = 'HE News Dev Server' } catch { } }

# Capture Ctrl+C through the same key-polling loop that already watches for 'Q'.
# Using [Console]::add_CancelKeyPress with a PS ScriptBlock crashes on newer
# .NET runtimes ("There is no Runspace available to run scripts in this
# thread") because the event fires on a thread that has no Runspace attached.
if (-not $Headless) {
  $script:OriginalTreatCtrlCAsInput = [System.Console]::TreatControlCAsInput
  [System.Console]::TreatControlCAsInput = $true
}

$BackendProcess = $null
$FrontendProcess = $null

try {
  if (-not $Headless) { Clear-Host }
  Write-Step 'HE News dev server launcher' 'Cyan'
  Write-Host ''

  Assert-Tooling

  # The pid journal lives in .runtime, which Clear-Runtime will create if
  # missing. We still need to check for survivors from a previous session
  # BEFORE clearing the runtime, so do this in two steps.
  $script:PidJournal = $PidJournalPath
  if (-not (Test-Path -LiteralPath $RuntimeDir)) {
    New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
  }
  Clear-PreviousLauncherSurvivors

  $script:JobHandle = New-KillOnExitJob

  # CRITICAL: assign THIS PowerShell process to the job first, BEFORE spawning
  # any children. Job membership inheritance only applies to processes created
  # AFTER their parent is in the job. If we wait until Start-Process returns
  # and then assign the child cmd shim, the cmd has already spawned npm/node
  # by that point and those grandchildren slip through the job and survive
  # PowerShell's exit.
  if ($script:JobHandle -ne [IntPtr]::Zero) {
    $self = [System.Diagnostics.Process]::GetCurrentProcess()
    try {
      $ok = [HeNewsJobObject]::AssignProcessToJobObject($script:JobHandle, $self.Handle)
      if ($ok) {
        $script:JobInheritance = $true
        Write-Step 'Process tree will be terminated when this window closes.' 'DarkGray'
      } else {
        $err = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
        Write-Step "Could not assign launcher to Job Object (Win32=$err). Falling back to per-child assignment." 'DarkYellow'
      }
    } catch {
      Write-Step "Self-assign to Job Object threw: $($_.Exception.Message)" 'DarkYellow'
    }
  }

  Write-Step 'Cleaning before start...' 'Cyan'
  Stop-Port 3000
  Stop-Port 5174
  Clear-Runtime

  Ensure-Dependencies -ProjectDir $Backend -Name 'backend'
  Ensure-Dependencies -ProjectDir $Frontend -Name 'frontend'

  $BackendProcess = Start-NpmProcess `
    -Name 'backend http://localhost:3000' `
    -WorkingDirectory $Backend `
    -Arguments @('run', 'start:dev') `
    -OutLog $BackendOut `
    -ErrLog $BackendErr

  $FrontendProcess = Start-NpmProcess `
    -Name 'frontend http://127.0.0.1:5174' `
    -WorkingDirectory $Frontend `
    -Arguments @('run', 'dev', '--', '--host', '127.0.0.1', '--port', '5174') `
    -OutLog $FrontendOut `
    -ErrLog $FrontendErr

  Write-Host ''
  Write-Step 'Frontend: http://127.0.0.1:5174/' 'Green'
  Write-Step 'Backend:  http://localhost:3000/' 'Green'
  Write-Host 'Logs are merged below. Press Q or Ctrl+C to stop both services.' -ForegroundColor DarkGray
  Write-Host ''

  # Backend cold-start (Prisma + Nest factory + module init) often takes
  # 5-10 seconds. Probe port 3000 until it accepts a TCP connection so the
  # browser does not load the SPA before the API is reachable -- otherwise
  # the initial bootstrap() requests get ECONNREFUSED through the Vite proxy.
  Write-Step 'Waiting for backend on port 3000...' 'Cyan'
  $backendReady = Wait-ForPort -Port 3000 -TimeoutSeconds 45
  if ($backendReady) {
    Write-Step 'Backend is reachable.' 'Green'
  } else {
    Write-Step 'Backend did not respond within 45s; opening browser anyway.' 'DarkYellow'
  }

  if (-not $Headless) { Start-Process 'http://127.0.0.1:5174/' }

  while (-not $script:Stopping) {
    Read-NewLogLines -Path $BackendOut -Prefix '[backend]' -Color 'Gray'
    Read-NewLogLines -Path $BackendErr -Prefix '[backend:error]' -Color 'Red'
    Read-NewLogLines -Path $FrontendOut -Prefix '[frontend]' -Color 'DarkCyan'
    Read-NewLogLines -Path $FrontendErr -Prefix '[frontend:error]' -Color 'Red'

    if (($BackendProcess -and $BackendProcess.HasExited) -or ($FrontendProcess -and $FrontendProcess.HasExited)) {
      Write-Step 'One service exited. Stopping the dev launcher.' 'Yellow'
      break
    }

    if (-not $Headless -and [Console]::KeyAvailable) {
      $Key = [Console]::ReadKey($true)
      $isCtrlC = ($Key.Key -eq 'C') -and (($Key.Modifiers -band [ConsoleModifiers]::Control) -ne 0)
      if ($Key.Key -eq 'Q' -or $isCtrlC) {
        $script:Stopping = $true
      }
    }

    Start-Sleep -Milliseconds 500
  }
} finally {
  Write-Host ''
  Write-Step 'Stopping services...' 'Yellow'
  if ($BackendProcess) { Stop-ProcessTree -ProcessId $BackendProcess.Id -Label 'backend tree' }
  if ($FrontendProcess) { Stop-ProcessTree -ProcessId $FrontendProcess.Id -Label 'frontend tree' }
  Stop-Port 3000
  Stop-Port 5174
  # Cleanup finished -- the journal is no longer needed.
  if ($script:PidJournal -and (Test-Path -LiteralPath $script:PidJournal)) {
    Remove-FileWithRetry -Path $script:PidJournal
  }
  if ($null -ne $script:OriginalTreatCtrlCAsInput) {
    [System.Console]::TreatControlCAsInput = $script:OriginalTreatCtrlCAsInput
  }
  Write-Step 'Done.' 'Green'
}
