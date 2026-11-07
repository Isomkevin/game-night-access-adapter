# Remove shortcuts, the uninstall registry key, and the Program Files copy.
param(
    [string]$InstallRoot = ''
)

$ErrorActionPreference = 'Stop'

Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -and ($_.CommandLine -match 'access_adapter')
} | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}

$cleaner = Join-Path $PSScriptRoot 'remove-previous.ps1'
if ((Test-Path -LiteralPath $cleaner) -and (-not $InstallRoot)) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $cleaner
    exit 0
}

if (-not $InstallRoot) {
    $InstallRoot = $PSScriptRoot
}
$InstallRoot = (Resolve-Path -LiteralPath $InstallRoot).Path

$menu = Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\Game Night Access Adapter.lnk'
$startup = Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\StartUp\Game Night Access Adapter.lnk'
Remove-Item -LiteralPath $menu -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $startup -Force -ErrorAction SilentlyContinue

$key = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\GameNightAccessAdapter'
if (Test-Path -LiteralPath $key) {
    Remove-Item -LiteralPath $key -Recurse -Force
}

$ProgramFiles64 = if ($env:ProgramW6432) { $env:ProgramW6432 } else { $env:ProgramFiles }
$PermanentRoot = Join-Path $ProgramFiles64 'Game Night Access Adapter'
if ($InstallRoot.TrimEnd('\') -ieq $PermanentRoot.TrimEnd('\')) {
    # This script may be running from the folder it deletes. Delay the removal.
    Start-Process -FilePath 'cmd.exe' -WindowStyle Hidden -ArgumentList "/c ping 127.0.0.1 -n 3 >nul & rmdir /s /q `"$PermanentRoot`""
    Write-Host "Removing $PermanentRoot"
} else {
    Write-Host "Left files in $InstallRoot (not the Program Files copy)."
    Write-Host "Program Files copy: $PermanentRoot"
}

Write-Host "Game Night Access Adapter uninstalled."
Write-Host "Per-user settings remain in %APPDATA%\GameNightAccessAdapter"
