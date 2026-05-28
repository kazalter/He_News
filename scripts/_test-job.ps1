Add-Type -ErrorAction SilentlyContinue -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class JobTest {
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern IntPtr CreateJobObject(IntPtr lpJobAttributes, string lpName);
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool SetInformationJobObject(IntPtr hJob, int infoClass, IntPtr lpInfo, uint cbInfo);
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool AssignProcessToJobObject(IntPtr hJob, IntPtr hProcess);
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool IsProcessInJob(IntPtr hProcess, IntPtr hJob, out bool result);

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

$job = [JobTest]::CreateJobObject([IntPtr]::Zero, $null)
Write-Host ("CreateJobObject -> 0x{0:X}" -f $job.ToInt64())

$info = New-Object JobTest+JOBOBJECT_EXTENDED_LIMIT_INFORMATION
$info.BasicLimitInformation.LimitFlags = [JobTest]::JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
$size = [System.Runtime.InteropServices.Marshal]::SizeOf($info)
$ptr = [System.Runtime.InteropServices.Marshal]::AllocHGlobal($size)
[System.Runtime.InteropServices.Marshal]::StructureToPtr($info, $ptr, $false)
$ok = [JobTest]::SetInformationJobObject($job, [JobTest]::JobObjectExtendedLimitInformation, $ptr, [uint32]$size)
[System.Runtime.InteropServices.Marshal]::FreeHGlobal($ptr)
Write-Host ("SetInformationJobObject -> {0}" -f $ok)

$self = [System.Diagnostics.Process]::GetCurrentProcess()
$ok = [JobTest]::AssignProcessToJobObject($job, $self.Handle)
$err = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
Write-Host ("AssignProcessToJobObject(self) -> ok={0}, Win32err={1}" -f $ok, $err)

# Verify
$inJob = $false
[JobTest]::IsProcessInJob($self.Handle, $job, [ref] $inJob) | Out-Null
Write-Host ("IsProcessInJob(self) -> {0}" -f $inJob)

# Spawn a child that will outlive us if not killed by the job
$child = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'ping -n 60 127.0.0.1 >nul' -PassThru -WindowStyle Hidden
Write-Host ("Spawned child cmd PID={0}" -f $child.Id)

Start-Sleep -Milliseconds 500
$childInJob = $false
$childProc = Get-Process -Id $child.Id -ErrorAction SilentlyContinue
if ($childProc) {
    [JobTest]::IsProcessInJob($childProc.Handle, $job, [ref] $childInJob) | Out-Null
    Write-Host ("IsProcessInJob(child) -> {0}" -f $childInJob)
}

# Write our PID + child PID to a file so the outer test script can check
"$($self.Id),$($child.Id)" | Out-File -FilePath "$PSScriptRoot/_test-job-pids.txt" -Encoding ascii
Write-Host 'Exiting PowerShell in 2 seconds...'
Start-Sleep -Seconds 2
exit 0
