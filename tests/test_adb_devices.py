"""Phase 2: ADB scan classifies USB and wireless devices."""

import pytest

from access_adapter.adb_devices import (
    AdbClient,
    AdbResult,
    classify_transport,
    hidden_subprocess_kwargs,
    parse_devices_listing,
    parse_mdns_services,
    validate_endpoint,
    validate_pair_code,
)


LISTING = """
List of devices attached
R58M123ABC             device usb:1-2 product:a25x model:SM_A256E device:a25x transport_id:1
192.168.0.104:38667    device product:a25x model:SM_A256E device:a25x transport_id:2
emulator-5554          offline transport_id:3
adb-A1B2._adb-tls-connect._tcp    unauthorized
"""


def test_listing_marks_usb_and_wireless():
    devices = parse_devices_listing(LISTING)
    by_serial = {item.serial: item for item in devices}
    assert by_serial["R58M123ABC"].transport == "usb"
    assert by_serial["R58M123ABC"].state == "device"
    assert by_serial["R58M123ABC"].model == "SM A256E"
    assert by_serial["192.168.0.104:38667"].transport == "wireless"
    assert by_serial["emulator-5554"].transport == "usb"
    assert by_serial["emulator-5554"].state == "offline"
    assert by_serial["adb-A1B2._adb-tls-connect._tcp"].transport == "wireless"
    assert by_serial["adb-A1B2._adb-tls-connect._tcp"].state == "unauthorized"


def test_classify_transport():
    assert classify_transport("ABCDEF123") == "usb"
    assert classify_transport("10.0.0.8:5555") == "wireless"
    assert classify_transport("phone.local:37123") == "wireless"


def test_mdns_services_split_connect_and_pairing():
    text = """
List of discovered mdns services
adb-phone	_adb-tls-connect._tcp	192.168.0.104:38667
adb-phone	_adb-tls-pairing._tcp	192.168.0.104:37123
"""
    services = parse_mdns_services(text)
    assert [(item.kind, item.endpoint) for item in services] == [
        ("connect", "192.168.0.104:38667"),
        ("pairing", "192.168.0.104:37123"),
    ]


def test_endpoint_and_code_validation():
    assert validate_endpoint(" 192.168.1.9:5555 ") == "192.168.1.9:5555"
    assert validate_pair_code("123456") == "123456"
    with pytest.raises(ValueError):
        validate_endpoint("192.168.1.9")
    with pytest.raises(ValueError):
        validate_endpoint("192.168.1.9:99999")
    with pytest.raises(ValueError):
        validate_pair_code("12ab56")
    with pytest.raises(ValueError):
        validate_pair_code("12345")


class ScriptedAdb:
    def __init__(self, responses: dict[tuple[str, ...], AdbResult]) -> None:
        self.responses = responses
        self.calls: list[list[str]] = []

    def __call__(self, args: list[str]) -> AdbResult:
        self.calls.append(args)
        return self.responses[tuple(args)]


def test_scan_uses_devices_long():
    script = ScriptedAdb(
        {
            ("devices", "-l"): AdbResult(0, "List of devices attached\nABC123\tdevice\n", ""),
        }
    )
    devices = AdbClient(script).scan()
    assert script.calls == [["devices", "-l"]]
    assert devices[0].serial == "ABC123"
    assert devices[0].transport == "usb"


def test_connect_and_pair_pass_checked_arguments():
    script = ScriptedAdb(
        {
            ("connect", "10.0.0.5:5555"): AdbResult(0, "connected to 10.0.0.5:5555\n", ""),
            ("pair", "10.0.0.5:37123", "654321"): AdbResult(0, "Successfully paired\n", ""),
        }
    )
    client = AdbClient(script)
    assert "connected" in client.connect("10.0.0.5:5555")
    assert "paired" in client.pair("10.0.0.5:37123", "654321")


def test_connect_failure_raises_without_calling_shell():
    script = ScriptedAdb(
        {
            ("connect", "10.0.0.5:5555"): AdbResult(1, "", "failed to connect"),
        }
    )
    with pytest.raises(RuntimeError, match="failed to connect"):
        AdbClient(script).connect("10.0.0.5:5555")


def test_bad_endpoint_never_calls_adb():
    script = ScriptedAdb({})
    with pytest.raises(ValueError):
        AdbClient(script).connect("$(reboot)")
    assert script.calls == []


def test_missing_adb_is_reported():
    def runner(_args: list[str]) -> AdbResult:
        raise FileNotFoundError("adb")

    with pytest.raises(RuntimeError, match="not installed"):
        AdbClient(runner).scan()


def test_bundled_adb_is_preferred(tmp_path, monkeypatch):
    from access_adapter.adb_devices import adb_executable

    bundled = tmp_path / "platform-tools"
    bundled.mkdir()
    binary = bundled / "adb"
    binary.write_text("#!/bin/sh\n")
    binary.chmod(0o755)
    monkeypatch.setenv("GAME_NIGHT_INSTALL_ROOT", str(tmp_path))
    monkeypatch.delenv("GAME_NIGHT_ADB", raising=False)
    monkeypatch.setattr("access_adapter.adb_devices.os.name", "posix")
    assert adb_executable() == str(binary)


def test_hidden_subprocess_kwargs_hide_windows_consoles(monkeypatch):
    monkeypatch.setattr("access_adapter.adb_devices.os.name", "nt")
    kwargs = hidden_subprocess_kwargs()
    assert kwargs["creationflags"] == 0x08000000
    if "startupinfo" in kwargs:
        assert kwargs["startupinfo"].wShowWindow == 0
    monkeypatch.setattr("access_adapter.adb_devices.os.name", "posix")
    assert hidden_subprocess_kwargs() == {}


def test_mdns_failure_returns_no_services():
    script = ScriptedAdb({("mdns", "services"): AdbResult(1, "", "unknown command")})
    assert AdbClient(script).discover_wireless() == []
