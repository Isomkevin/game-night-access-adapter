"""Phase 7: rest-pose calibration subtracts how the phone sits at rest."""

import json
from urllib.request import Request, urlopen

import pytest

from access_adapter.api import ApiService
from access_adapter.config import AppConfig, config_from_dict, load_config, save_config
from access_adapter.mapping import SensorSample, active_key_names, default_rules
from access_adapter.state import AppState
from access_adapter.ui.main_window import MainWindow


def test_rest_offset_makes_current_tilt_neutral():
    keys = active_key_names(
        default_rules(),
        SensorSample(ax=-4.0),
        offset_ax=-4.0,
        axis_dominance=1.0,
    )
    assert keys == []


def test_tilt_is_relative_to_rest_pose():
    keys = active_key_names(
        default_rules(),
        SensorSample(ax=-1.0),
        offset_ax=3.0,
        axis_dominance=1.0,
    )
    assert keys == ["a"]


def test_offsets_round_trip(tmp_path):
    path = tmp_path / "config.json"
    save_config(AppConfig(offset_ax=1.25, offset_ay=-0.5, offset_az=9.6), path)
    loaded = load_config(path)
    assert loaded.offset_ax == 1.25
    assert loaded.offset_ay == -0.5
    assert loaded.offset_az == 9.6
    assert loaded.is_calibrated() is True
    assert config_from_dict({}).is_calibrated() is False


def test_calibrate_uses_last_sample(tmp_path):
    state = AppState(config_path=tmp_path / "config.json")
    state.note_sample(SensorSample(ax=1.5, ay=-0.25, az=9.4, source="dumpsys"))
    settings = state.calibrate_rest_pose()
    assert settings["offset_ax"] == 1.5
    assert settings["offset_ay"] == -0.25
    assert settings["offset_az"] == 9.4
    assert state.active_keys == []
    state.note_sample(SensorSample(ax=1.5 - 4.0, ay=-0.25, az=9.4, source="dumpsys"))
    assert state.active_keys == ["a"]
    state.clear_calibration()
    assert state.config.offset_ax == 0.0
    assert state.active_keys == []


def test_calibrate_without_sample_is_rejected(tmp_path):
    state = AppState(config_path=tmp_path / "config.json")
    with pytest.raises(ValueError, match="sensor reading"):
        state.calibrate_rest_pose()


def test_api_calibrate_and_reset(tmp_path):
    state = AppState(config_path=tmp_path / "config.json")
    service = ApiService(state, port=0)
    service.start()
    try:
        request = Request(
            service.base_url + "/api/v1/calibrate",
            data=json.dumps({"ax": 2.0, "ay": -1.0, "az": 9.1}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(request) as response:
            body = json.loads(response.read().decode("utf-8"))
        assert body["data"]["offset_ax"] == 2.0
        assert body["data"]["offset_ay"] == -1.0
        request = Request(
            service.base_url + "/api/v1/calibrate/reset",
            data=b"{}",
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(request) as response:
            reset = json.loads(response.read().decode("utf-8"))
        assert reset["data"]["offset_ax"] == 0.0
        assert reset["data"]["offset_ay"] == 0.0
    finally:
        service.stop()


def test_window_calibrate_button(qapp, tmp_path):
    state = AppState(config_path=tmp_path / "config.json")
    window = MainWindow(state)
    state.note_sample(SensorSample(ax=0.8, ay=0.2, az=9.5, source="test"))
    window.calibrate_rest_pose()
    assert state.config.offset_ax == 0.8
    window.refresh_live()
    assert "Rest offset (0.80, 0.20, 9.50)" in window.live.text()
    window.clear_calibration()
    assert "Rest offset none" in window.live.text()
    window.close()


def test_window_calibrate_without_sample_explains(qapp, tmp_path, monkeypatch):
    shown: list[str] = []
    monkeypatch.setattr(
        "access_adapter.ui.main_window.QMessageBox.information",
        lambda *_args: shown.append("shown"),
    )
    state = AppState(config_path=tmp_path / "config.json")
    window = MainWindow(state)
    window.calibrate_rest_pose()
    assert shown == ["shown"]
    assert state.config.offset_ax == 0.0
    window.close()
