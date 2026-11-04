#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT="$ROOT/dist/installers"
mkdir -p "$OUT"

echo "Building Linux .deb..."
bash "$SCRIPT_DIR/linux/build-deb.sh" "$OUT"

if [ "$(uname -s)" = "Linux" ]; then
  echo "Building Windows zip..."
  bash "$SCRIPT_DIR/windows/build-zip.sh" "$OUT"
  echo "Building Windows setup.exe (SFX)..."
  bash "$SCRIPT_DIR/windows/build-sfx.sh" "$OUT"
fi

bash "$SCRIPT_DIR/write-manifest.sh" "$OUT"

echo "Running installer tests..."
bash "$SCRIPT_DIR/test-linux-installer.sh" "$OUT"
bash "$SCRIPT_DIR/test-windows-installers.sh" "$OUT"

echo "Installers in $OUT"
