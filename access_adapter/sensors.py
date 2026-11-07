"""Read accelerometer and gyroscope samples from one ADB device.

The phone does not need a companion app. ``adb shell dumpsys sensorservice``
prints the newest samples the system already recorded. Pass a ``runner`` in
tests to avoid calling ``adb``.
"""

from __future__ import annotations

import re
import subprocess
import time
from typing import Callable, TextIO

from access_adapter.adb_devices import (
    AdbResult,
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

Runner = Callable[[list[str]], CommandResult]


def parse_dumpsys(dump: str) -> SensorSample:
    """Pull the newest accelerometer and gyroscope triple out of a dumpsys blob."""
    accel, gyro = _parse_motion_events(dump.splitlines())
    return SensorSample(
        ax=accel[0] if accel else 0.0,
        ay=accel[1] if accel else 0.0,
        az=accel[2] if accel else 0.0,
        gx=gyro[0] if gyro else 0.0,
        gy=gyro[1] if gyro else 0.0,
        gz=gyro[2] if gyro else 0.0,
        source="dumpsys",
        ts=time.time(),
    )


class SensorReader:
    """One-shot reader for a selected ADB serial."""

    def __init__(self, serial: str, runner: Runner | None = None) -> None:
        self.serial = validate_serial(serial)
        self._runner = runner

    def read_once(self) -> SensorSample:
        try:
            if self._runner is not None:
                result = self._runner(["-s", self.serial, "shell", "dumpsys", "sensorservice"])
                if result.returncode != 0:
                    detail = f"{result.stdout or ''}{result.stderr or ''}".strip()
                    raise RuntimeError(detail or "dumpsys sensorservice failed")
                return parse_dumpsys(result.stdout or "")
            return _read_streaming(self.serial)
        except FileNotFoundError as exc:
            raise RuntimeError(
                "adb is not installed. Reinstall Game Night Access Adapter "
                "(it includes platform-tools) or put adb on PATH"
            ) from exc

    def close(self) -> None:
        return None


def _parse_motion_events(lines) -> tuple[tuple[float, float, float] | None, tuple[float, float, float] | None]:
    accel = None
    gyro = None
    looking = ""
    follows = 0
    for line in lines:
        if looking:
            match = _EVENT_RE.search(line)
            if match:
                triple = (float(match.group(2)), float(match.group(3)), float(match.group(4)))
                if looking == "accel":
                    accel = triple
                else:
                    gyro = triple
                looking = ""
                if accel is not None and gyro is not None:
                    break
                continue
            follows -= 1
            if follows <= 0 or (line.strip() and not line.startswith((" ", "\t")) and ":" in line):
                looking = ""
            continue
        lower = line.strip().lower()
        if "uncalibrated" in lower:
            continue
        if accel is None and "accelerometer" in lower and ("last" in lower or lower.endswith(":")):
            looking = "accel"
            follows = 8
        elif gyro is None and "gyro" in lower and ("last" in lower or lower.endswith(":")):
            looking = "gyro"
            follows = 8
    return accel, gyro


def _read_streaming(serial: str) -> SensorSample:
    """Stop the dumpsys stream as soon as accel and gyro last-events appear."""
    proc = subprocess.Popen(
        [adb_executable(), "-s", serial, "exec-out", "dumpsys", "sensorservice"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
        **hidden_subprocess_kwargs(),
    )
    stdout: TextIO | None = proc.stdout
    try:
        if stdout is None:
            raise RuntimeError("dumpsys sensorservice failed")
        accel = None
        gyro = None
        looking = ""
        follows = 0
        collected: list[str] = []
        for line in stdout:
            collected.append(line)
            if looking:
                match = _EVENT_RE.search(line)
                if match:
                    triple = (float(match.group(2)), float(match.group(3)), float(match.group(4)))
                    if looking == "accel":
                        accel = triple
                    else:
                        gyro = triple
                    looking = ""
                    if accel is not None and gyro is not None:
                        break
                    continue
                follows -= 1
                if follows <= 0 or (line.strip() and not line.startswith((" ", "\t")) and ":" in line):
                    looking = ""
                continue
            lower = line.strip().lower()
            if "uncalibrated" in lower:
                continue
            if accel is None and "accelerometer" in lower and ("last" in lower or lower.endswith(":")):
                looking = "accel"
                follows = 8
            elif gyro is None and "gyro" in lower and ("last" in lower or lower.endswith(":")):
                looking = "gyro"
                follows = 8
            if len(collected) > 12000:
                break
        if accel is None and gyro is None:
            accel, gyro = _parse_motion_events(collected)
        return SensorSample(
            ax=accel[0] if accel else 0.0,
            ay=accel[1] if accel else 0.0,
            az=accel[2] if accel else 0.0,
            gx=gyro[0] if gyro else 0.0,
            gy=gyro[1] if gyro else 0.0,
            gz=gyro[2] if gyro else 0.0,
            source="dumpsys",
            ts=time.time(),
        )
    finally:
        if proc.poll() is None:
            proc.kill()
            try:
                proc.wait(timeout=2)
            except subprocess.TimeoutExpired:
                pass
        elif proc.returncode not in (0, None) and proc.returncode < 0:
            pass
