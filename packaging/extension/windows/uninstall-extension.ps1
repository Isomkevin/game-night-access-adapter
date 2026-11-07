# Remove the Game Night extension files installed by install-extension.ps1.
param([switch]$Quiet)

$Root = Join-Path $env:LOCALAPPDATA 'Game Night Access Adapter'
Remove-Item -LiteralPath (Join-Path $Root 'extension') -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\GameNightExtension' -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $Root 'uninstall-extension.ps1') -Force -ErrorAction SilentlyContinue

if (-not $Quiet) {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
        "Extension files removed. Also click Remove on Game Night Access Adapter in chrome://extensions.",
        'Game Night extension', 'OK', 'Information') | Out-Null
}
