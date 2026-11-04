#!/usr/bin/env bash
# Build a Windows self-extracting setup.exe (7-Zip SFX) on Linux.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUT_DIR="${1:-$ROOT/dist/installers}"
VENDOR_DIR="$SCRIPT_DIR/vendor"
SFX_MODULE="$VENDOR_DIR/7zSD.sfx"
EXTRA_ARCHIVE="$VENDOR_DIR/lzma-sdk.7z"
# 7zSD.sfx shipped in the LZMA SDK after it left the "extra" package.
EXTRA_URL="${SEVEN_ZIP_SDK_URL:-https://www.7-zip.org/a/lzma2501.7z}"

VERSION="$(python3 -c "import sys; sys.path.insert(0, '$ROOT'); from access_adapter.version import __version__; print(__version__)")"
EXE_NAME="game-night-access-adapter-${VERSION}-setup.exe"
STAGE="$(mktemp -d)"

mkdir -p "$OUT_DIR" "$VENDOR_DIR"

if [[ ! -f "$SFX_MODULE" ]]; then
  echo "Downloading 7-Zip SFX module from the LZMA SDK..."
  curl -fsSL "$EXTRA_URL" -o "$EXTRA_ARCHIVE"
  7z x -o"$VENDOR_DIR" -y "$EXTRA_ARCHIVE" bin/7zSD.sfx >/dev/null
  mv "$VENDOR_DIR/bin/7zSD.sfx" "$SFX_MODULE"
  rm -rf "$VENDOR_DIR/bin" "$EXTRA_ARCHIVE"
fi

if ! file "$SFX_MODULE" | grep -q 'PE32'; then
  echo "ERROR: $SFX_MODULE is not a Windows PE SFX module." >&2
  exit 1
fi

echo "Staging Game Night Access Adapter v$VERSION ..."
rsync -a \
  --exclude '__pycache__' \
  --exclude '*.pyc' \
  "$ROOT/access_adapter" \
  "$ROOT/requirements.txt" \
  "$STAGE/"

cp "$SCRIPT_DIR/python-bootstrap.ps1" \
   "$SCRIPT_DIR/install.ps1" \
   "$SCRIPT_DIR/install.bat" \
   "$SCRIPT_DIR/post-install.ps1" \
   "$SCRIPT_DIR/register-autostart.ps1" \
   "$SCRIPT_DIR/run-app.cmd" \
   "$SCRIPT_DIR/uninstall.ps1" \
   "$SCRIPT_DIR/uninstall.bat" \
   "$STAGE/"

cat > "$STAGE/sfx-config.txt" <<'EOF'
;!@Install@!UTF-8!
Title="Game Night Access Adapter"
RunProgram="install.bat"
;!@InstallEnd@!
EOF
# The official SFX module rejects LF-only config (Windows dialog: Internal error 5000).
python3 - "$STAGE/sfx-config.txt" <<'PY'
from pathlib import Path
import sys
path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8").replace("\r\n", "\n").replace("\n", "\r\n")
if not text.endswith("\r\n"):
    text += "\r\n"
path.write_bytes(text.encode("utf-8"))
PY

SFX_TMP="$(mktemp -d /tmp/access-adapter-sfx-XXXXXX)"
ARCHIVE="$SFX_TMP/payload.7z"
(
  cd "$STAGE"
  7z a -t7z -mx=9 "$ARCHIVE" . -x!sfx-config.txt >/dev/null
)

cat "$SFX_MODULE" "$STAGE/sfx-config.txt" "$ARCHIVE" > "$OUT_DIR/$EXE_NAME"
rm -rf "$SFX_TMP" "$STAGE"

BYTES=$(wc -c < "$OUT_DIR/$EXE_NAME")
if [[ "$BYTES" -lt 80000 ]]; then
  echo "ERROR: setup.exe too small ($BYTES bytes). The 7z payload is missing." >&2
  exit 1
fi

echo "Built $OUT_DIR/$EXE_NAME ($BYTES bytes)"
