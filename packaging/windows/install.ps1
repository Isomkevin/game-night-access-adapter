# Install Game Night Access Adapter on Windows (portable zip or setup.exe).
param(
    [string]$InstallRoot = ''
)

$ErrorActionPreference = 'Stop'
if (-not $InstallRoot) {
    $InstallRoot = $PSScriptRoot
}
$InstallRoot = (Resolve-Path -LiteralPath $InstallRoot).Path

$post = Join-Path $InstallRoot 'post-install.ps1'
if (-not (Test-Path -LiteralPath $post)) {
    throw "Missing installer script: $post"
}

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $post -InstallDir $InstallRoot
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Game Night Access Adapter installed."
Write-Host "  It starts at login. You can also use the Start Menu shortcut."
Write-Host "  Local API: http://127.0.0.1:8765/api/v1/health"
Write-Host ""
