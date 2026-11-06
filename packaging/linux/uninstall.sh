#!/bin/bash
# Remove the installed application files. Per-user settings under
# ~/.config/game-night-access-adapter are left in place.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo $0"
  exit 1
fi

rm -f /usr/bin/game-night-access-adapter
rm -f /usr/share/applications/game-night-access-adapter.desktop
rm -f /etc/xdg/autostart/game-night-access-adapter.desktop
rm -rf /opt/game-night-access-adapter
echo "Game Night Access Adapter uninstalled."
echo "User settings remain in ~/.config/game-night-access-adapter/"
