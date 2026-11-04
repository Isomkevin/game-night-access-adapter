# Create the Start Menu and login shortcuts. The app runs in the signed-in
# user session so the keys it sends can reach the focused game.
param(
    [Parameter(Mandatory = $true)][string]$InstallDir
)

$ErrorActionPreference = 'Stop'
$shell = New-Object -ComObject WScript.Shell
$launcher = Join-Path $InstallDir 'run-app.cmd'

function New-AdapterShortcut {
    param([Parameter(Mandatory = $true)][string]$ShortcutPath)
    $parent = Split-Path -Parent $ShortcutPath
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
    $link = $shell.CreateShortcut($ShortcutPath)
    $link.TargetPath = $launcher
    $link.WorkingDirectory = $InstallDir
    $link.WindowStyle = 7
    $link.Description = 'Game Night Access Adapter'
    $link.Save()
}

$menu = Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\Game Night Access Adapter.lnk'
$startup = Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\StartUp\Game Night Access Adapter.lnk'
New-AdapterShortcut -ShortcutPath $menu
New-AdapterShortcut -ShortcutPath $startup
Write-Host "Shortcuts:"
Write-Host "  $menu"
Write-Host "  $startup"
