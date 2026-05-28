@echo off
setlocal

where pwsh >nul 2>nul
if errorlevel 1 (
  set "PS_EXE=powershell"
) else (
  set "PS_EXE=pwsh"
)

"%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-dev.ps1"
set "EXITCODE=%ERRORLEVEL%"
if not "%EXITCODE%"=="0" (
  echo.
  echo Launcher exited with code %EXITCODE%. Press any key to close this window.
  echo If you do nothing, this window will auto-close in 30 seconds.
  choice /T 30 /D Y /N >nul
)
exit /b %EXITCODE%
