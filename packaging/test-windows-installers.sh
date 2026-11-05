#!/usr/bin/env bash
# Checks for the Windows zip and the self-extracting setup.exe.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WIN="$ROOT/packaging/windows"
OUT="${1:-$ROOT/dist/installers}"
VERSION="$(PYTHONPATH="$ROOT" python3 -c "from access_adapter.version import __version__; print(__version__)")"
ZIP="$OUT/game-night-access-adapter-${VERSION}-windows.zip"
SFX="$OUT/game-night-access-adapter-${VERSION}-setup.exe"
MSI="$OUT/game-night-access-adapter-${VERSION}.msi"
STAGE="$(mktemp -d)"
FAIL=0

pass() { echo "  OK  $*"; }
fail() { echo "  FAIL $*"; FAIL=1; }

source_path() {
  case "$1" in
    access_adapter/*|requirements.txt) echo "$ROOT/$1" ;;
    *) echo "$WIN/$1" ;;
  esac
}

echo "==> Windows installer tests (v${VERSION})"

REQUIRED=(
  post-install.ps1
  python-bootstrap.ps1
  install.ps1
  install.bat
  register-autostart.ps1
  uninstall.ps1
  uninstall.bat
  run-app.cmd
  requirements.txt
  access_adapter/__main__.py
  access_adapter/version.py
  access_adapter/ui/phone_view.py
  access_adapter/ui/flow.py
  access_adapter/ui/style.py
)

echo "-- Source script checks"
for file in "${REQUIRED[@]}"; do
  src="$(source_path "$file")"
  if [[ -f "$src" ]]; then
    pass "source present: $file"
  else
    fail "missing source: $file ($src)"
  fi
done

echo "-- PowerShell encoding checks"
python3 - "$WIN" <<'PY' || FAIL=1
import pathlib
import sys

fail = 0
for path in pathlib.Path(sys.argv[1]).glob("*.ps1"):
    raw = path.read_bytes()
    text = raw.decode("utf-8-sig")
    if "\u2014" in text or "\u2013" in text:
        print(f"  FAIL em/en dash in {path.name} (breaks Windows PowerShell 5.1)")
        fail = 1
    elif not raw.startswith(b"\xef\xbb\xbf"):
        print(f"  FAIL missing UTF-8 BOM: {path.name}")
        fail = 1
    else:
        print(f"  OK  {path.name} ASCII-safe + UTF-8 BOM")
sys.exit(fail)
PY

if grep -q 'InstallRoot "%~dp0"' "$WIN"/*.bat 2>/dev/null; then
  fail 'batch file passes InstallRoot "%~dp0" (trailing backslash breaks quoting)'
else
  pass 'batch files avoid InstallRoot "%~dp0"'
fi

if grep -q '& @bootstrap' "$WIN"/*.ps1 2>/dev/null; then
  fail 'PowerShell uses invalid "& @bootstrap" invocation'
else
  pass 'no invalid "& @bootstrap" invocation'
fi

if ! grep -q 'cd /d "%~dp0"' "$WIN/install.bat"; then
  fail 'install.bat must cd to the script directory first'
else
  pass 'install.bat cds to the script directory'
fi

if ! grep -q 'Find-AdapterPython' "$WIN/python-bootstrap.ps1"; then
  fail 'python-bootstrap.ps1 missing Find-AdapterPython'
else
  pass 'python-bootstrap.ps1 helper present'
fi

if ! grep -q 'Install-AdapterPython' "$WIN/python-bootstrap.ps1"; then
  fail 'python-bootstrap.ps1 must auto-install Python when missing'
else
  pass 'python-bootstrap.ps1 auto-installs Python'
fi

if ! grep -q 'Ensure-AdapterPython' "$WIN/python-bootstrap.ps1"; then
  fail 'python-bootstrap.ps1 missing Ensure-AdapterPython'
else
  pass 'python-bootstrap.ps1 ensures Python before venv'
fi

if ! grep -q 'python.org/ftp/python' "$WIN/python-bootstrap.ps1"; then
  fail 'python-bootstrap.ps1 must fall back to the python.org installer'
else
  pass 'python-bootstrap.ps1 has python.org fallback'
fi

if ! grep -Fq "__version__ = \"${VERSION}\"" "$ROOT/access_adapter/version.py"; then
  fail "version.py is not ${VERSION}"
else
  pass "version.py is ${VERSION}"
fi

if ! grep -q 'Publish-AdapterToProgramFiles' "$WIN/post-install.ps1"; then
  fail 'post-install.ps1 must publish to Program Files (SFX temp is deleted after setup)'
else
  pass 'post-install.ps1 publishes to Program Files'
fi

if grep -q 'WindowStyle = 7' "$WIN/register-autostart.ps1"; then
  fail 'Start Menu shortcut must not launch minimized'
else
  pass 'shortcuts launch in a normal window'
fi

if ! grep -q "PUBLIC 'Desktop" "$WIN/register-autostart.ps1"; then
  fail 'missing public desktop shortcut'
else
  pass 'public desktop shortcut is registered'
fi

if ! grep -q 'venv\\Scripts\\python.exe' "$WIN/run-app.cmd"; then
  fail 'run-app.cmd must fall back to python.exe'
else
  pass 'run-app.cmd falls back to python.exe'
fi

if ! grep -q 'start "" /B' "$WIN/run-app.cmd"; then
  fail 'run-app.cmd must start the app without extra console windows'
else
  pass 'run-app.cmd starts without extra consoles'
fi

if ! grep -q 'CREATE_NO_WINDOW' "$ROOT/access_adapter/adb_devices.py"; then
  fail 'adb_devices.py must hide Windows ADB consoles with CREATE_NO_WINDOW'
else
  pass 'adb_devices.py hides ADB consoles'
fi

if ! grep -q 'hidden_subprocess_kwargs' "$ROOT/access_adapter/sensors.py"; then
  fail 'sensors.py must pass hidden_subprocess_kwargs to ADB dumpsys'
else
  pass 'sensors.py hides dumpsys consoles'
fi

if ! grep -q 'Repair-AdapterPackageLayout' "$WIN/post-install.ps1"; then
  fail 'post-install.ps1 must repair flattened MSI package layouts'
else
  pass 'post-install.ps1 repairs flattened package layouts'
fi

if ! grep -q 'emit_directory' "$WIN/build-msi.sh"; then
  fail 'build-msi.sh must nest Directory entries so access_adapter/ is preserved'
else
  pass 'build-msi.sh nests MSI Directory entries'
fi

echo "-- MSI checks"
if [[ ! -f "$MSI" ]]; then
  fail "msi missing: $MSI"
else
  pass "msi exists: $(basename "$MSI")"
  bytes=$(wc -c < "$MSI")
  if [[ "$bytes" -lt 20000 ]]; then
    fail "msi too small ($bytes bytes)"
  else
    pass "msi size ${bytes} bytes"
  fi
  if file "$MSI" | grep -qi 'MSI Installer'; then
    pass 'msi is a Windows Installer database'
  else
    fail "msi is not recognized: $(file "$MSI")"
  fi
fi

echo "-- Zip archive checks"
if [[ ! -f "$ZIP" ]]; then
  fail "zip missing: $ZIP"
else
  pass "zip exists: $(basename "$ZIP")"
  list_zip="$(mktemp)"
  unzip -l "$ZIP" > "$list_zip"
  for file in "${REQUIRED[@]}"; do
    if grep -Fq "$file" "$list_zip"; then
      pass "zip contains $file"
    else
      fail "zip missing $file"
    fi
  done
  rm -f "$list_zip"
fi

echo "-- SFX archive checks"
if [[ ! -f "$SFX" ]]; then
  fail "setup.exe missing: $SFX"
else
  bytes=$(wc -c < "$SFX")
  if [[ "$bytes" -lt 80000 ]]; then
    fail "setup.exe too small ($bytes bytes)"
  else
    pass "setup.exe size ${bytes} bytes"
  fi
  list_sfx="$(mktemp)"
  7z l "$SFX" > "$list_sfx"
  for file in "${REQUIRED[@]}"; do
    if grep -Fq "$file" "$list_sfx"; then
      pass "setup.exe contains $file"
    else
      fail "setup.exe missing $file"
    fi
  done
  rm -f "$list_sfx"
fi

echo "-- Extracted install path simulation"
if [[ -f "$ZIP" ]]; then
  unzip -q "$ZIP" -d "$STAGE"
  if [[ -f "$STAGE/post-install.ps1" && -f "$STAGE/python-bootstrap.ps1" && -f "$STAGE/install.bat" ]]; then
    pass 'zip extracts a runnable install payload'
  else
    fail 'zip extract missing install payload'
  fi
fi

echo "-- Manifest checks"
MANIFEST="$OUT/manifest.json"
if [[ ! -f "$MANIFEST" ]]; then
  fail "manifest missing"
else
  if python3 - <<PY
import json, sys
from pathlib import Path
manifest = json.loads(Path("$MANIFEST").read_text())
version = manifest.get("version")
windows = manifest.get("windows", {})
expected_zip = "game-night-access-adapter-${VERSION}-windows.zip"
expected_exe = "game-night-access-adapter-${VERSION}-setup.exe"
expected_msi = "game-night-access-adapter-${VERSION}.msi"
ok = True
if version != "${VERSION}":
    print("  FAIL manifest version is", version)
    ok = False
if windows.get("zip") != expected_zip:
    print("  FAIL manifest zip is", windows.get("zip"))
    ok = False
if windows.get("setup_exe") != expected_exe:
    print("  FAIL manifest setup_exe is", windows.get("setup_exe"))
    ok = False
if windows.get("msi") != expected_msi:
    print("  FAIL manifest msi is", windows.get("msi"))
    ok = False
if ok:
    print("  OK  manifest matches ${VERSION}")
    sys.exit(0)
sys.exit(1)
PY
  then
    :
  else
    FAIL=1
  fi
fi

rm -rf "$STAGE"

if [[ "$FAIL" -ne 0 ]]; then
  echo ""
  echo "TESTS FAILED"
  exit 1
fi

echo ""
echo "All Windows installer tests passed."
