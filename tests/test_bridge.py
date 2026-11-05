"""Phase 5: dumpsys samples drive key injection through the bridge and the API."""

import json
import time
from urllib.request import Request, urlopen

from access_adapter.adb_devices import AdbResult
from access_adapter.api import ApiService
from access_adapter.bridge import SensorBridge
from access_adapter.keys import KeyInjector
from access_adapter.mapping import SensorSample
from access_adapter.sensors import SensorReader, parse_dumpsys
from access_adapter.state import AppState
from tests.test_keys import FakeKeyboard


DUMP = """
Accelerometer: last 50 events
  1 (ts=10.5, wall=12:00:00.000) -3.25, 0.50, 9.20,
Gyroscope: last 50 events
  1 (ts=10.5, wall=12:00:00.000) 0.10, -0.20, 0.30,
"""


class FixedReader:
    def __init__(self, sample: SensorSample) -> None:
        self.sample = sample
        self.calls = 0

    def read_once(self) -> SensorSample:
        self.calls += 1
        return self.sample


def test_parse_dumpsys_reads_accel_and_gyro():
    sample = parse_dumpsys(DUMP)
    assert sample.ax == -3.25
    assert sample.ay == 0.50
    assert sample.az == 9.20
    assert (sample.gx, sample.gy, sample.gz) == (0.10, -0.20, 0.30)
    assert sample.source == "dumpsys"


def test_parse_dumpsys_reads_filtered_phone_output():
    dump = """
ICM42632M Gyroscope Uncalibrated: last 50 events
	 1 (ts=1.0, wall=12:00:00.000) 9.0, 9.0, 9.0,
ICM42632M Gyroscope: last 50 events
	 1 (ts=1.0, wall=12:00:00.000) 0.10, -0.20, 0.30,
ICM42632M Accelerometer: last 50 events
	 1 (ts=1.0, wall=12:00:00.000) -3.25, 0.50, 9.20,
"""
    sample = parse_dumpsys(dump)
    assert sample.ax == -3.25
    assert (sample.gx, sample.gy, sample.gz) == (0.10, -0.20, 0.30)


def test_reader_targets_the_selected_serial():
    seen: list[list[str]] = []

    def runner(args: list[str]) -> AdbResult:
        seen.append(args)
        return AdbResult(0, DUMP, "")

    sample = SensorReader("USB999", runner=runner).read_once()
    assert seen == [["-s", "USB999", "shell", "dumpsys", "sensorservice"]]
    assert sample.ax == -3.25


def test_apply_sample_presses_and_releases_with_injection_flag(tmp_path):
    state = AppState(config_path=tmp_path / "config.json")
    board = FakeKeyboard()
    bridge = SensorBridge(state, injector=KeyInjector(controller=board))
    keys = bridge.apply_sample(SensorSample(ax=-5, source="test"))
    assert keys == ["a"]
    assert bridge.injector.held_names == ["a"]

    state.update_settings({"injection_enabled": False})
    bridge.apply_sample(SensorSample(ax=-5, source="test"))
    assert bridge.injector.held_names == []
    assert state.active_keys == ["a"]


def test_start_reads_until_stop(tmp_path):
    state = AppState(config_path=tmp_path / "config.json")
    state.config.poll_interval = 0.05
    state.select_device("USB1")
    reader = FixedReader(SensorSample(ax=-5, source="test"))
    bridge = SensorBridge(
        state,
        injector=KeyInjector(controller=FakeKeyboard()),
        reader_factory=lambda _serial: reader,
    )
    bridge.start()
    try:
        deadline = time.time() + 1.5
        while bridge.injector.held_names != ["a"] and time.time() < deadline:
            time.sleep(0.05)
        assert bridge.injector.held_names == ["a"]
        assert reader.calls >= 1
    finally:
        bridge.stop()
    assert bridge.injector.held_names == []
    assert state.bridge_running is False


def test_api_start_and_stop(tmp_path):
    state = AppState(config_path=tmp_path / "config.json")
    state.config.poll_interval = 0.05
    state.select_device("USB1")
    state.bridge = SensorBridge(
        state,
        injector=KeyInjector(controller=FakeKeyboard()),
        reader_factory=lambda _serial: FixedReader(SensorSample(ay=-5, source="test")),
    )
    service = ApiService(state, port=0)
    service.start()
    try:
        request = Request(service.base_url + "/api/v1/bridge/start", data=b"{}", method="POST")
        with urlopen(request) as response:
            body = json.loads(response.read().decode("utf-8"))
        assert body["data"]["bridge_running"] is True
        deadline = time.time() + 1.5
        while time.time() < deadline:
            with urlopen(service.base_url + "/api/v1/sensors") as response:
                sensors = json.loads(response.read().decode("utf-8"))["data"]
            if sensors["active_keys"] == ["w"]:
                break
            time.sleep(0.05)
        assert sensors["active_keys"] == ["w"]
        request = Request(service.base_url + "/api/v1/bridge/stop", data=b"{}", method="POST")
        with urlopen(request) as response:
            stopped = json.loads(response.read().decode("utf-8"))
        assert stopped["data"]["bridge_running"] is False
    finally:
        service.stop()
        state.bridge.stop()


def test_window_reports_missing_phone(qapp, tmp_path):
    from access_adapter.ui.main_window import MainWindow

    state = AppState(config_path=tmp_path / "config.json")
    window = MainWindow(state)
    window.toggle_bridge()
    assert "Select a phone first" in window.live.text()
    window.close()
