#!/usr/bin/env bash
# Build Game Night desktop launcher installers (distinct from ADB phone-tilt packages).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "==> Ensuring bridge dependencies"
(cd bridge && npm ci)

echo "==> Installing launcher build deps"
(cd launcher && npm ci)

TARGET="${1:-}"
cd launcher
case "$TARGET" in
  win|windows) npm run dist:win ;;
  mac|macos) npm run dist:mac ;;
  linux) npm run dist:linux ;;
  *) npm run dist ;;
esac

echo "==> Artifacts in dist/launcher/"
ls -la "$ROOT/dist/launcher" || true
