"""Main window. The sensor mapping table is the primary screen."""

from __future__ import annotations

from PySide6.QtCore import Qt, QTimer
from PySide6.QtWidgets import (
    QCheckBox,
    QDialog,
    QDoubleSpinBox,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QMainWindow,
    QMessageBox,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from access_adapter.state import AppState
from access_adapter.ui.devices_dialog import DeviceDialog
from access_adapter.ui.mapping_dialog import MappingDialog
from access_adapter.ui.style import COMPARATOR_LABELS, STYLESHEET
from access_adapter.version import APP_NAME


class MainWindow(QMainWindow):
    def __init__(self, state: AppState) -> None:
        super().__init__()
        self.state = state
        self._loading = False
        self.setWindowTitle(APP_NAME)
        self.resize(980, 680)
        self.setStyleSheet(STYLESHEET)

        title = QLabel("Sensor mappings")
        title.setObjectName("title")
        hint = QLabel(
            "Each row holds a key combination while that phone sensor stays past the threshold. "
            "Focus the game window before tilting. This window does not need to stay in front."
        )
        hint.setWordWrap(True)
        hint.setObjectName("hint")

        self.add_button = QPushButton("Add mapping")
        self.add_button.clicked.connect(self.add_mapping)
        self.edit_button = QPushButton("Edit")
        self.edit_button.clicked.connect(self.edit_mapping)
        self.remove_button = QPushButton("Remove")
        self.remove_button.clicked.connect(self.remove_selected)
        self.device_button = QPushButton("Add device")
        self.device_button.setObjectName("addDeviceButton")
        self.device_button.clicked.connect(self.add_device)
        self.bridge_button = QPushButton("Start reading")
        self.bridge_button.setObjectName("bridgeButton")
        self.bridge_button.clicked.connect(self.toggle_bridge)

        self.injection = QCheckBox("Send keys to the focused window")
        self.injection.setChecked(state.config.injection_enabled)
        self.injection.toggled.connect(self._save_options)

        buttons = QHBoxLayout()
        buttons.addWidget(self.add_button)
        buttons.addWidget(self.edit_button)
        buttons.addWidget(self.remove_button)
        buttons.addStretch(1)
        buttons.addWidget(self.device_button)
        buttons.addWidget(self.bridge_button)

        self.table = QTableWidget(0, 7)
        self.table.setObjectName("mappingTable")
        self.table.setHorizontalHeaderLabels(
            ["Label", "Sensor", "Axis", "Condition", "Threshold", "Keys", "Enabled"]
        )
        self.table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.table.setSelectionMode(QTableWidget.SelectionMode.SingleSelection)
        self.table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self.table.verticalHeader().setVisible(False)
        self.table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self.table.setAccessibleName("Sensor mappings")
        self.table.cellDoubleClicked.connect(lambda *_: self.edit_mapping())

        self.single_axis = QCheckBox("Only the strongest mapping at a time")
        self.single_axis.setChecked(state.config.single_axis_only)
        self.single_axis.toggled.connect(self._save_options)
        self.dominance = QDoubleSpinBox()
        self.dominance.setRange(1.0, 5.0)
        self.dominance.setSingleStep(0.05)
        self.dominance.setDecimals(2)
        self.dominance.setValue(state.config.axis_dominance)
        self.dominance.setAccessibleName("Axis dominance")
        self.dominance.valueChanged.connect(self._save_options)
        self.invert_x = QCheckBox("Invert X")
        self.invert_x.setChecked(state.config.invert_x)
        self.invert_x.toggled.connect(self._save_options)
        self.invert_y = QCheckBox("Invert Y")
        self.invert_y.setChecked(state.config.invert_y)
        self.invert_y.toggled.connect(self._save_options)

        options = QHBoxLayout()
        options.addWidget(self.injection)
        options.addWidget(self.single_axis)
        options.addWidget(QLabel("Dominance"))
        options.addWidget(self.dominance)
        options.addWidget(self.invert_x)
        options.addWidget(self.invert_y)
        options.addStretch(1)

        self.live = QLabel(self._live_text())
        self.live.setObjectName("muted")
        self.live.setWordWrap(True)
        self.live.setAccessibleName("Live sensors")

        root = QWidget()
        layout = QVBoxLayout(root)
        layout.addWidget(title)
        layout.addWidget(hint)
        layout.addLayout(buttons)
        layout.addWidget(self.table, stretch=1)
        layout.addLayout(options)
        layout.addWidget(self.live)
        self.setCentralWidget(root)
        self._timer = QTimer(self)
        self._timer.setInterval(200)
        self._timer.timeout.connect(self.refresh_live)
        self._timer.start()
        self.statusBar().showMessage(self._status_text())
        self.reload()

    def reload(self) -> None:
        rules = self.state.config.rules
        self.table.setRowCount(len(rules))
        for row, rule in enumerate(rules):
            values = [
                rule.label,
                rule.sensor,
                rule.axis,
                COMPARATOR_LABELS.get(rule.comparator, rule.comparator),
                f"{rule.threshold:.2f}",
                "+".join(rule.keys),
                "yes" if rule.enabled else "no",
            ]
            for column, value in enumerate(values):
                item = QTableWidgetItem(value)
                if column == 0:
                    item.setData(Qt.ItemDataRole.UserRole, rule.id)
                self.table.setItem(row, column, item)
        self.refresh_live()

    def refresh_live(self) -> None:
        self.live.setText(self._live_text())
        self.statusBar().showMessage(self._status_text())

    def add_mapping(self) -> None:
        dialog = MappingDialog(parent=self)
        if dialog.exec() != QDialog.DialogCode.Accepted:
            return
        self.add_mapping_from_payload(dialog.payload())

    def add_mapping_from_payload(self, payload: dict) -> None:
        self.state.add_mapping(payload)
        self.reload()

    def edit_mapping(self) -> None:
        rule_id = self._selected_rule_id()
        if not rule_id:
            return
        rule = next(item for item in self.state.config.rules if item.id == rule_id)
        dialog = MappingDialog(rule, parent=self)
        if dialog.exec() != QDialog.DialogCode.Accepted:
            return
        self.state.update_mapping(rule_id, dialog.payload())
        self.reload()

    def remove_selected(self) -> None:
        rule_id = self._selected_rule_id()
        if not rule_id:
            return
        self.state.delete_mapping(rule_id)
        self.reload()

    def toggle_bridge(self) -> None:
        bridge = self.state.ensure_bridge()
        try:
            if self.state.bridge_running:
                bridge.stop()
            else:
                bridge.start()
        except RuntimeError as exc:
            self.state.bridge_error = str(exc)
        self.refresh_live()

    def add_device(self) -> None:
        dialog = DeviceDialog(self.state, parent=self)
        dialog.exec()
        self.refresh_live()

    def closeEvent(self, event) -> None:  # noqa: N802 — Qt override
        if self.state.bridge is not None:
            self.state.bridge.stop()
        self._timer.stop()
        super().closeEvent(event)

    def _selected_rule_id(self) -> str:
        row = self.table.currentRow()
        if row < 0:
            QMessageBox.information(self, APP_NAME, "Select a mapping first.")
            return ""
        item = self.table.item(row, 0)
        if item is None:
            return ""
        return str(item.data(Qt.ItemDataRole.UserRole) or "")

    def _save_options(self, *_args) -> None:
        if self._loading:
            return
        self.state.update_settings(
            {
                "injection_enabled": self.injection.isChecked(),
                "single_axis_only": self.single_axis.isChecked(),
                "axis_dominance": float(self.dominance.value()),
                "invert_x": self.invert_x.isChecked(),
                "invert_y": self.invert_y.isChecked(),
            }
        )
        self.refresh_live()

    def _live_text(self) -> str:
        sensors = self.state.sensors_dict()
        sample = sensors["sample"]
        keys = ", ".join(sensors["active_keys"]) or "none"
        verb = "Holding" if sensors["injection_enabled"] and sensors["bridge_running"] else "Matched"
        state = "reading" if sensors["bridge_running"] else "stopped"
        error = f"   {sensors['bridge_error']}" if sensors["bridge_error"] else ""
        self.bridge_button.setText("Stop reading" if sensors["bridge_running"] else "Start reading")
        return (
            f"Sensors {state}.   "
            f"Accel ({sample['ax']:.2f}, {sample['ay']:.2f}, {sample['az']:.2f})   "
            f"Gyro ({sample['gx']:.2f}, {sample['gy']:.2f}, {sample['gz']:.2f})   "
            f"{verb}: {keys}{error}"
        )

    def _status_text(self) -> str:
        serial = self.state.config.selected_serial or "no phone selected"
        base = getattr(self.state, "api_base_url", "") or ""
        api = f"   API {base}/api/v1" if base else ""
        sending = "sending keys" if self.state.config.injection_enabled else "keys paused"
        return f"Phone: {serial}   {sending}{api}"
