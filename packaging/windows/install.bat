@echo off
setlocal EnableExtensions
cd /d "%~dp0"

if not exist "%~dp0install.ps1" (
  echo.
  echo ERROR: install.ps1 was not found next to this file.
  echo.
  echo You are probably running install.bat from inside an archive preview.
  echo That only extracts this .bat - PowerShell cannot find install.ps1.
  echo.
  echo Fix:
  echo   1. Prefer game-night-access-adapter-*-setup.exe, OR
  echo   2. Extract the FULL zip to a folder, then right-click install.bat
  echo      and choose Run as administrator.
  echo.
  pause
  exit /b 1
)

net session >nul 2>&1
if %errorLevel% NEQ 0 (
  echo Requesting Administrator permission...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$p = Start-Process -FilePath '%~f0' -WorkingDirectory '%~dp0.' -Verb RunAs -Wait -PassThru; if ($p) { exit $p.ExitCode } else { exit 1 }"
  exit /b %ERRORLEVEL%
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
if errorlevel 1 (
  echo.
  echo INSTALLATION FAILED
  echo Log: %ProgramData%\GameNightAccessAdapter\install.log
  echo.
  pause
  exit /b 1
)

echo.
echo Game Night Access Adapter installed.
timeout /t 6 /nobreak >nul
exit /b 0
