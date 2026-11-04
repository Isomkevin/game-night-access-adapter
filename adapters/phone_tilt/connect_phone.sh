#!/usr/bin/env bash
# Pair + connect an Android phone over Wireless debugging (ADB).
set -euo pipefail

PYTHON="${PYTHON:-/home/elprocessor/.platformio/penv/bin/python3}"

echo "=== Wireless ADB connect ==="
echo
echo "On your phone:"
echo "  1. Settings → Developer options → Wireless debugging → ON"
echo "  2. Tap 'Pair device with pairing code'"
echo "  3. Note the IP:PORT and the 6-digit code"
echo

# Discover advertised connect endpoint (mDNS)
discover() {
  avahi-browse -rt _adb-tls-connect._tcp 2>/dev/null | awk '
    /address =/ { gsub(/[\[\]]/, "", $3); addr=$3 }
    /port =/ { port=$3 }
    /name=/ {
      if (match($0, /name=([^"]+)/, m)) name=m[1]
    }
    END {
      if (addr && port) print addr ":" port " " name
    }
  '
}

PAIR_INFO="${1:-}"
CONNECT_INFO="${2:-}"

if [[ -z "$PAIR_INFO" ]]; then
  read -rp "Pairing IP:PORT (from pairing dialog): " PAIR_INFO
fi
if [[ -z "${3:-}" ]]; then
  read -rp "6-digit pairing code: " PAIR_CODE
else
  PAIR_CODE="$3"
fi

echo "Pairing with $PAIR_INFO ..."
adb pair "$PAIR_INFO" "$PAIR_CODE"

if [[ -z "$CONNECT_INFO" ]]; then
  DISC="$(discover || true)"
  if [[ -n "$DISC" ]]; then
    CONNECT_INFO="${DISC%% *}"
    NAME="${DISC#* }"
    echo "Discovered device: ${NAME:-unknown} at $CONNECT_INFO"
  else
    read -rp "Connect IP:PORT (from Wireless debugging main screen): " CONNECT_INFO
  fi
fi

echo "Connecting to $CONNECT_INFO ..."
adb connect "$CONNECT_INFO"
adb devices -l
echo
echo "Done. From this directory run:"
echo "  python3 gyro_controller.py"
echo "Docs: ../../docs/phone-tilt-adapter.md"
