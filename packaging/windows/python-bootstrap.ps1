# Find a system Python 3 and create the application virtual environment.
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

    throw @"
Python 3 not found.

Install Python 3 from https://www.python.org/downloads/
During setup, check "Add python.exe to PATH" and "Install for all users".
Do not use the Microsoft Store copy of Python.
Then re-run install.bat as Administrator.
"@
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
    $bootstrap = Find-AdapterPython

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
