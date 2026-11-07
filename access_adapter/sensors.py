"""Read accelerometer and gyroscope samples from one ADB device.

The phone does not need a companion app. ``adb shell dumpsys sensorservice``
prints the newest samples the system already recorded. Pass a ``runner`` in
tests to avoid calling ``adb``.

This Xiaomi-class path keeps one ADB shell open and cuts the LIGHT flood so
USB debug does not wedge after a few seconds of 12 Hz reconnects. Frozen
rings are detected by a stuck event timestamp, not by LIGHT (which we skip).
"""

from __future__ import annotations

import math
import os
import re
import select
import subprocess
import time
from typing import Callable, IO

from access_adapter.adb_devices import (
    CommandResult,
    adb_executable,
    hidden_subprocess_kwargs,
    validate_serial,
)
from access_adapter.mapping import SensorSample


_EVENT_RE = re.compile(
    r"\(\s*ts=([0-9.]+).*?\)\s*"
    r"([-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?\d+)?)\s*,\s*"
    r"([-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?\d+)?)\s*,\s*"
    r"([-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?\d+)?)"
)
_SECTION_RE = re.compile(r"^(\S[^:]*): last \d+ events\s*$")
_G = 9.80665
_FRAME_END = "__GNAA_END__"
_PUMP_SCRIPT = (
    "set +e\n"
    "while true; do\n"
    "  dumpsys sensorservice 2>/dev/null | "
    "toybox sed '/^[Ll][Ii][Gg][Hh][Tt]: last /q'\n"
    f"  printf '\\n{_FRAME_END}\\n'\n"
    "  sleep 0.02\n"
    "done\n"
)
_LISTENER_ACTIVITIES = (
    "com.miui.compass/.CompassActivity",
    "com.huawei.compass/.CompassActivity",
    "com.samsung.android.app.compass/.CompassActivity",
)
_STALE_HOLD = 0.25
_WAKE_COOLDOWN = 2.0

Runner = Callable[[list[str]], CommandResult]


def parse_dumpsys(dump: str) -> SensorSample:
    """Pull the newest accelerometer and gyroscope triple out of a dumpsys blob."""
    sample, _event_ts = parse_dumpsys_with_event_ts(dump)
    return sample


def parse_dumpsys_with_event_ts(dump: str) -> tuple[SensorSample, float | None]:
    accel = None
    gyro = None
    gravity = None
    orientation = None
    kind = ""
    for line in dump.splitlines():
        header = _SECTION_RE.match(line.strip())
        if header:
            kind = _section_kind(header.group(1))
            continue
        if not kind:
            continue
        match = _EVENT_RE.search(line)
        if match is None:
            continue
        ts = float(match.group(1))
        triple = (
            float(match.group(2)),
            float(match.group(3)),
            float(match.group(4)),
        )
        sample = (ts, triple)
        if kind == "accel":
            accel = sample
        elif kind == "gyro":
            gyro = sample
        elif kind == "gravity":
            gravity = sample
        elif kind == "orientation":
            orientation = sample
    chosen, source, event_ts = _pick_motion(accel, gravity, orientation)
    return (
        SensorSample(
            ax=chosen[0] if chosen else 0.0,
            ay=chosen[1] if chosen else 0.0,
            az=chosen[2] if chosen else 0.0,
            gx=gyro[1][0] if gyro else 0.0,
            gy=gyro[1][1] if gyro else 0.0,
            gz=gyro[1][2] if gyro else 0.0,
            source=source,
            ts=time.time(),
        ),
        event_ts,
    )


