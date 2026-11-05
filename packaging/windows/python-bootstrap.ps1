# Find a system Python 3, install one automatically when missing, then create the venv.
$script:AdapterPythonVersion = '3.12.10'
$script:AdapterPythonWingetId = 'Python.Python.3.12'

function Find-AdapterPython {
    # Prefer a python.org install for all users. Microsoft Store aliases
    # often cannot create a virtual environment that other users can launch.
    foreach ($ver in @('3.13', '3.12', '3.11', '3.10', '3.14')) {
        foreach ($reg in @(
                "HKLM:\SOFTWARE\Python\PythonCore\$ver\InstallPath",
                "HKLM:\SOFTWARE\WOW6432Node\Python\PythonCore\$ver\InstallPath"
            )) {
            $installPath = (Get-ItemProperty -Path $reg -ErrorAction SilentlyContinue).'(default)'
            if ($installPath) {
                $exe = Join-Path $installPath 'python.exe'
                if ((Test-Path -LiteralPath $exe) -and ($exe -notmatch 'WindowsApps')) {
                    return @{ Mode = 'exe'; Exe = $exe }
                }
            }
        }
    }

    $roots = @(
        $env:ProgramFiles,
        ${env:ProgramFiles(x86)},
        'C:\'
    ) | Where-Object { $_ }

    foreach ($root in $roots) {
        $glob = Join-Path $root 'Python*\python.exe'
        $match = Get-ChildItem -Path $glob -ErrorAction SilentlyContinue |
            Sort-Object FullName -Descending |
            Select-Object -First 1
        if ($match -and ($match.FullName -notmatch 'WindowsApps')) {
            return @{ Mode = 'exe'; Exe = $match.FullName }
        }
    }

    $pyLauncher = Get-Command py.exe -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($pyLauncher) {
        return @{ Mode = 'launcher'; Exe = $pyLauncher.Source }
    }

    foreach ($name in @('python3', 'python')) {
        $cmds = Get-Command $name -ErrorAction SilentlyContinue
        foreach ($cmd in $cmds) {
            if ($cmd.Source -match 'WindowsApps') { continue }
            return @{ Mode = 'exe'; Exe = $cmd.Source }
        }
    }

    return $null
}

function Update-AdapterProcessPath {
    $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $parts = @($machinePath, $userPath) | Where-Object { $_ }
    if ($parts.Count -gt 0) {
        $env:Path = ($parts -join ';')
    }
}

function Install-AdapterPythonWithWinget {
    $winget = Get-Command winget.exe -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $winget) { return $false }

    Write-Host "Installing Python $($script:AdapterPythonVersion) with winget ($($script:AdapterPythonWingetId))..."
    & $winget.Source install `
        --id $script:AdapterPythonWingetId `
        -e `
        --scope machine `
        --accept-package-agreements `
        --accept-source-agreements `
        --disable-interactivity
    $code = $LASTEXITCODE
    # 0 = installed, -1978335189 / other "already installed" codes still leave Python usable.
    Update-AdapterProcessPath
    if (Find-AdapterPython) { return $true }
    Write-Host "winget Python install did not expose a usable python.exe (exit $code)."
    return $false
}

