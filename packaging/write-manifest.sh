#!/bin/bash
set -euo pipefail
OUT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/dist/installers}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(PYTHONPATH="${ROOT}" python3 -c "from access_adapter.version import __version__; print(__version__)")"

deb=$(ls -1 "$OUT"/game-night-access-adapter_${VERSION}_all.deb 2>/dev/null | head -1 || true)
deb_name=$(basename "${deb:-}")
deb_size=$(stat -c%s "$deb" 2>/dev/null || echo 0)

zip=$(ls -1 "$OUT"/game-night-access-adapter-${VERSION}-windows.zip 2>/dev/null | head -1 || true)
zip_name=$(basename "${zip:-}")
zip_size=$(stat -c%s "$zip" 2>/dev/null || echo 0)

setup=$(ls -1 "$OUT"/game-night-access-adapter-${VERSION}-setup.exe 2>/dev/null | head -1 || true)
setup_name=$(basename "${setup:-}")
setup_size=$(stat -c%s "$setup" 2>/dev/null || echo 0)

cat > "$OUT/manifest.json" << EOF
{
  "version": "${VERSION}",
  "linux": {
    "deb": "${deb_name}",
    "size": ${deb_size}
  },
  "windows": {
    "setup_exe": "${setup_name}",
    "setup_exe_size": ${setup_size},
    "zip": "${zip_name}",
    "zip_size": ${zip_size}
  }
}
EOF
echo "Wrote $OUT/manifest.json (version ${VERSION})"
