# Install Game Night Access Adapter on Windows (portable zip or setup.exe).
param(
    [string]$InstallRoot = ''
)

$ErrorActionPreference = 'Stop'
if (-not $InstallRoot) {
    $InstallRoot = $PSScriptRoot
}
$InstallRoot = (Resolve-Path -LiteralPath $InstallRoot).Path

$remove = Join-Path $InstallRoot 'remove-previous.ps1'
if (Test-Path -LiteralPath $remove) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $remove
}

$post = Join-Path $InstallRoot 'post-install.ps1'
if (-not (Test-Path -LiteralPath $post)) {
    throw "Missing installer script: $post"
}

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $post -InstallDir $InstallRoot
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Game Night Access Adapter installed."
Write-Host "  The window should open now."
Write-Host "  If it does not, use the desktop shortcut or Start Menu: Game Night Access Adapter"
Write-Host "  Or run: C:\Program Files\Game Night Access Adapter\run-app.cmd"
Write-Host "  Local API: http://127.0.0.1:8765/api/v1/health"
Write-Host ""
