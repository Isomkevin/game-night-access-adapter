# Copy the payload into Program Files, create the virtual environment, and register shortcuts.
# A self-extracting setup.exe unpacks into a temporary folder that is deleted when
# it exits, so the installed files must live under Program Files.
param(
    [string]$InstallDir = $PSScriptRoot,
    [string]$InstallRoot = ''
)

$ErrorActionPreference = 'Stop'
if ($InstallRoot) { $InstallDir = $InstallRoot }

$LogDir = Join-Path $env:ProgramData 'GameNightAccessAdapter'
$LogFile = Join-Path $LogDir 'install.log'
$ProgramFiles64 = if ($env:ProgramW6432) { $env:ProgramW6432 } else { $env:ProgramFiles }
$PermanentRoot = Join-Path $ProgramFiles64 'Game Night Access Adapter'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Write-Log($msg) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg"
    try {
        [System.IO.File]::AppendAllText($LogFile, $line + [Environment]::NewLine)
    } catch {
        # install.log may be locked; never fail setup for logging
    }
    Write-Host $msg
}

function Publish-AdapterToProgramFiles {
    param(
        [Parameter(Mandatory = $true)][string]$SourceDir,
        [Parameter(Mandatory = $true)][string]$TargetDir
    )

    $source = (Resolve-Path -LiteralPath $SourceDir).Path
    New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null
    $target = (Resolve-Path -LiteralPath $TargetDir).Path

    if ($source.TrimEnd('\') -ieq $target.TrimEnd('\')) {
        return $target
    }

    Write-Log "Publishing files to a permanent location:"
    Write-Log "  from: $source"
    Write-Log "  to:   $target"

    Get-ChildItem -LiteralPath $source -Force | ForEach-Object {
        if ($_.Name -ieq 'venv') { return }
        $dest = Join-Path $target $_.Name
        Copy-Item -LiteralPath $_.FullName -Destination $dest -Recurse -Force
    }

    return $target
}

function Register-AdapterUninstallKey {
    param([Parameter(Mandatory = $true)][string]$InstallDir)

    $version = '0.0.0'
    try {
        $versionFile = Join-Path $InstallDir 'access_adapter\version.py'
        $text = Get-Content -LiteralPath $versionFile -Raw -ErrorAction Stop
        if ($text -match '__version__\s*=\s*[''"]([^''"]+)[''"]') { $version = $Matches[1] }
    } catch {}

    $uninstallBat = Join-Path $InstallDir 'uninstall.bat'
    $key = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\GameNightAccessAdapter'
    New-Item -Path $key -Force | Out-Null
    New-ItemProperty -Path $key -Name 'DisplayName' -Value 'Game Night Access Adapter' -PropertyType String -Force | Out-Null
    New-ItemProperty -Path $key -Name 'DisplayVersion' -Value $version -PropertyType String -Force | Out-Null
    New-ItemProperty -Path $key -Name 'Publisher' -Value 'Game Night' -PropertyType String -Force | Out-Null
    New-ItemProperty -Path $key -Name 'InstallLocation' -Value $InstallDir -PropertyType String -Force | Out-Null
    New-ItemProperty -Path $key -Name 'UninstallString' -Value "`"$uninstallBat`"" -PropertyType String -Force | Out-Null
    New-ItemProperty -Path $key -Name 'NoModify' -Value 1 -PropertyType DWord -Force | Out-Null
    New-ItemProperty -Path $key -Name 'NoRepair' -Value 1 -PropertyType DWord -Force | Out-Null
    Write-Log "Registered Add/Remove Programs entry (v$version)"
}

. (Join-Path $PSScriptRoot 'python-bootstrap.ps1')

try {
    $InstallDir = (Resolve-Path -LiteralPath $InstallDir).Path
    Write-Log "Post-install source: $InstallDir"

    $InstallDir = Publish-AdapterToProgramFiles -SourceDir $InstallDir -TargetDir $PermanentRoot
    Write-Log "Install root: $InstallDir"

    # The copy under Program Files is the one that must be used from here on.
    . (Join-Path $InstallDir 'python-bootstrap.ps1')

    $venvPython = Join-Path $InstallDir 'venv\Scripts\python.exe'
    if (-not (Test-Path -LiteralPath $venvPython)) {
        Write-Log 'Creating Python virtual environment...'
        $created = New-AdapterVirtualEnv -InstallDir $InstallDir
        $venvPython = $created.VenvPython
    }

    Write-Log 'Installing Python dependencies...'
    & $venvPython -m pip install --upgrade pip
    if ($LASTEXITCODE -ne 0) { throw "pip upgrade failed ($LASTEXITCODE)" }
    & $venvPython -m pip install -r (Join-Path $InstallDir 'requirements.txt')
    if ($LASTEXITCODE -ne 0) { throw "pip install failed ($LASTEXITCODE)" }

    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $InstallDir 'register-autostart.ps1') -InstallDir $InstallDir
    if ($LASTEXITCODE -ne 0) { throw "shortcut registration failed ($LASTEXITCODE)" }

    Register-AdapterUninstallKey -InstallDir $InstallDir

    $env:PYTHONPATH = $InstallDir
    $pyw = Join-Path $InstallDir 'venv\Scripts\pythonw.exe'
    $py = Join-Path $InstallDir 'venv\Scripts\python.exe'
    $launcher = Join-Path $InstallDir 'run-app.cmd'
    Write-Log 'Starting Game Night Access Adapter...'
    if (Test-Path -LiteralPath $pyw) {
        Start-Process -FilePath $pyw -ArgumentList '-m access_adapter' -WorkingDirectory $InstallDir
    } elseif (Test-Path -LiteralPath $py) {
        Start-Process -FilePath $py -ArgumentList '-m access_adapter' -WorkingDirectory $InstallDir
    } elseif (Test-Path -LiteralPath $launcher) {
        Start-Process -FilePath $launcher -WorkingDirectory $InstallDir
    }

    Write-Log 'Install finished.'
    exit 0
} catch {
    Write-Log "ERROR: $($_.Exception.Message)"
    exit 1
}
