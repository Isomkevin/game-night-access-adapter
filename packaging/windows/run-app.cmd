@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "PYTHONPATH=%~dp0"
if exist "%~dp0venv\Scripts\pythonw.exe" (
  start "" "%~dp0venv\Scripts\pythonw.exe" -m access_adapter
  exit /b 0
)
echo Python virtual environment is missing. Re-run install.bat as Administrator.
exit /b 1
