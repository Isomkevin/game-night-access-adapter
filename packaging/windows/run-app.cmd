@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "PYTHONPATH=%~dp0"
set "PATH=%~dp0platform-tools;%PATH%"
set "PYW=%~dp0venv\Scripts\pythonw.exe"
set "PY=%~dp0venv\Scripts\python.exe"
if exist "%PYW%" (
  start "" /B "%PYW%" -m access_adapter
  exit /b 0
)
if exist "%PY%" (
  start "" /B "%PY%" -m access_adapter
  exit /b 0
)
echo.
echo Game Night Access Adapter could not start.
echo Expected: %PY%
echo Re-run setup.exe or install.bat as Administrator. Setup installs Python automatically when needed.
echo.
pause
exit /b 1
