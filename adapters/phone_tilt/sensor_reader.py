"""Android motion-sensor reader for the phone-tilt adapter.

Primary path
------------
Poll ``adb shell dumpsys sensorservice`` and parse the newest accelerometer /
gyroscope ring-buffer events. No companion APK required. Update rate is limited
by dumpsys cost (fine for coarse tilt steering).

Optional path
-------------
If ``SENSOR_WS_URL``, ``SENSOR_WS_ACCEL``, or ``SENSOR_WS_GYRO`` is set, connect
to a SensorServer-style WebSocket for higher-rate samples, with dumpsys fallback
on failure.

Typical usage::

    reader = SensorReader(interval=0.07)
    reader.start()
    sample = reader.sample  # SensorSample
    reader.stop()
"""

from __future__ import annotations

import os
import re
import subprocess
import threading
import time
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class SensorSample:
    ax: float = 0.0
    ay: float = 0.0
    az: float = 0.0
    gx: float = 0.0
    gy: float = 0.0
    gz: float = 0.0
    ts: float = field(default_factory=time.time)
    source: str = "none"


# Recent events look like:
#   1 (ts=123.456, wall=13:37:01.234) 0.12, 9.81, 0.03,
_EVENT_RE = re.compile(
    r"\(\s*ts=([0-9.]+).*?\)\s*"
    r"([-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?\d+)?)\s*,\s*"
    r"([-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?\d+)?)\s*,\s*"
    r"([-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?\d+)?)"
)


def _adb(*args: str, timeout: float = 8.0) -> str:
    proc = subprocess.run(
        ["adb", *args],
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
    )
    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "").strip()
        raise RuntimeError(err or f"adb failed: adb {' '.join(args)}")
    return proc.stdout


def ensure_device() -> str:
    out = _adb("devices")
    online: list[str] = []
    for ln in out.splitlines()[1:]:
        parts = ln.split()
        if len(parts) >= 2 and parts[1] == "device":
            online.append(parts[0])
    if not online:
        raise RuntimeError(
            "No ADB device online. Run ./connect_phone.sh and pair with the 6-digit code."
        )
    return online[0]


def _parse_named_events(dump: str, name_hints: tuple[str, ...]) -> Optional[tuple[float, float, float]]:
    """Find the newest (first listed) 3-axis event under a matching sensor name header."""
    lines = dump.splitlines()
    for i, line in enumerate(lines):
        lower = line.strip().lower()
        if not any(h in lower for h in name_hints):
            continue
        if "last" not in lower and not lower.rstrip().endswith(":"):
            continue
        for j in range(i + 1, min(i + 40, len(lines))):
            m = _EVENT_RE.search(lines[j])
            if m:
                return float(m.group(2)), float(m.group(3)), float(m.group(4))
            if lines[j] and not lines[j].startswith((" ", "\t")) and ":" in lines[j]:
                break
    return None


def read_dumpsys_once() -> SensorSample:
    dump = _adb("shell", "dumpsys", "sensorservice", timeout=12.0)
    sample = SensorSample(source="dumpsys", ts=time.time())

    accel = _parse_named_events(dump, ("accelerometer: last",))
    if not accel:
        accel = _parse_named_events(dump, ("accelerometer",))
    gyro = _parse_named_events(dump, ("gyroscope: last",))
    if not gyro:
        gyro = _parse_named_events(dump, ("gyroscope", "gyro: last"))

    if accel:
        sample.ax, sample.ay, sample.az = accel
    if gyro:
        sample.gx, sample.gy, sample.gz = gyro
    return sample


class SensorReader:
    """Background poller that keeps the latest SensorSample."""

    def __init__(self, interval: float = 0.08):
        self.interval = interval
        self._lock = threading.Lock()
        self._sample = SensorSample()
        self._error: Optional[str] = None
        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self.device: Optional[str] = None

    @property
    def sample(self) -> SensorSample:
        with self._lock:
            s = self._sample
            return SensorSample(
                ax=s.ax, ay=s.ay, az=s.az,
                gx=s.gx, gy=s.gy, gz=s.gz,
                ts=s.ts, source=s.source,
            )

    @property
    def error(self) -> Optional[str]:
        return self._error

    def start(self) -> None:
        self.device = ensure_device()
        self._stop.clear()
        self._thread = threading.Thread(target=self._loop, name="sensor-reader", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)

    def _loop(self) -> None:
        if os.environ.get("SENSOR_WS_URL") or os.environ.get("SENSOR_WS_ACCEL"):
            try:
                self._ws_loop()
                return
            except Exception as exc:  # noqa: BLE001
                self._error = f"WebSocket failed ({exc}); falling back to dumpsys"

        try:
            _adb("shell", "settings", "put", "system", "accelerometer_rotation", "1", timeout=5)
        except Exception:
            pass

        while not self._stop.is_set():
            t0 = time.time()
            try:
                sample = read_dumpsys_once()
                with self._lock:
                    self._sample = sample
                self._error = None
            except Exception as exc:  # noqa: BLE001
                self._error = str(exc)
            elapsed = time.time() - t0
            self._stop.wait(max(0.01, self.interval - elapsed))

    def _ws_loop(self) -> None:
        import json

        from websocket import create_connection

        url = os.environ.get("SENSOR_WS_URL", "").strip()
        accel_url = os.environ.get("SENSOR_WS_ACCEL", url).strip()
        gyro_url = os.environ.get("SENSOR_WS_GYRO", "").strip()
        if not gyro_url and "accelerometer" in accel_url:
            gyro_url = accel_url.replace("accelerometer", "gyroscope")

        ax = ay = az = gx = gy = gz = 0.0

        def listen(u: str, kind: str) -> None:
            nonlocal ax, ay, az, gx, gy, gz
            ws = create_connection(u, timeout=5)
            try:
                while not self._stop.is_set():
                    raw = ws.recv()
                    data = json.loads(raw)
                    if isinstance(data, list) and len(data) >= 3:
                        x, y, z = float(data[0]), float(data[1]), float(data[2])
                        if kind == "accel":
                            ax, ay, az = x, y, z
                        else:
                            gx, gy, gz = x, y, z
                        with self._lock:
                            self._sample = SensorSample(
                                ax=ax, ay=ay, az=az, gx=gx, gy=gy, gz=gz,
                                source="websocket", ts=time.time(),
                            )
                        self._error = None
            finally:
                ws.close()

        threads = [threading.Thread(target=listen, args=(accel_url, "accel"), daemon=True)]
        if gyro_url:
            threads.append(threading.Thread(target=listen, args=(gyro_url, "gyro"), daemon=True))
        for t in threads:
            t.start()
        while not self._stop.is_set():
            time.sleep(0.1)


if __name__ == "__main__":
    r = SensorReader(interval=0.1)
    r.start()
    print(f"Reading from {r.device} … Ctrl+C to stop")
    try:
        while True:
            s = r.sample
            print(
                f"acc=({s.ax:7.3f},{s.ay:7.3f},{s.az:7.3f}) "
                f"gyro=({s.gx:7.3f},{s.gy:7.3f},{s.gz:7.3f}) "
                f"[{s.source}] err={r.error}"
            )
            time.sleep(0.15)
    except KeyboardInterrupt:
        r.stop()
