#!/bin/bash
# Build a .deb that installs the desktop app, a menu entry, and login autostart.
# The window must run in the signed-in user session so keystrokes reach the game,
# so this package does not register a system service.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
VERSION="$(python3 -c "import sys; sys.path.insert(0, '$ROOT'); from access_adapter.version import __version__; print(__version__)")"
PKG="game-night-access-adapter_${VERSION}_amd64"
STAGING="/tmp/${PKG}"
DEBIAN="$STAGING/DEBIAN"
APP_ROOT="$STAGING/opt/game-night-access-adapter"

rm -rf "$STAGING"
mkdir -p "$DEBIAN" "$APP_ROOT" \
  "$STAGING/usr/bin" \
  "$STAGING/usr/share/applications" \
  "$STAGING/etc/xdg/autostart"

rsync -a \
  --exclude '__pycache__' \
  --exclude '*.pyc' \
  "$ROOT/access_adapter/" "$APP_ROOT/access_adapter/"
cp "$ROOT/requirements.txt" "$APP_ROOT/"
bash "$ROOT/packaging/fetch-platform-tools.sh" linux "$APP_ROOT/platform-tools"
cp "$SCRIPT_DIR/game-night-access-adapter.desktop" \
  "$STAGING/usr/share/applications/game-night-access-adapter.desktop"
cp "$SCRIPT_DIR/game-night-access-adapter-autostart.desktop" \
  "$STAGING/etc/xdg/autostart/game-night-access-adapter.desktop"

cat > "$STAGING/usr/bin/game-night-access-adapter" << 'LAUNCHER'
#!/bin/sh
export PYTHONPATH="/opt/game-night-access-adapter${PYTHONPATH:+:$PYTHONPATH}"
export PATH="/opt/game-night-access-adapter/platform-tools:$PATH"
if [ -x /opt/game-night-access-adapter/venv/bin/python ]; then
  exec /opt/game-night-access-adapter/venv/bin/python -m access_adapter "$@"
fi
exec /usr/bin/python3 -m access_adapter "$@"
LAUNCHER
chmod 755 "$STAGING/usr/bin/game-night-access-adapter"

cat > "$APP_ROOT/README.txt" << 'README'
Game Night Access Adapter
=========================
Menu: Game Night Access Adapter
Command: game-night-access-adapter

The window shows live phone tilt, rest-pose calibration, and sensor-to-key mappings.
adb is included at /opt/game-night-access-adapter/platform-tools.

Local API (while the app is running):
  curl http://127.0.0.1:8765/api/v1/health

Login autostart file:
  /etc/xdg/autostart/game-night-access-adapter.desktop
Remove that file to stop the app opening at login.

Settings for each user:
  ~/.config/game-night-access-adapter/config.json
README

cat > "$DEBIAN/control" << EOF
Package: game-night-access-adapter
Version: ${VERSION}
Section: utils
Priority: optional
Architecture: amd64
Depends: python3 (>= 3.10), python3-venv, python3-pip, libglib2.0-0, libgl1, libegl1, libxkbcommon0, libfontconfig1, libdbus-1-3
Recommends: android-sdk-platform-tools-common
Maintainer: Game Night Access Adapter <access@localhost>
Description: Map phone sensors to keyboard input
 Desktop application and loopback API for accessible game controls.
 Installed under /opt/game-night-access-adapter with a per-user login autostart entry.
 Ships Android platform-tools (adb). Uses an isolated Python virtual environment.
EOF

cat > "$DEBIAN/postinst" << 'POSTINST'
#!/bin/sh
set -e
INSTALL_ROOT="/opt/game-night-access-adapter"
VENV="$INSTALL_ROOT/venv"

echo "Creating Python virtual environment and installing dependencies..."
rm -rf "$VENV"
python3 -m venv "$VENV"
"$VENV/bin/pip" install -q --upgrade pip
"$VENV/bin/pip" install -q -r "$INSTALL_ROOT/requirements.txt"
chmod -R a+rX "$VENV"
echo "Game Night Access Adapter installed."
echo "  Open it from the application menu, or run: game-night-access-adapter"
echo "  Local API: http://127.0.0.1:8765/api/v1/health"
POSTINST
chmod 755 "$DEBIAN/postinst"

cat > "$DEBIAN/prerm" << 'PRERM'
#!/bin/sh
set -e
exit 0
PRERM
chmod 755 "$DEBIAN/prerm"

cat > "$DEBIAN/postrm" << 'POSTRM'
#!/bin/sh
set -e
if [ "$1" = "purge" ]; then
  rm -rf /opt/game-night-access-adapter
fi
POSTRM
chmod 755 "$DEBIAN/postrm"

OUT_DIR="${1:-$ROOT/dist/installers}"
mkdir -p "$OUT_DIR"
dpkg-deb --build "$STAGING" "$OUT_DIR/${PKG}.deb"
echo "Built $OUT_DIR/${PKG}.deb"
