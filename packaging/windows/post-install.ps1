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

function Test-FileContains {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Needle
    )
    if (-not (Test-Path -LiteralPath $Path)) { return $false }
    return [bool](Select-String -LiteralPath $Path -Pattern $Needle -SimpleMatch -Quiet)
}

function Repair-AdapterPackageLayout {
    param([Parameter(Mandatory = $true)][string]$InstallDir)

    # Older MSI builds dropped every file into the install root. The app imports
    # access_adapter.*, so those modules must live under access_adapter\.
    $packageModules = @(
        'adb_devices.py', 'api.py', 'bridge.py', 'config.py', 'keys.py',
        'mapping.py', 'sensors.py', 'state.py', 'version.py', '__init__.py', '__main__.py'
    )
    $uiModules = @(
        'devices_dialog.py', 'flow.py', 'main_window.py', 'mapping_dialog.py',
        'phone_view.py', 'style.py', '__init__.py'
    )
    $pkg = Join-Path $InstallDir 'access_adapter'
    $ui = Join-Path $pkg 'ui'
    $flatHits = @($packageModules | Where-Object { Test-Path -LiteralPath (Join-Path $InstallDir $_) }).Count
    if ($flatHits -ge 5) {
        Write-Log 'Repairing flattened package layout from MSI...'
        New-Item -ItemType Directory -Force -Path $ui | Out-Null
        foreach ($name in $packageModules) {
            $src = Join-Path $InstallDir $name
            if (Test-Path -LiteralPath $src) {
                Copy-Item -LiteralPath $src -Destination (Join-Path $pkg $name) -Force
                Remove-Item -LiteralPath $src -Force
            }
        }
        foreach ($name in $uiModules) {
            $src = Join-Path $InstallDir $name
            if (Test-Path -LiteralPath $src) {
                Copy-Item -LiteralPath $src -Destination (Join-Path $ui $name) -Force
                Remove-Item -LiteralPath $src -Force
            }
        }
    }

    $nested = Join-Path $pkg 'access_adapter'
    if (Test-Path -LiteralPath $nested) {
        Write-Log 'Removing nested duplicate access_adapter package...'
        Copy-Item -Path (Join-Path $nested '*') -Destination $pkg -Recurse -Force
        Remove-Item -LiteralPath $nested -Recurse -Force
    }

    Get-ChildItem -LiteralPath $InstallDir -Filter '__pycache__' -Recurse -Directory -ErrorAction SilentlyContinue |
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

    $adbDevices = Join-Path $pkg 'adb_devices.py'
    $sensors = Join-Path $pkg 'sensors.py'
    $keys = Join-Path $pkg 'keys.py'
    if (-not (Test-FileContains -Path $adbDevices -Needle 'CREATE_NO_WINDOW')) {
        throw 'Installed access_adapter\adb_devices.py is missing CREATE_NO_WINDOW (ADB consoles would flood the desktop).'
    }
    if (-not (Test-FileContains -Path $sensors -Needle 'hidden_subprocess_kwargs')) {
        throw 'Installed access_adapter\sensors.py is missing hidden_subprocess_kwargs.'
    }
    if (-not (Test-FileContains -Path $keys -Needle 'Win32HoldController')) {
        throw 'Installed access_adapter\keys.py is missing Win32HoldController (hold would not reach games).'
    }
    Write-Log 'Package layout OK (ADB helper consoles stay hidden; Windows hold uses scan codes).'
}

. (Join-Path $PSScriptRoot 'python-bootstrap.ps1')

function Stop-AdapterProcesses {
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
        $_.CommandLine -and ($_.CommandLine -match 'access_adapter')
    } | ForEach-Object {
        Write-Log "Stopping adapter process $($_.ProcessId)"
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
}

try {
    Stop-AdapterProcesses
    $InstallDir = (Resolve-Path -LiteralPath $InstallDir).Path
    Write-Log "Post-install source: $InstallDir"

    $InstallDir = Publish-AdapterToProgramFiles -SourceDir $InstallDir -TargetDir $PermanentRoot
    Write-Log "Install root: $InstallDir"
    Repair-AdapterPackageLayout -InstallDir $InstallDir

    # The copy under Program Files is the one that must be used from here on.
    . (Join-Path $InstallDir 'python-bootstrap.ps1')

    $venvPython = Join-Path $InstallDir 'venv\Scripts\python.exe'
    if (-not (Test-Path -LiteralPath $venvPython)) {
        Write-Log 'Ensuring Python 3 is available (installs automatically if missing)...'
        Write-Log 'Creating Python virtual environment...'
        $created = New-AdapterVirtualEnv -InstallDir $InstallDir
        $venvPython = $created.VenvPython
        Write-Log "Virtual environment ready: $venvPython"
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
    $tools = Join-Path $InstallDir 'platform-tools'
    if (Test-Path -LiteralPath $tools) {
        $env:PATH = "$tools;" + $env:PATH
        $env:GAME_NIGHT_INSTALL_ROOT = $InstallDir
    }
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