class SensorReader:
    """One-shot reader for a selected ADB serial."""

    def __init__(self, serial: str, runner: Runner | None = None) -> None:
        self.serial = validate_serial(serial)
        self._runner = runner
        self._proc: subprocess.Popen[str] | None = None
        self._last_event_ts: float | None = None
        self._stuck_since: float | None = None
        self._last_wake = 0.0
        self._hard_wake = False

    def read_once(self) -> SensorSample:
        try:
            if self._runner is not None:
                result = self._runner(
                    ["-s", self.serial, "shell", "dumpsys", "sensorservice"]
                )
                if result.returncode != 0:
                    detail = f"{result.stdout or ''}{result.stderr or ''}".strip()
                    raise RuntimeError(detail or "dumpsys sensorservice failed")
                sample, _event_ts = parse_dumpsys_with_event_ts(result.stdout or "")
                return sample
            dump = self._next_dump()
            sample, event_ts = parse_dumpsys_with_event_ts(dump)
            if self._event_is_stuck(event_ts):
                _wake_motion_listener(self.serial, force_stop=self._hard_wake)
                self._hard_wake = True
                self._last_wake = time.monotonic()
                dump = self._next_dump()
                sample, event_ts = parse_dumpsys_with_event_ts(dump)
                self._note_event_ts(event_ts)
            return sample
        except FileNotFoundError as exc:
            raise RuntimeError(
                "adb is not installed. Reinstall Game Night Access Adapter "
                "(it includes platform-tools) or put adb on PATH"
            ) from exc

    def close(self) -> None:
        self._stop_pump()

    def _event_is_stuck(self, event_ts: float | None) -> bool:
        now = time.monotonic()
        if event_ts is None:
            stuck = True
        elif self._last_event_ts is None or event_ts != self._last_event_ts:
            self._last_event_ts = event_ts
            self._stuck_since = None
            self._hard_wake = False
            return False
        else:
            if self._stuck_since is None:
                self._stuck_since = now
            stuck = (now - self._stuck_since) >= _STALE_HOLD
        if stuck and (now - self._last_wake) < _WAKE_COOLDOWN:
            return False
        return stuck

    def _note_event_ts(self, event_ts: float | None) -> None:
        if event_ts is None or event_ts == self._last_event_ts:
            return
        self._last_event_ts = event_ts
        self._stuck_since = None
        self._hard_wake = False

    def _next_dump(self) -> str:
        self._ensure_pump()
        proc = self._proc
        if proc is None or proc.stdout is None:
            raise RuntimeError("sensor stream is not ready")
        lines: list[str] = []
        deadline = time.monotonic() + 4.0
        while time.monotonic() < deadline:
            line = _readline_deadline(proc.stdout, deadline)
            if line is None:
                break
            if line == "" and proc.poll() is not None:
                self._stop_pump()
                raise RuntimeError("adb sensor stream closed")
            if line.strip() == _FRAME_END:
                dump = "".join(lines)
                if "accelerometer" in dump.lower() or re.search(
                    r"^ORIENTATION: last ", dump, re.M
                ):
                    return dump
                break
            lines.append(line)
        self._stop_pump()
        raise RuntimeError("dumpsys sensorservice timed out")

    def _ensure_pump(self) -> None:
        proc = self._proc
        if proc is not None and proc.poll() is None:
            return
        self._stop_pump()
        self._proc = subprocess.Popen(
            [adb_executable(), "-s", self.serial, "exec-out", "sh", "-c", _PUMP_SCRIPT],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            **hidden_subprocess_kwargs(),
        )

    def _stop_pump(self) -> None:
        proc = self._proc
        self._proc = None
        if proc is None:
            return
        if proc.poll() is None:
            proc.kill()
            try:
                proc.wait(timeout=2)
            except subprocess.TimeoutExpired:
                pass


def _readline_deadline(stream: IO[str], deadline: float) -> str | None:
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        return None
    if os.name != "nt" and hasattr(stream, "fileno"):
        ready, _, _ = select.select([stream], [], [], remaining)
        if not ready:
            return None
    return stream.readline()


def _section_kind(name: str) -> str:
    n = name.strip().lower()
    if "uncal" in n:
        return ""
    if "device_orientation" in n.replace(" ", "_") or n.startswith("device orientation"):
        return ""
    if n == "orientation" or n.endswith(" orientation"):
        return "orientation"
    if "linear" in n:
        return ""
    if "accel" in n:
        return "accel"
    if "gravity" in n:
        return "gravity"
    if "gyro" in n:
        return "gyro"
    return ""


def _orientation_to_accel(pitch: float, roll: float) -> tuple[float, float, float]:
    pitch_r = math.radians(pitch)
    roll_r = math.radians(roll)
    ax = _G * math.sin(roll_r)
    ay = -_G * math.sin(pitch_r)
    az = _G * math.cos(pitch_r) * math.cos(roll_r)
    return ax, ay, az


def _pick_motion(
    accel: tuple[float, tuple[float, float, float]] | None,
    gravity: tuple[float, tuple[float, float, float]] | None,
    orientation: tuple[float, tuple[float, float, float]] | None,
) -> tuple[tuple[float, float, float] | None, str, float | None]:
    chosen: tuple[float, tuple[float, float, float]] | None = None
    source = "dumpsys"
    if accel is not None:
        chosen = accel
        source = "dumpsys"
    if gravity is not None and (chosen is None or gravity[0] >= chosen[0]):
        chosen = gravity
        source = "dumpsys"
    if orientation is not None and (chosen is None or orientation[0] > (chosen[0] + 0.5)):
        _azimuth, pitch, roll = orientation[1]
        return _orientation_to_accel(pitch, roll), "orientation", orientation[0]
    return (chosen[1] if chosen else None), source, (chosen[0] if chosen else None)


def _wake_motion_listener(serial: str, force_stop: bool = False) -> None:
    """Ask Android to keep writing motion samples, without reconnecting ADB."""
    adb = adb_executable()
    kwargs = hidden_subprocess_kwargs()
    try:
        subprocess.run(
            [adb, "-s", serial, "shell", "cmd", "statusbar", "collapse"],
            capture_output=True,
            text=True,
            timeout=4,
            **kwargs,
        )
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        pass
    start_args = ["am", "start"]
    if force_stop:
        start_args.append("-S")
    start_args.extend(["-n"])
    for component in _LISTENER_ACTIVITIES:
        try:
            completed = subprocess.run(
                [adb, "-s", serial, "shell", *start_args, component],
                capture_output=True,
                text=True,
                timeout=8,
                **kwargs,
            )
        except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
            continue
        text = f"{completed.stdout}{completed.stderr}"
        if completed.returncode == 0 and "Error" not in text and "Exception" not in text:
            time.sleep(0.35)
            return
