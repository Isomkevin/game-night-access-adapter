# Install the Game Night Chrome extension for the current Windows user.
# Chrome and Edge on Windows only add extensions from their web stores by
# themselves, so this copies the extension to a permanent folder, opens the
# browser's extensions page, and shows the one-time "Load unpacked" steps.
param([switch]$Quiet)

$ErrorActionPreference = 'Stop'
$Root = Join-Path $env:LOCALAPPDATA 'Game Night Access Adapter'
$Target = Join-Path $Root 'extension'
$Source = Join-Path $PSScriptRoot 'extension'

if (-not (Test-Path -LiteralPath (Join-Path $Source 'manifest.json'))) {
    throw "Extension files are missing next to the installer: $Source"
}
if (Test-Path -LiteralPath $Target) { Remove-Item -LiteralPath $Target -Recurse -Force }
New-Item -ItemType Directory -Force -Path $Target | Out-Null
Copy-Item -Path (Join-Path $Source '*') -Destination $Target -Recurse -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'uninstall-extension.ps1') -Destination $Root -Force

$version = (Get-Content -LiteralPath (Join-Path $Target 'manifest.json') -Raw | ConvertFrom-Json).version
$key = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\GameNightExtension'
New-Item -Path $key -Force | Out-Null
$uninstall = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $Root 'uninstall-extension.ps1')`""
New-ItemProperty -Path $key -Name 'DisplayName' -Value 'Game Night extension (Chrome)' -PropertyType String -Force | Out-Null
New-ItemProperty -Path $key -Name 'DisplayVersion' -Value $version -PropertyType String -Force | Out-Null
New-ItemProperty -Path $key -Name 'Publisher' -Value 'Game Night' -PropertyType String -Force | Out-Null
New-ItemProperty -Path $key -Name 'InstallLocation' -Value $Target -PropertyType String -Force | Out-Null
New-ItemProperty -Path $key -Name 'UninstallString' -Value $uninstall -PropertyType String -Force | Out-Null
New-ItemProperty -Path $key -Name 'NoModify' -Value 1 -PropertyType DWord -Force | Out-Null
New-ItemProperty -Path $key -Name 'NoRepair' -Value 1 -PropertyType DWord -Force | Out-Null

Write-Host "Game Night extension v$version copied to $Target"
if ($Quiet) { exit 0 }

function Find-Browser {
    $candidates = @(
        @{ Exe = 'chrome.exe'; Page = 'chrome://extensions'; Name = 'Chrome' },
        @{ Exe = 'msedge.exe'; Page = 'edge://extensions'; Name = 'Edge' }
    )
    foreach ($c in $candidates) {
        foreach ($hive in 'HKCU:', 'HKLM:') {
            $appPath = "$hive\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\$($c.Exe)"
            $exe = (Get-ItemProperty -LiteralPath $appPath -ErrorAction SilentlyContinue).'(default)'
            if ($exe -and (Test-Path -LiteralPath $exe)) { return @{ Exe = $exe; Page = $c.Page; Name = $c.Name } }
        }
    }
    return $null
}

Set-Clipboard -Value $Target
$browser = Find-Browser
$name = if ($browser) { $browser.Name } else { 'Chrome' }
if ($browser) { Start-Process -FilePath $browser.Exe -ArgumentList $browser.Page }

Add-Type -AssemblyName System.Windows.Forms
$steps = @"
The extension files are installed. $name needs you to turn it on once:

1. On the Extensions page that just opened, switch on "Developer mode" (top right).
2. Click "Load unpacked".
3. In the folder box press Ctrl+V, then click "Select Folder".
   (The folder is already copied:  $Target)

After an update, run this installer again and click the reload arrow on the extension.
"@
[System.Windows.Forms.MessageBox]::Show($steps, 'Game Night extension', 'OK', 'Information') | Out-Null