function Install-AdapterPythonFromPythonOrg {
    if (-not [Environment]::Is64BitOperatingSystem) {
        throw 'Automatic Python install requires 64-bit Windows. Install Python 3 from https://www.python.org/downloads/ then re-run setup.'
    }

    $ver = $script:AdapterPythonVersion
    $fileName = "python-$ver-amd64.exe"
    $url = "https://www.python.org/ftp/python/$ver/$fileName"
    $tmpDir = Join-Path $env:TEMP 'GameNightAccessAdapter'
    New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
    $installer = Join-Path $tmpDir $fileName

    Write-Host "Downloading Python $ver from python.org..."
    Write-Host "  $url"
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    } catch {}

    $previousProgress = $ProgressPreference
    $ProgressPreference = 'SilentlyContinue'
    try {
        Invoke-WebRequest -Uri $url -OutFile $installer -UseBasicParsing
    } finally {
        $ProgressPreference = $previousProgress
    }

    if (-not (Test-Path -LiteralPath $installer)) {
        throw "Failed to download Python installer from $url"
    }

    Write-Host "Running silent Python install for all users..."
    $args = @(
        '/quiet',
        'InstallAllUsers=1',
        'PrependPath=1',
        'Include_launcher=1',
        'Include_test=0',
        'Include_doc=0',
        'Include_dev=0',
        'SimpleInstall=1'
    )
    $proc = Start-Process -FilePath $installer -ArgumentList $args -Wait -PassThru
    if ($proc.ExitCode -notin 0, 3010) {
        throw "Python installer failed with exit code $($proc.ExitCode). Install Python 3 from https://www.python.org/downloads/ (all users + PATH), then re-run setup."
    }

    Update-AdapterProcessPath
    if (-not (Find-AdapterPython)) {
        throw 'Python installer finished but python.exe was not found. Sign out/in or re-run setup after confirming Python is on PATH.'
    }
    return $true
}

function Install-AdapterPython {
    Write-Host 'Python 3 was not found. Installing it automatically...'
    if (Install-AdapterPythonWithWinget) {
        Write-Host 'Python is ready (winget).'
        return
    }
    [void](Install-AdapterPythonFromPythonOrg)
    Write-Host 'Python is ready (python.org).'
}

function Ensure-AdapterPython {
    $found = Find-AdapterPython
    if ($found) { return $found }
    Install-AdapterPython
    $found = Find-AdapterPython
    if (-not $found) {
        throw @"
Python 3 could not be installed automatically.

Install Python 3 from https://www.python.org/downloads/
During setup, check "Add python.exe to PATH" and "Install for all users".
Do not use the Microsoft Store copy of Python.
Then re-run install.bat as Administrator.
"@
    }
    return $found
}

function Copy-AdapterVenvRuntime {
    param([Parameter(Mandatory = $true)][string]$VenvPath)

    $cfg = Join-Path $VenvPath 'pyvenv.cfg'
    if (-not (Test-Path -LiteralPath $cfg)) { return }
    $pythonHome = $null
    Get-Content -LiteralPath $cfg | ForEach-Object {
        if ($_ -match '^\s*home\s*=\s*(.+)\s*$') { $pythonHome = $Matches[1].Trim() }
    }
    if (-not $pythonHome) { return }
    if ($pythonHome -match 'WindowsApps') {
        throw "Microsoft Store Python cannot be used (home=$pythonHome). Install Python from python.org for all users, then re-run the installer."
    }
    $dest = Join-Path $VenvPath 'Scripts'
    foreach ($pat in @('python*.dll', 'vcruntime*.dll')) {
        Get-ChildItem -LiteralPath $pythonHome -Filter $pat -ErrorAction SilentlyContinue |
            Copy-Item -Destination $dest -Force
    }
}

function New-AdapterVirtualEnv {
    param(
        [Parameter(Mandatory = $true)]
        [string]$InstallDir
    )

    $venvPath = Join-Path $InstallDir 'venv'
    $bootstrap = Ensure-AdapterPython

    if ($bootstrap.Mode -eq 'launcher') {
        & $bootstrap.Exe -3 -m venv --copies $venvPath
    } else {
        & $bootstrap.Exe -m venv --copies $venvPath
    }

    if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
        throw "python -m venv failed (exit code $LASTEXITCODE)"
    }

    $venvPython = Join-Path $venvPath 'Scripts\python.exe'
    if (-not (Test-Path -LiteralPath $venvPython)) {
        throw "Virtual environment was not created at $venvPython"
    }

    Copy-AdapterVenvRuntime -VenvPath $venvPath

    return @{
        Bootstrap = $bootstrap
        VenvPython = $venvPython
    }
}
