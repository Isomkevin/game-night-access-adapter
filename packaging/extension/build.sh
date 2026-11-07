#!/usr/bin/env bash
# Build the Chrome extension packages, separate from the desktop adapter:
#   game-night-extension-<v>-store.zip   upload to the Chrome Web Store
#   game-night-extension-<v>.crx         signed package (stable extension ID)
#   game-night-extension_<v>_all.deb     Linux: Chrome/Chromium install it on next start
#   game-night-extension-<v>-windows-setup.exe  Windows: copies the extension and guides "Load unpacked"
#
# Usage: packaging/extension/build.sh [out-dir]
# The signing key is never committed. Default: ~/.config/game-night-access-adapter/extension-key.pem
set -euo pipefail
umask 022

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUT="$(mkdir -p "${1:-$ROOT/dist/extension}" && cd "${1:-$ROOT/dist/extension}" && pwd)"
KEY="${GNAA_EXTENSION_KEY:-$HOME/.config/game-night-access-adapter/extension-key.pem}"
SFX_MODULE="$ROOT/packaging/windows/vendor/7zSD.sfx"
NAME="game-night-extension"
VERSION="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['version'])" "$ROOT/extension/manifest.json")"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

if [[ ! -f "$KEY" ]]; then
  echo "Signing key not found: $KEY" >&2
  echo "Create one with: openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out \"$KEY\"" >&2
  exit 1
fi
CHROME="${CHROME:-$(command -v google-chrome || command -v google-chrome-stable || command -v chromium || command -v chromium-browser || true)}"
if [[ -z "$CHROME" ]]; then
  echo "Chrome or Chromium is needed to sign the .crx (set CHROME=/path/to/chrome)." >&2
  exit 1
fi

EXT_ID="$(python3 - "$KEY" <<'PY'
import hashlib, subprocess, sys
der = subprocess.run(["openssl", "pkey", "-in", sys.argv[1], "-pubout", "-outform", "DER"],
                     capture_output=True, check=True).stdout
print("".join(chr(ord("a") + int(c, 16)) for c in hashlib.sha256(der).hexdigest()[:32]))
PY
)"

echo "Game Night extension v$VERSION (id $EXT_ID)"
rsync -a --exclude 'tests' --exclude 'README.md' "$ROOT/extension/" "$STAGE/ext/"

rm -f "$OUT/$NAME-$VERSION-store.zip"
(cd "$STAGE/ext" && zip -qrX "$OUT/$NAME-$VERSION-store.zip" .)
echo "Built $OUT/$NAME-$VERSION-store.zip"

"$CHROME" --user-data-dir="$STAGE/profile" --no-first-run \
  --pack-extension="$STAGE/ext" --pack-extension-key="$KEY" >/dev/null 2>&1
install -m 0644 "$STAGE/ext.crx" "$OUT/$NAME-$VERSION.crx"
echo "Built $OUT/$NAME-$VERSION.crx"

DEB="$STAGE/deb"
install -D -m 0644 "$STAGE/ext.crx" "$DEB/opt/$NAME/$NAME.crx"
EXTERNAL="{\"external_crx\": \"/opt/$NAME/$NAME.crx\", \"external_version\": \"$VERSION\"}"
for browser_dir in google-chrome chromium; do
  mkdir -p "$DEB/usr/share/$browser_dir/extensions"
  printf '%s\n' "$EXTERNAL" > "$DEB/usr/share/$browser_dir/extensions/$EXT_ID.json"
  chmod 0644 "$DEB/usr/share/$browser_dir/extensions/$EXT_ID.json"
done
mkdir -p "$DEB/DEBIAN"
cat > "$DEB/DEBIAN/control" <<EOF
Package: $NAME
Version: $VERSION
Section: web
Priority: optional
Architecture: all
Maintainer: Game Night Access Adapter <noreply@github.com>
Homepage: https://github.com/Isomkevin/game-night-access-adapter
Description: Game Night Access Adapter Chrome extension
 Remaps camera, voice, and phone inputs onto keyboard controls for browser
 games. Google Chrome and Chromium add it the next time they start.
EOF
cat > "$DEB/DEBIAN/postinst" <<'EOF'
#!/bin/sh
echo "Game Night extension installed. Restart Chrome, then click 'Enable extension' when Chrome asks."
EOF
chmod 0755 "$DEB/DEBIAN/postinst"
dpkg-deb --root-owner-group --build "$DEB" "$OUT/${NAME}_${VERSION}_all.deb" >/dev/null
echo "Built $OUT/${NAME}_${VERSION}_all.deb"

if [[ -f "$SFX_MODULE" ]] && command -v 7z >/dev/null; then
  WIN="$STAGE/win"
  mkdir -p "$WIN"
  cp -r "$STAGE/ext" "$WIN/extension"
  cp "$SCRIPT_DIR/windows/install-extension.cmd" \
     "$SCRIPT_DIR/windows/install-extension.ps1" \
     "$SCRIPT_DIR/windows/uninstall-extension.ps1" "$WIN/"
  printf ';!@Install@!UTF-8!\r\nTitle="Game Night extension"\r\nRunProgram="install-extension.cmd"\r\n;!@InstallEnd@!\r\n' > "$STAGE/sfx-config.txt"
  (cd "$WIN" && 7z a -t7z -mx=9 "$STAGE/payload.7z" . >/dev/null)
  cat "$SFX_MODULE" "$STAGE/sfx-config.txt" "$STAGE/payload.7z" > "$OUT/$NAME-$VERSION-windows-setup.exe"
  echo "Built $OUT/$NAME-$VERSION-windows-setup.exe"
else
  echo "Skipped Windows setup.exe (needs 7z and $SFX_MODULE)" >&2
fi

echo "$EXT_ID" > "$OUT/extension-id.txt"
