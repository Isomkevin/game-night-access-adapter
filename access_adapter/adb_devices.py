"""List and connect Android devices over USB or wireless ADB.

``adb devices -l`` is the scan. A serial that is ``host:port`` or an
``adb-tls`` name is wireless; every other serial, including emulators, is USB.
Pairing and connect use ``adb pair`` / ``adb connect`` with checked arguments
so a bad form never reaches the tool.
"""

from __future__ import annotations

from dataclasses import dataclass
import os
import re
import subprocess
from typing import Any, Callable, Protocol


_ENDPOINT_RE = re.compile(r"^[A-Za-z0-9._-]+:([0-9]{1,5})$")
_SERIAL_RE = re.compile(r"^[A-Za-z0-9._:\-]+$")
_MDNS_RE = re.compile(
    r"^(?P<instance>\S+)\s+(?P<service>_adb-tls-(?P<kind>connect|pairing)\._tcp)\s+(?P<endpoint>\S+)\s*$"
)


class CommandResult(Protocol):
    returncode: int
    stdout: str
    stderr: str


@dataclass
class AdbResult:
    returncode: int
    stdout: str
    stderr: str


@dataclass(frozen=True)
class AdbDevice:
    serial: str
    state: str
    transport: str
    model: str = ""
    product: str = ""

    def to_dict(self) -> dict[str, str]:
        return {
            "serial": self.serial,
            "state": self.state,
            "transport": self.transport,
            "model": self.model,
            "product": self.product,
        }


@dataclass(frozen=True)
class WirelessService:
    """A phone advertising wireless debugging, not necessarily connected yet."""

    instance: str
    kind: str
    endpoint: str

    def to_dict(self) -> dict[str, str]:
        return {
            "instance": self.instance,
            "kind": self.kind,
            "endpoint": self.endpoint,
        }


Runner = Callable[[list[str]], CommandResult]


def classify_transport(serial: str) -> str:
    """Return ``wireless`` or ``usb`` for an ADB serial."""
    lowered = serial.lower()
    if "adb-tls" in lowered or "_adb-tls-" in lowered:
        return "wireless"
    if lowered.startswith("emulator-"):
        return "usb"
    if _ENDPOINT_RE.fullmatch(serial):
        return "wireless"
    return "usb"


def parse_devices_listing(text: str) -> list[AdbDevice]:
    """Parse ``adb devices`` or ``adb devices -l`` output."""
    devices: list[AdbDevice] = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.lower().startswith("list of devices"):
            continue
        if stripped.startswith("*") or stripped.startswith("adb "):
            continue
        parts = stripped.split()
        if len(parts) < 2:
            continue
        serial, state = parts[0], parts[1]
        if state not in {"device", "unauthorized", "offline", "authorizing", "recovery", "sideload"}:
            continue
        fields = _detail_fields(parts[2:])
        devices.append(
            AdbDevice(
                serial=serial,
                state=state,
                transport=classify_transport(serial),
                model=fields.get("model", "").replace("_", " "),
                product=fields.get("product", ""),
            )
        )
    return devices


def parse_mdns_services(text: str) -> list[WirelessService]:
    """Parse ``adb mdns services`` output."""
    found: list[WirelessService] = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.lower().startswith("list of"):
            continue
        match = _MDNS_RE.match(stripped)
        if not match:
            continue
        found.append(
            WirelessService(
                instance=match.group("instance"),
                kind=match.group("kind"),
                endpoint=match.group("endpoint"),
            )
        )
    return found


def validate_endpoint(endpoint: str) -> str:
    """Accept ``host:port`` and reject anything else."""
    cleaned = endpoint.strip()
    match = _ENDPOINT_RE.fullmatch(cleaned)
    if not match:
        raise ValueError("Endpoint must look like 192.168.1.20:5555")
    port = int(match.group(1))
    if not 1 <= port <= 65535:
        raise ValueError("Port must be between 1 and 65535")
    host = cleaned.rsplit(":", 1)[0]
    if not host or host.startswith("."):
        raise ValueError("Endpoint host is missing")
    return cleaned


