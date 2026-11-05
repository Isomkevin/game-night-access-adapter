@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "PYTHONPATH=%~dp0"
set "PYW=%~dp0venv\Scripts\pythonw.exe"
set "PY=%~dp0venv\Scripts\python.exe"
if exist "%PYW%" (
  start "Game Night Access Adapter" "%PYW%" -m access_adapter
  exit /b 0
)
if exist "%PY%" (
  start "Game Night Access Adapter" "%PY%" -m access_adapter
  exit /b 0
)
echo.
echo Game Night Access Adapter could not start.
echo Expected: %PY%
echo Re-run setup.exe or install.bat as Administrator after installing Python 3 from python.org.
echo.
pause
exit /b 1
