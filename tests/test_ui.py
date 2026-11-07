"""Phase 4: main window lists mappings and Add device scans ADB."""

import pytest

from access_adapter.adb_devices import AdbClient, AdbResult
from access_adapter.mapping import SensorSample
from access_adapter.state import AppState
from access_adapter.ui.devices_dialog import DeviceDialog
from access_adapter.ui.main_window import MainWindow
from access_adapter.ui.mapping_dialog import MappingDialog
from access_adapter.ui.phone_view import tilt_from_sample
from tests.test_adb_devices import ScriptedAdb


def test_main_window_lists_default_mappings(qapp, tmp_path):
    state = AppState(config_path=tmp_path / "config.json")
    window = MainWindow(state)
    assert window.table.rowCount() == 4
    assert window.table.item(0, 0).text() == "Steer left"
    assert window.table.item(0, 2).text() == "a"
    assert window.table.item(0, 3).text() == "Hold continuously"
    window.close()


def test_options_and_new_mapping_save(qapp, tmp_path):
    state = AppState(config_path=tmp_path / "config.json")
    window = MainWindow(state)
    window.dominance.setValue(1.25)
    window.invert_x.setChecked(True)
    assert state.config.axis_dominance == 1.25
    assert state.config.invert_x is True

    dialog = MappingDialog()
    dialog.label.setText("Boost")
    dialog.keys.setText("ctrl+space")
    dialog.sensor.setCurrentText("gyroscope")
    dialog.axis.setCurrentText("z")
    dialog.press_mode.setCurrentText("Type once")
    window.add_mapping_from_payload(dialog.payload())
    assert window.table.rowCount() == 5
    assert state.config.rules[-1].keys == ["ctrl", "space"]
    assert state.config.rules[-1].press_mode == "once"

    window.table.selectRow(4)
    window.remove_selected()
    assert window.table.rowCount() == 4
    window.close()


def test_add_device_scan_shows_usb_and_wireless(qapp, tmp_path):
    script = ScriptedAdb(
        {
            ("devices", "-l"): AdbResult(
                0,
                "List of devices attached\nUSB999\tdevice model:Pixel\n10.0.0.9:5555\tdevice\n",
                "",
            ),
            ("mdns", "services"): AdbResult(
                0,
                "adb-phone\t_adb-tls-pairing._tcp\t10.0.0.9:37123\n",
                "",
            ),
            ("connect", "10.0.0.9:5555"): AdbResult(0, "connected to 10.0.0.9:5555\n", ""),
        }
    )
    state = AppState(config_path=tmp_path / "config.json", adb=AdbClient(script))
    window = MainWindow(state)
    dialog = DeviceDialog(state)
    dialog.scan()
    assert dialog.table.rowCount() == 2
    assert dialog.table.item(0, 1).text() == "usb"
    assert dialog.table.item(1, 1).text() == "wireless"
    assert dialog.services.rowCount() == 1

    dialog.table.selectRow(0)
    dialog.use_selected()
    assert state.config.selected_serial == "USB999"
    window.refresh_live()
    assert "USB999" in window.statusBar().currentMessage()
    window.close()
    dialog.close()


def test_live_readout_follows_sample(qapp, tmp_path):
    state = AppState(config_path=tmp_path / "config.json")
    window = MainWindow(state)
    state.note_sample(SensorSample(ax=-4.0, source="test"))
    window.refresh_live()
    assert "Matched: a" in window.live.text()
    assert window.phone_view._target_roll < 0
    assert window.chip_left.property("active") is True
    window.close()


def test_tilt_from_sample_leans_left_and_respects_rest():
    roll, pitch = tilt_from_sample(-4.0, 0.0)
    assert roll < 0
    assert abs(pitch) < 1
    roll_rest, _pitch = tilt_from_sample(-4.0, 0.0, offset_ax=-4.0)
    assert abs(roll_rest) < 0.01
    flipped, _ = tilt_from_sample(-4.0, 0.0, invert_x=True)
    assert flipped > 0


def test_window_stacks_when_narrow(qapp, tmp_path):
    from PySide6.QtCore import Qt

    from access_adapter.ui.main_window import COMPACT_WIDTH

    state = AppState(config_path=tmp_path / "config.json")
    window = MainWindow(state)
    window.resize(1200, 800)
    window._apply_responsive_layout()
    assert window.split.orientation() == Qt.Orientation.Horizontal
    window.resize(COMPACT_WIDTH - 80, 700)
    window._apply_responsive_layout()
    assert window.split.orientation() == Qt.Orientation.Vertical
    window.resize(1280, 800)
    window._apply_responsive_layout()
    assert window.split.orientation() == Qt.Orientation.Horizontal
    window.close()


def test_mapping_dialog_rejects_unknown_key(qapp):
    dialog = MappingDialog()
    dialog.label.setText("Nope")
    dialog.keys.setText("not-a-key")
    with pytest.raises(ValueError):
        dialog.payload()
    dialog.close()