def validate_pair_code(code: str) -> str:
    cleaned = code.strip()
    if not re.fullmatch(r"\d{6}", cleaned):
        raise ValueError("Pairing code must be 6 digits")
    return cleaned


def validate_serial(serial: str) -> str:
    cleaned = serial.strip()
    if not cleaned or not _SERIAL_RE.fullmatch(cleaned):
        raise ValueError("Device serial contains unsupported characters")
    return cleaned


class AdbClient:
    """Small ADB wrapper. Pass ``runner`` in tests to avoid a real ``adb``."""

    def __init__(self, runner: Runner | None = None) -> None:
        self._runner = runner or _run_adb
        self.last_message = ""

    def scan(self) -> list[AdbDevice]:
        result = self._invoke(["devices", "-l"])
        self.last_message = _combined(result).strip()
        if result.returncode != 0:
            raise RuntimeError(self.last_message or "adb devices failed")
        return parse_devices_listing(result.stdout)

    def discover_wireless(self) -> list[WirelessService]:
        """Phones advertising wireless debugging. Empty when mDNS is unavailable."""
        result = self._invoke(["mdns", "services"])
        self.last_message = _combined(result).strip()
        if result.returncode != 0:
            return []
        return parse_mdns_services(result.stdout)

    def connect(self, endpoint: str) -> str:
        target = validate_endpoint(endpoint)
        return self._expect_ok(["connect", target], "adb connect failed")

    def pair(self, endpoint: str, code: str) -> str:
        target = validate_endpoint(endpoint)
        pin = validate_pair_code(code)
        return self._expect_ok(["pair", target, pin], "adb pair failed")

    def disconnect(self, serial: str) -> str:
        target = validate_serial(serial)
        return self._expect_ok(["disconnect", target], "adb disconnect failed")

    def _expect_ok(self, args: list[str], fallback: str) -> str:
        result = self._invoke(args)
        text = _combined(result).strip()
        self.last_message = text
        lowered = text.lower()
        failed = result.returncode != 0 or "failed" in lowered or "cannot" in lowered or "error" in lowered
        if failed:
            raise RuntimeError(text or fallback)
        return text

    def _invoke(self, args: list[str]) -> CommandResult:
        try:
            return self._runner(args)
        except FileNotFoundError as exc:
            raise RuntimeError("adb is not installed or not on PATH") from exc


def _detail_fields(tokens: list[str]) -> dict[str, str]:
    fields: dict[str, str] = {}
    for token in tokens:
        if ":" not in token:
            continue
        key, value = token.split(":", 1)
        fields[key] = value
    return fields


def _combined(result: CommandResult) -> str:
    return f"{result.stdout or ''}{result.stderr or ''}"


def hidden_subprocess_kwargs() -> dict[str, Any]:
    """Keep ADB helper processes off the Windows desktop.

    Each sensor poll starts ``adb``. Without CREATE_NO_WINDOW, Windows opens a
    console for every sample and the desktop fills with windows.
    """
    if os.name != "nt":
        return {}
    flags = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)
    kwargs: dict[str, Any] = {"creationflags": flags}
    startupinfo_cls = getattr(subprocess, "STARTUPINFO", None)
    if startupinfo_cls is not None:
        startupinfo = startupinfo_cls()
        startupinfo.dwFlags |= getattr(subprocess, "STARTF_USESHOWWINDOW", 1)
        startupinfo.wShowWindow = 0
        kwargs["startupinfo"] = startupinfo
    return kwargs


def _run_adb(args: list[str]) -> AdbResult:
    proc = subprocess.run(
        ["adb", *args],
        capture_output=True,
        text=True,
        timeout=20,
        check=False,
        **hidden_subprocess_kwargs(),
    )
    return AdbResult(proc.returncode, proc.stdout or "", proc.stderr or "")
