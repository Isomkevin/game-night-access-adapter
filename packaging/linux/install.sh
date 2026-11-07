#!/bin/bash
# Install from a source checkout into /opt and create the virtual environment.
# Usage: sudo ./install.sh [path-to-repository]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="${1:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
INSTALL_ROOT="/opt/game-night-access-adapter"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo $0"
  exit 1
fi

echo "Installing Game Night Access Adapter to $INSTALL_ROOT ..."
mkdir -p "$INSTALL_ROOT"
rm -rf "$INSTALL_ROOT/access_adapter"
cp -a "$SRC/access_adapter" "$INSTALL_ROOT/"
cp "$SRC/requirements.txt" "$INSTALL_ROOT/"

install -m 0755 /dev/stdin /usr/bin/game-night-access-adapter << 'LAUNCHER'
#!/bin/sh
export PYTHONPATH="/opt/game-night-access-adapter${PYTHONPATH:+:$PYTHONPATH}"
if [ -x /opt/game-night-access-adapter/venv/bin/python ]; then
  exec /opt/game-night-access-adapter/venv/bin/python -m access_adapter "$@"
fi
exec /usr/bin/python3 -m access_adapter "$@"
LAUNCHER

install -m 0644 "$SCRIPT_DIR/game-night-access-adapter.desktop" \
  /usr/share/applications/game-night-access-adapter.desktop
install -m 0644 "$SCRIPT_DIR/game-night-access-adapter-autostart.desktop" \
  /etc/xdg/autostart/game-night-access-adapter.desktop

python3 -m venv "$INSTALL_ROOT/venv"
"$INSTALL_ROOT/venv/bin/pip" install -q --upgrade pip
"$INSTALL_ROOT/venv/bin/pip" install -q -r "$INSTALL_ROOT/requirements.txt"
chmod -R a+rX "$INSTALL_ROOT/venv"

echo "Installed. Run: game-night-access-adapter"
echo "Local API: http://127.0.0.1:8765/api/v1/health"
