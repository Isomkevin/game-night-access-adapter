@echo off
setlocal EnableExtensions
cd /d "%~dp0"

net session >nul 2>&1
if %errorLevel% NEQ 0 (
  echo Requesting Administrator permission...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -WorkingDirectory '%~dp0.' -Verb RunAs"
  exit /b %ERRORLEVEL%
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1"
echo.
pause
exit /b 0
