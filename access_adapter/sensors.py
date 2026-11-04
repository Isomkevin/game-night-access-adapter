"""Read accelerometer and gyroscope samples from one ADB device.

The phone does not need a companion app. ``adb shell dumpsys sensorservice``
prints the newest samples the system already recorded. Pass a ``runner`` in
tests to avoid calling ``adb``.
"""

from __future__ import annotations

import re
import subprocess
import time
from typing import Callable

from access_adapter.adb_devices import AdbResult, CommandResult, validate_serial
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
    accel = _parse_named_events(dump, ("accelerometer: last", "accelerometer")) or (0.0, 0.0, 0.0)
    gyro = _parse_named_events(dump, ("gyroscope: last", "gyroscope", "gyro: last")) or (0.0, 0.0, 0.0)
    return SensorSample(
        ax=accel[0],
        ay=accel[1],
        az=accel[2],
        gx=gyro[0],
        gy=gyro[1],
        gz=gyro[2],
        source="dumpsys",
        ts=time.time(),
    )


class SensorReader:
    """One-shot reader for a selected ADB serial."""

    def __init__(self, serial: str, runner: Runner | None = None) -> None:
        self.serial = validate_serial(serial)
        self._runner = runner or _run_adb

    def read_once(self) -> SensorSample:
        try:
            result = self._runner(["-s", self.serial, "shell", "dumpsys", "sensorservice"])
        except FileNotFoundError as exc:
            raise RuntimeError("adb is not installed or not on PATH") from exc
        if result.returncode != 0:
            detail = f"{result.stdout or ''}{result.stderr or ''}".strip()
            raise RuntimeError(detail or "dumpsys sensorservice failed")
        return parse_dumpsys(result.stdout or "")


def _parse_named_events(dump: str, name_hints: tuple[str, ...]) -> tuple[float, float, float] | None:
    lines = dump.splitlines()
    for index, line in enumerate(lines):
        lower = line.strip().lower()
        if not any(hint in lower for hint in name_hints):
            continue
        if "last" not in lower and not lower.rstrip().endswith(":"):
            continue
        for follow in lines[index + 1 : index + 40]:
            match = _EVENT_RE.search(follow)
            if match:
                return float(match.group(2)), float(match.group(3)), float(match.group(4))
            if follow and not follow.startswith((" ", "\t")) and ":" in follow:
                break
    return None


def _run_adb(args: list[str]) -> AdbResult:
    proc = subprocess.run(
        ["adb", *args],
        capture_output=True,
        text=True,
        timeout=12,
        check=False,
    )
    return AdbResult(proc.returncode, proc.stdout or "", proc.stderr or "")
