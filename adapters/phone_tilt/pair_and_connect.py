#!/usr/bin/env python3
"""One-shot wireless ADB pair + connect.

Usage:
  python pair_and_connect.py
  python pair_and_connect.py 192.168.0.104:37123 123456
  python pair_and_connect.py 192.168.0.104:37123 123456 192.168.0.104:38667
"""

from __future__ import annotations

import re
import subprocess
import sys
import time


def run(cmd: list[str]) -> subprocess.CompletedProcess:
    print("+", " ".join(cmd))
    return subprocess.run(cmd, text=True, capture_output=True)


def discover_connect() -> tuple[str, str] | tuple[None, None]:
    proc = run(["avahi-browse", "-rt", "_adb-tls-connect._tcp"])
    text = proc.stdout or ""
    addr = port = name = None
    for line in text.splitlines():
        if "address =" in line:
            m = re.search(r"\[([0-9.]+)\]", line)
            if m:
                addr = m.group(1)
        elif "port =" in line:
            m = re.search(r"\[(\d+)\]", line)
            if m:
                port = m.group(1)
        elif "name=" in line:
            m = re.search(r'name=([^"\]]+)', line)
            if m:
                name = m.group(1)
    if addr and port:
        return f"{addr}:{port}", name or "Android"
    return None, None


def main() -> int:
    pair_endpoint = sys.argv[1] if len(sys.argv) > 1 else None
    pair_code = sys.argv[2] if len(sys.argv) > 2 else None
    connect_endpoint = sys.argv[3] if len(sys.argv) > 3 else None

    print("Phone found on LAN via mDNS (Wireless debugging is ON).")
    disc, name = discover_connect()
    if disc:
        print(f"  advertised connect: {disc}  ({name})")

    print()
    print("On the phone open:")
    print("  Developer options → Wireless debugging → Pair device with pairing code")
    print()

    if not pair_endpoint:
        pair_endpoint = input("Pairing IP:PORT > ").strip()
    if not pair_code:
        pair_code = input("6-digit code > ").strip()

    p = run(["adb", "pair", pair_endpoint, pair_code])
    sys.stdout.write(p.stdout)
    sys.stderr.write(p.stderr)
    if p.returncode != 0:
        print("Pairing failed.")
        return 1

    if not connect_endpoint:
        time.sleep(0.5)
        disc, name = discover_connect()
        connect_endpoint = disc
        if not connect_endpoint:
            connect_endpoint = input("Connect IP:PORT (main Wireless debugging screen) > ").strip()
        else:
            print(f"Using discovered connect endpoint {connect_endpoint} ({name})")

    p = run(["adb", "connect", connect_endpoint])
    sys.stdout.write(p.stdout)
    sys.stderr.write(p.stderr)

    p = run(["adb", "devices", "-l"])
    sys.stdout.write(p.stdout)
    if "\tdevice" not in (p.stdout or "") and " device " not in (p.stdout or ""):
        # devices -l uses "device usb:..." or "device product:..."
        if not re.search(r"\sdevice\b", p.stdout or ""):
            print("Connected string missing — check Wireless debugging IP:port.")
            return 1

    print("\nReady. Start controller with:")
    print("  python3 gyro_controller.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
