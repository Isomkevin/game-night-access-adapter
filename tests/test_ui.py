"""Phase 4: main window lists mappings and Add device scans ADB."""

import os

import pytest

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

from access_adapter.adb_devices import AdbClient, AdbResult
from access_adapter.mapping import SensorSample
from access_adapter.state import AppState
from access_adapter.ui.devices_dialog import DeviceDialog
from access_adapter.ui.main_window import MainWindow
from access_adapter.ui.mapping_dialog import MappingDialog
from tests.test_adb_devices import ScriptedAdb


@pytest.fixture(scope="module")
def qapp():
    from PySide6.QtWidgets import QApplication

    return QApplication.instance() or QApplication([])


def test_main_window_lists_default_mappings(qapp, tmp_path):
    state = AppState(config_path=tmp_path / "config.json")
    window = MainWindow(state)
    assert window.table.rowCount() == 4
    assert window.table.item(0, 0).text() == "Steer left"
    assert window.table.item(0, 5).text() == "a"
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
    window.add_mapping_from_payload(dialog.payload())
    assert window.table.rowCount() == 5
    assert state.config.rules[-1].keys == ["ctrl", "space"]

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
    assert "Holding: a" in window.live.text()
    window.close()


def test_mapping_dialog_rejects_unknown_key(qapp):
    dialog = MappingDialog()
    dialog.label.setText("Nope")
    dialog.keys.setText("not-a-key")
    with pytest.raises(ValueError):
        dialog.payload()
    dialog.close()
