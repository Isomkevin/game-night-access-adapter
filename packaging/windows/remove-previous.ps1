# Stop a running adapter and uninstall previous MSI or zip copies so a
# new install is not blocked by "another version is already installed".
param(
    [switch]$KeepFiles
)

$ErrorActionPreference = 'Stop'

function Write-RemoveLog($msg) {
    $logDir = Join-Path $env:ProgramData 'GameNightAccessAdapter'
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg"
    try {
        [System.IO.File]::AppendAllText((Join-Path $logDir 'install.log'), $line + [Environment]::NewLine)
    } catch {}
    Write-Host $msg
}

function Stop-AdapterProcesses {
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
        $_.CommandLine -and ($_.CommandLine -match 'access_adapter')
    } | ForEach-Object {
        Write-RemoveLog "Stopping adapter process $($_.ProcessId)"
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
}

function Uninstall-AdapterMsiProducts {
    $roots = @(
        'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall',
        'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall'
    )
    foreach ($root in $roots) {
        if (-not (Test-Path -LiteralPath $root)) { continue }
        Get-ChildItem -LiteralPath $root -ErrorAction SilentlyContinue | ForEach-Object {
            $props = Get-ItemProperty -LiteralPath $_.PSPath -ErrorAction SilentlyContinue
            if ($null -eq $props) { return }
            $name = [string]$props.DisplayName
            $id = $_.PSChildName
            if ($name -eq 'Game Night Access Adapter' -and $id -match '^\{[0-9A-Fa-f-]+\}$') {
                Write-RemoveLog "Removing previous MSI $id ($($props.DisplayVersion))"
                $p = Start-Process -FilePath 'msiexec.exe' -ArgumentList @('/x', $id, '/qn', '/norestart') -Wait -PassThru -WindowStyle Hidden
                if ($p.ExitCode -notin 0, 1605, 1614) {
                    Write-RemoveLog "msiexec /x $id exit $($p.ExitCode)"
                }
            }
        }
    }
}

Stop-AdapterProcesses
Uninstall-AdapterMsiProducts

$key = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\GameNightAccessAdapter'
if (Test-Path -LiteralPath $key) {
    Remove-Item -LiteralPath $key -Recurse -Force
    Write-RemoveLog 'Removed zip/setup Add/Remove Programs entry'
}

$menu = Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\Game Night Access Adapter.lnk'
$startup = Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\StartUp\Game Night Access Adapter.lnk'
$desktop = Join-Path $env:PUBLIC 'Desktop\Game Night Access Adapter.lnk'
Remove-Item -LiteralPath $menu, $startup, $desktop -Force -ErrorAction SilentlyContinue

if (-not $KeepFiles) {
    $ProgramFiles64 = if ($env:ProgramW6432) { $env:ProgramW6432 } else { $env:ProgramFiles }
    $PermanentRoot = Join-Path $ProgramFiles64 'Game Night Access Adapter'
    if (Test-Path -LiteralPath $PermanentRoot) {
        Write-RemoveLog "Removing $PermanentRoot"
        Start-Process -FilePath 'cmd.exe' -WindowStyle Hidden -ArgumentList "/c ping 127.0.0.1 -n 3 >nul & rmdir /s /q `"$PermanentRoot`"" | Out-Null
        Start-Sleep -Seconds 4
    }
}

Write-Host 'Previous Game Night Access Adapter install removed.'
