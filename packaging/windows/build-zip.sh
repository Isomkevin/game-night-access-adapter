#!/bin/bash
# Build the portable Windows zip.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
VERSION="$(python3 -c "import sys; sys.path.insert(0, '$ROOT'); from access_adapter.version import __version__; print(__version__)")"
OUT_DIR="${1:-$ROOT/dist/installers}"
STAGE="/tmp/game-night-access-adapter-${VERSION}-windows"
WIN="$SCRIPT_DIR"

rm -rf "$STAGE"
mkdir -p "$STAGE"
rsync -a \
  --exclude '__pycache__' \
  --exclude '*.pyc' \
  "$ROOT/access_adapter" \
  "$STAGE/"
cp "$ROOT/requirements.txt" "$STAGE/"
cp "$WIN/install.ps1" "$WIN/install.bat" "$WIN/uninstall.ps1" "$WIN/uninstall.bat" "$WIN/remove-previous.ps1" "$STAGE/"
cp "$WIN/post-install.ps1" "$WIN/python-bootstrap.ps1" "$WIN/register-autostart.ps1" "$STAGE/"
cp "$WIN/run-app.cmd" "$STAGE/"
bash "$ROOT/packaging/fetch-platform-tools.sh" windows "$STAGE/platform-tools"

mkdir -p "$OUT_DIR"
(cd "$STAGE" && zip -rq "$OUT_DIR/game-night-access-adapter-${VERSION}-windows.zip" .)
echo "Built $OUT_DIR/game-night-access-adapter-${VERSION}-windows.zip"
