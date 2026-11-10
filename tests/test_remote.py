"""Voice control: other local programs press a mapping's keys through the API."""

import json
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import pytest

from access_adapter.api import ApiService
from access_adapter.keys import KeyInjector
from access_adapter.remote import RemotePresses
from access_adapter.state import AppState
from tests.test_api import _adb
from tests.test_keys import FakeKeyboard


class Clock:
    def __init__(self) -> None:
        self.now = 100.0

    def __call__(self) -> float:
        return self.now


def _remote(tmp_path):
    state = AppState(config_path=tmp_path / "config.json", adb=_adb(None))
    board = FakeKeyboard()
    clock = Clock()
    remote = RemotePresses(state, KeyInjector(controller=board), lease_seconds=2.5, clock=clock)
    state.remote = remote
    return state, remote, board, clock


def test_down_holds_mapping_keys_until_up(tmp_path):
    _state, remote, board, _clock = _remote(tmp_path)
    result = remote.press("tilt-forward", "down")
    assert result["keys"] == ["w"]
    remote.press("tilt-forward", "down")
    assert board.pressed == ["w"]
    remote.press("tilt-forward", "up")
    assert board.released == ["w"]
    assert remote.held_mappings() == []


def test_hold_expires_without_refresh(tmp_path):
    _state, remote, board, clock = _remote(tmp_path)
    remote.press("tilt-left", "down")
    clock.now += 2.0
    remote.press("tilt-left", "down")
    clock.now += 2.0
    remote.expire()
    assert board.released == []
    clock.now += 1.0
    remote.expire()
    assert board.released == ["a"]


def test_pulse_taps_and_unknown_mapping_is_rejected(tmp_path):
    _state, remote, board, _clock = _remote(tmp_path)
    remote.press("tilt-back", "pulse")
    assert board.pressed == ["s"] and board.released == ["s"]
    with pytest.raises(KeyError):
        remote.press("nope", "down")
    with pytest.raises(ValueError):
        remote.press("tilt-back", "sideways")


def test_turning_injection_off_releases_voice_holds(tmp_path):
    state, remote, board, _clock = _remote(tmp_path)
    remote.press("tilt-right", "down")
    state.update_settings({"injection_enabled": False})
    assert board.released == ["d"]


def _post(service, path, payload, origin=None):
    headers = {"Content-Type": "application/json"}
    if origin:
        headers["Origin"] = origin
    request = Request(service.base_url + path, data=json.dumps(payload).encode(), headers=headers, method="POST")
    try:
        with urlopen(request) as response:
            return response.status, json.loads(response.read())
    except HTTPError as exc:
        return exc.code, json.loads(exc.read())


def test_press_endpoint_respects_injection_switch_and_origin(tmp_path):
    state, _remote_presses, board, _clock = _remote(tmp_path)
    service = ApiService(state, port=0)
    service.start()
    try:
        state.update_settings({"injection_enabled": False})
        status, body = _post(service, "/api/v1/press", {"mapping": "tilt-forward", "state": "down"})
        assert status == 409 and body["error"]["code"] == "INJECTION_OFF"

        state.update_settings({"injection_enabled": True})
        status, body = _post(service, "/api/v1/press", {"mapping": "tilt-forward", "state": "down"},
                             origin="https://evil.example")
        assert status == 403
        assert board.pressed == []

        status, body = _post(service, "/api/v1/press", {"mapping": "tilt-forward", "state": "down"},
                             origin="chrome-extension://abcdefghijklmnop")
        assert status == 200
        assert body["data"]["keys"] == ["w"] and body["data"]["held"] == ["tilt-forward"]

        status, body = _post(service, "/api/v1/press/release-all", {})
        assert status == 200 and board.released == ["w"]

        status, body = _post(service, "/api/v1/press", {"mapping": "missing", "state": "pulse"})
        assert status == 404
    finally:
        service.stop()
