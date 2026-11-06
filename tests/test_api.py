"""Phase 3: localhost API for mappings, settings, and device scan."""

import json
from urllib.request import Request, urlopen

import pytest

from access_adapter.adb_devices import AdbResult
from access_adapter.api import ApiService, assert_bind_host
from access_adapter.state import AppState
from tests.test_adb_devices import ScriptedAdb


def _client(tmp_path, script: ScriptedAdb | None = None) -> tuple[ApiService, AppState]:
    state = AppState(config_path=tmp_path / "config.json", adb=_adb(script))
    service = ApiService(state, port=0)
    service.start()
    return service, state


def _adb(script: ScriptedAdb | None):
    from access_adapter.adb_devices import AdbClient

    if script is None:
        script = ScriptedAdb({("devices", "-l"): AdbResult(0, "List of devices attached\n", "")})
    return AdbClient(script)


def _request(service: ApiService, method: str, path: str, payload: dict | None = None):
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"} if data is not None else {}
    request = Request(service.base_url + path, data=data, headers=headers, method=method)
    with urlopen(request) as response:
        return response.status, json.loads(response.read().decode("utf-8"))


def test_health_and_default_mappings(tmp_path):
    service, _state = _client(tmp_path)
    try:
        status, body = _request(service, "GET", "/api/v1/health")
        assert status == 200
        assert body["data"]["status"] == "ok"
        status, body = _request(service, "GET", "/api/v1/mappings")
        assert [rule["id"] for rule in body["data"]["rules"]] == [
            "tilt-left",
            "tilt-right",
            "tilt-forward",
            "tilt-back",
        ]
    finally:
        service.stop()


def test_replace_mapping_persists(tmp_path):
    service, state = _client(tmp_path)
    try:
        rules = state.mappings_dict()["rules"]
        rules[0]["keys"] = ["left"]
        status, body = _request(service, "PUT", "/api/v1/mappings", {"rules": rules})
        assert status == 200
        assert body["data"]["rules"][0]["keys"] == ["left"]
        saved = json.loads((tmp_path / "config.json").read_text(encoding="utf-8"))
        assert saved["rules"][0]["keys"] == ["left"]
    finally:
        service.stop()


def test_add_and_delete_mapping(tmp_path):
    service, _state = _client(tmp_path)
    try:
        status, body = _request(
            service,
            "POST",
            "/api/v1/mappings",
            {
                "label": "Face up",
                "sensor": "accelerometer",
                "axis": "z",
                "comparator": "gt",
                "threshold": 8,
                "keys": "space",
            },
        )
        assert status == 201
        rule_id = body["data"]["id"]
        status, body = _request(service, "DELETE", f"/api/v1/mappings/{rule_id}")
        assert body["data"]["deleted"] == rule_id
    finally:
        service.stop()


def test_scan_connect_and_select(tmp_path):
    script = ScriptedAdb(
        {
            ("devices", "-l"): AdbResult(
                0,
                "List of devices attached\n192.168.1.8:5555\tdevice\nUSB123\tdevice\n",
                "",
            ),
            ("mdns", "services"): AdbResult(
                0,
                "adb-phone\t_adb-tls-connect._tcp\t192.168.1.8:5555\n",
                "",
            ),
            ("connect", "10.1.1.1:5555"): AdbResult(0, "connected to 10.1.1.1:5555\n", ""),
        }
    )
    # connect triggers another scan
    script.responses[("devices", "-l")] = AdbResult(
        0,
        "List of devices attached\n192.168.1.8:5555\tdevice\nUSB123\tdevice\n",
        "",
    )
    service, _state = _client(tmp_path, script)
    try:
        _status, body = _request(service, "POST", "/api/v1/devices/scan")
        transports = {item["serial"]: item["transport"] for item in body["data"]["devices"]}
        assert transports["192.168.1.8:5555"] == "wireless"
        assert transports["USB123"] == "usb"
        assert body["data"]["wireless"][0]["kind"] == "connect"
        _request(service, "POST", "/api/v1/devices/select", {"serial": "USB123"})
        _status, body = _request(service, "GET", "/api/v1/devices")
        assert body["data"]["selected_serial"] == "USB123"
        _status, body = _request(service, "POST", "/api/v1/devices/connect", {"endpoint": "10.1.1.1:5555"})
        assert "connected" in body["data"]["message"]
    finally:
        service.stop()


def test_invalid_connect_is_400(tmp_path):
    service, _state = _client(tmp_path)
    try:
        request = Request(
            service.base_url + "/api/v1/devices/connect",
            data=json.dumps({"endpoint": "not-an-endpoint"}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with pytest.raises(Exception) as caught:
            urlopen(request)
        assert getattr(caught.value, "code", None) == 400
    finally:
        service.stop()


def test_injection_toggle(tmp_path):
    service, state = _client(tmp_path)
    try:
        _status, body = _request(service, "POST", "/api/v1/injection", {"enabled": False})
        assert body["data"]["injection_enabled"] is False
        assert state.config.injection_enabled is False
    finally:
        service.stop()


def test_unknown_route_is_404(tmp_path):
    service, _state = _client(tmp_path)
    try:
        request = Request(service.base_url + "/api/v1/missing", method="GET")
        with pytest.raises(Exception) as caught:
            urlopen(request)
        assert getattr(caught.value, "code", None) == 404
    finally:
        service.stop()


def test_loopback_guard():
    assert assert_bind_host("127.0.0.1") == "127.0.0.1"
    assert assert_bind_host("localhost") == "127.0.0.1"
    with pytest.raises(ValueError):
        assert_bind_host("0.0.0.0")
