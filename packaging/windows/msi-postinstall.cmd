@echo off
setlocal EnableExtensions
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0post-install.ps1" -InstallDir "%~dp0."
exit /b %ERRORLEVEL%
