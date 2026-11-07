#!/usr/bin/env bash
# Download Google's Android platform-tools (adb) for linux or windows.
# Usage: fetch-platform-tools.sh linux|windows DEST_DIR
set -euo pipefail

OS="${1:-}"
DEST="${2:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACHE_ROOT="$SCRIPT_DIR/vendor"

if [[ "$OS" != "linux" && "$OS" != "windows" ]]; then
  echo "Usage: $0 linux|windows DEST_DIR" >&2
  exit 1
fi
if [[ -z "$DEST" ]]; then
  echo "Usage: $0 linux|windows DEST_DIR" >&2
  exit 1
fi

ADB_NAME="adb"
if [[ "$OS" = "windows" ]]; then
  ADB_NAME="adb.exe"
fi
if [[ -x "$DEST/$ADB_NAME" || -f "$DEST/$ADB_NAME" ]]; then
  echo "Using existing $DEST/$ADB_NAME"
  exit 0
fi

mkdir -p "$CACHE_ROOT" "$DEST"
ZIP="$CACHE_ROOT/platform-tools-latest-${OS}.zip"
URL="https://dl.google.com/android/repository/platform-tools-latest-${OS}.zip"

if [[ ! -f "$ZIP" ]]; then
  echo "Downloading Android platform-tools ($OS)..."
  curl -fL --retry 3 --retry-delay 2 -o "$ZIP" "$URL"
fi

EXTRACT="$(mktemp -d)"
unzip -q -o "$ZIP" -d "$EXTRACT"
if [[ ! -f "$EXTRACT/platform-tools/$ADB_NAME" ]]; then
  echo "ERROR: $ZIP did not contain platform-tools/$ADB_NAME" >&2
  rm -rf "$EXTRACT"
  exit 1
fi
cp -a "$EXTRACT/platform-tools/." "$DEST/"
rm -rf "$EXTRACT"
chmod -R a+rX "$DEST" || true
if [[ "$OS" = "linux" ]]; then
  chmod a+x "$DEST/adb" || true
fi
echo "Installed platform-tools into $DEST"
