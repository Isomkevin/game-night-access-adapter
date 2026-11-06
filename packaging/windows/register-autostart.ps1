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
    $pyw = Join-Path $InstallDir 'venv\Scripts\pythonw.exe'
    if (Test-Path -LiteralPath $pyw) {
        $link.TargetPath = $pyw
        $link.Arguments = '-m access_adapter'
    } else {
        $link.TargetPath = $launcher
        $link.Arguments = ''
    }
    $link.WorkingDirectory = $InstallDir
    $link.WindowStyle = 1
    $link.Description = 'Game Night Access Adapter'
    $link.Save()
}

$menu = Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\Game Night Access Adapter.lnk'
$startup = Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\StartUp\Game Night Access Adapter.lnk'
$desktop = Join-Path $env:PUBLIC 'Desktop\Game Night Access Adapter.lnk'
New-AdapterShortcut -ShortcutPath $menu
New-AdapterShortcut -ShortcutPath $startup
New-AdapterShortcut -ShortcutPath $desktop
Write-Host "Shortcuts:"
Write-Host "  $menu"
Write-Host "  $startup"
Write-Host "  $desktop"
