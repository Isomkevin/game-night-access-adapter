"""Main window. Live 3D phone tilt is the primary screen."""

from __future__ import annotations

from PySide6.QtCore import Qt, QTimer
from PySide6.QtGui import QColor
from PySide6.QtWidgets import (
    QCheckBox,
    QDialog,
    QDoubleSpinBox,
    QFrame,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QMainWindow,
    QMessageBox,
    QPushButton,
    QScrollArea,
    QSizePolicy,
    QSplitter,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from access_adapter.state import AppState
from access_adapter.ui.devices_dialog import DeviceDialog
from access_adapter.ui.flow import FlowPanel
from access_adapter.ui.mapping_dialog import MappingDialog
from access_adapter.ui.phone_view import PhoneTiltView, tilt_from_sample
from access_adapter.ui.style import COMPARATOR_LABELS, STYLESHEET
from access_adapter.version import APP_NAME

COMPACT_WIDTH = 980


class MainWindow(QMainWindow):
    def __init__(self, state: AppState) -> None:
        super().__init__()
        self.state = state
        self._loading = False
        self.setWindowTitle(APP_NAME)
        self.resize(1180, 760)
        self.setMinimumSize(640, 520)
        self.setStyleSheet(STYLESHEET)
        self._compact: bool | None = None
        self._live_stamp: tuple | None = None
        self._chip_active: dict[str, bool] = {}
        self._running_chrome: bool | None = None

        brand = QLabel("GAME NIGHT")
        brand.setObjectName("brand")
        self.status_pill = QLabel("STOPPED")
        self.status_pill.setObjectName("statusPill")
        self.status_pill.setAlignment(Qt.AlignmentFlag.AlignCenter)

        heading = FlowPanel(spacing=12)
        heading.addWidget(brand)
        heading.addWidget(self.status_pill)

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
        self.calibrate_button = QPushButton("Calibrate rest pose")
        self.calibrate_button.setAccessibleName("Calibrate rest pose")
        self.calibrate_button.clicked.connect(self.calibrate_rest_pose)
        self.clear_calibrate_button = QPushButton("Clear calibration")
        self.clear_calibrate_button.clicked.connect(self.clear_calibration)

        self.injection = QCheckBox("Send keys to the focused window")
        self.injection.setChecked(state.config.injection_enabled)
        self.injection.toggled.connect(self._save_options)

        toolbar = FlowPanel(spacing=10)
        toolbar.addWidget(self.bridge_button)
        toolbar.addWidget(self.device_button)

        self.phone_view = PhoneTiltView()
        live_title = QLabel("Live tilt")
        live_title.setObjectName("cardTitle")
        self.angle_badge = QLabel("0.0° Roll  |  0.0° Pitch")
        self.angle_badge.setObjectName("monoBadge")
        phone_head = QHBoxLayout()
        phone_head.setSpacing(12)
        phone_head.addWidget(live_title)
        phone_head.addWidget(self.angle_badge)
        phone_head.addStretch(1)
        cal_row = FlowPanel(spacing=10)
        cal_row.addWidget(self.calibrate_button)
        cal_row.addWidget(self.clear_calibrate_button)
        self.chip_left = QLabel("←  Left  [A]")
        self.chip_fwd = QLabel("↑  Forward  [W]")
        self.chip_right = QLabel("→  Right  [D]")
        self.chip_back = QLabel("↓  Back  [S]")
        chips = FlowPanel(spacing=12)
        for chip in (self.chip_left, self.chip_fwd, self.chip_right, self.chip_back):
            chip.setObjectName("keyChip")
            chip.setAlignment(Qt.AlignmentFlag.AlignCenter)
            chip.setMinimumWidth(110)
            chips.addWidget(chip)

        phone_card = QFrame()
        phone_card.setObjectName("card")
        phone_layout = QVBoxLayout(phone_card)
        phone_layout.setContentsMargins(24, 22, 24, 22)
        phone_layout.setSpacing(16)
        phone_layout.addLayout(phone_head)
        phone_layout.addWidget(cal_row)
        phone_layout.addWidget(self.phone_view, stretch=1)
        phone_layout.addWidget(chips)

        map_title = QLabel("Sensor mappings")
        map_title.setObjectName("cardTitle")
        self.table = QTableWidget(0, 4)
        self.table.setObjectName("mappingTable")
        self.table.setHorizontalHeaderLabels(["Action", "When", "Keys", "On"])
        self.table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.table.setSelectionMode(QTableWidget.SelectionMode.SingleSelection)
        self.table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self.table.verticalHeader().setVisible(False)
        self.table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self.table.setAccessibleName("Sensor mappings")
        self.table.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAsNeeded)
        self.table.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        self.table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        for column in (2, 3):
            self.table.horizontalHeader().setSectionResizeMode(column, QHeaderView.ResizeMode.ResizeToContents)
        self.table.cellDoubleClicked.connect(lambda *_: self.edit_mapping())

        map_buttons = FlowPanel(spacing=8)
        map_buttons.addWidget(self.add_button)
        map_buttons.addWidget(self.edit_button)
        map_buttons.addWidget(self.remove_button)

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

        options = FlowPanel(spacing=12)
        options.addWidget(self.injection)
        options.addWidget(self.single_axis)
        options.addWidget(QLabel("Dominance"))
        options.addWidget(self.dominance)
        options.addWidget(self.invert_x)
        options.addWidget(self.invert_y)

        map_card = QFrame()
        map_card.setObjectName("card")
        map_layout = QVBoxLayout(map_card)
        map_layout.setContentsMargins(24, 22, 24, 22)
        map_layout.setSpacing(16)
        map_layout.addWidget(map_title)
        map_layout.addWidget(map_buttons)
        map_layout.addWidget(self.table, stretch=1)
        map_layout.addWidget(options)

        phone_card.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        map_card.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        self.split = QSplitter(Qt.Orientation.Horizontal)
        self.split.addWidget(phone_card)
        self.split.addWidget(map_card)
        self.split.setChildrenCollapsible(False)
        self.split.setStretchFactor(0, 5)
        self.split.setStretchFactor(1, 4)
        self.split.setSizes([640, 500])

        self.live = QLabel(self._live_text())
        self.live.setObjectName("telemetry")
        self.live.setWordWrap(True)
        self.live.setAccessibleName("Live sensors")

        top = QFrame()
        top.setObjectName("topBar")
        top_layout = QVBoxLayout(top)
        top_layout.setContentsMargins(24, 16, 24, 16)
        top_layout.setSpacing(12)
        top_layout.addWidget(heading)
        top_layout.addWidget(toolbar)

        root = QWidget()
        root.setMinimumWidth(600)
        layout = QVBoxLayout(root)
        layout.setContentsMargins(0, 0, 0, 10)
        layout.setSpacing(12)
        layout.addWidget(top)
        stage = QWidget()
        stage_layout = QVBoxLayout(stage)
        stage_layout.setContentsMargins(20, 8, 20, 8)
        stage_layout.setSpacing(16)
        stage_layout.addWidget(self.split, stretch=1)
        layout.addWidget(stage, stretch=1)
        live_wrap = QWidget()
        live_wrap_layout = QVBoxLayout(live_wrap)
        live_wrap_layout.setContentsMargins(24, 0, 24, 8)
        live_wrap_layout.addWidget(self.live)
        layout.addWidget(live_wrap)

        scroller = QScrollArea()
        scroller.setWidgetResizable(True)
        scroller.setFrameShape(QFrame.Shape.NoFrame)
        scroller.setWidget(root)
        scroller.setAlignment(Qt.AlignmentFlag.AlignTop)
        self.setCentralWidget(scroller)
        self._apply_responsive_layout()
        self._timer = QTimer(self)
        self._timer.setInterval(33)
        self._timer.timeout.connect(self.refresh_live)
        self._timer.start()
        self.statusBar().showMessage(self._status_text())
        self.reload()

    def reload(self) -> None:
        rules = self.state.config.rules
        self.table.setRowCount(len(rules))
        for row, rule in enumerate(rules):
            when = (
                f"{rule.sensor[:5]} {rule.axis} "
                f"{COMPARATOR_LABELS.get(rule.comparator, rule.comparator)} {rule.threshold:.2f}"
            )
            values = [
                rule.label,
                when,
                "+".join(rule.keys),
                "yes" if rule.enabled else "no",
            ]
            for column, value in enumerate(values):
                item = QTableWidgetItem(value)
                if column == 0:
                    item.setData(Qt.ItemDataRole.UserRole, rule.id)
                self.table.setItem(row, column, item)
        self._live_stamp = None
        self._chip_active.clear()
        self.refresh_live()

    def refresh_live(self) -> None:
        sensors = self.state.sensors_dict()
        cfg = self.state.config
        stamp = (
            sensors["sample"]["ts"],
            tuple(sensors["active_keys"]),
            sensors["bridge_running"],
            sensors["bridge_error"],
            cfg.selected_serial,
            cfg.injection_enabled,
            cfg.offset_ax,
            cfg.offset_ay,
            cfg.offset_az,
        )
        if stamp == self._live_stamp:
            return
        self._live_stamp = stamp
        self._refresh_phone(sensors)
        self.live.setText(self._live_text(sensors))
        self.statusBar().showMessage(self._status_text())
        self._refresh_chips_and_rows()

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

    def calibrate_rest_pose(self) -> None:
        try:
            self.state.calibrate_rest_pose()
        except ValueError as exc:
            QMessageBox.information(self, APP_NAME, str(exc))
        self.refresh_live()

    def clear_calibration(self) -> None:
        self.state.clear_calibration()
        self.refresh_live()

    def resizeEvent(self, event) -> None:  # noqa: N802 — Qt override
        super().resizeEvent(event)
        self._apply_responsive_layout()

    def closeEvent(self, event) -> None:  # noqa: N802 — Qt override
        if self.state.bridge is not None:
            self.state.bridge.stop()
        self._timer.stop()
        super().closeEvent(event)

    def _apply_responsive_layout(self) -> None:
        compact = self.width() < COMPACT_WIDTH
        if compact == self._compact:
            return
        self._compact = compact
        self.split.setOrientation(Qt.Orientation.Vertical if compact else Qt.Orientation.Horizontal)
        height = max(self.height(), 520)
        width = max(self.width(), 640)
        if compact:
            self.split.setSizes([max(240, height // 2), max(240, height // 2)])
        else:
            self.split.setSizes([int(width * 0.55), int(width * 0.45)])

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

    def _refresh_phone(self, sensors: dict | None = None) -> None:
        sensors = sensors if sensors is not None else self.state.sensors_dict()
        sample = sensors["sample"]
        cfg = self.state.config
        roll, pitch = tilt_from_sample(
            sample["ax"],
            sample["ay"],
            offset_ax=cfg.offset_ax,
            offset_ay=cfg.offset_ay,
            invert_x=cfg.invert_x,
            invert_y=cfg.invert_y,
        )
        self.phone_view.set_pose(
            roll,
            pitch,
            sensors["active_keys"],
            reading=sensors["bridge_running"],
            error=sensors["bridge_error"],
        )
        self.angle_badge.setText(f"{roll:+.1f}° Roll  |  {pitch:+.1f}° Pitch")

    def _set_chip(self, name: str, chip: QLabel, active: bool) -> None:
        if self._chip_active.get(name) == active:
            return
        self._chip_active[name] = active
        chip.setProperty("active", active)
        chip.style().unpolish(chip)
        chip.style().polish(chip)

    def _refresh_chips_and_rows(self) -> None:
        keys = set(self.state.active_keys)
        self._set_chip("left", self.chip_left, bool(keys & {"a", "left"}))
        self._set_chip("fwd", self.chip_fwd, bool(keys & {"w", "up"}))
        self._set_chip("right", self.chip_right, bool(keys & {"d", "right"}))
        self._set_chip("back", self.chip_back, bool(keys & {"s", "down"}))
        active_green = QColor("#123326")
        idle = QColor("#141b22")
        for row, rule in enumerate(self.state.config.rules):
            hit = bool(keys) and all(key in keys for key in rule.keys)
            for column in range(self.table.columnCount()):
                item = self.table.item(row, column)
                if item is not None:
                    item.setBackground(active_green if hit else idle)

    def _set_running_chrome(self, running: bool) -> None:
        if self._running_chrome == running:
            return
        self._running_chrome = running
        self.bridge_button.setText("Stop reading" if running else "Start reading")
        self.bridge_button.setProperty("running", running)
        self.bridge_button.style().unpolish(self.bridge_button)
        self.bridge_button.style().polish(self.bridge_button)
        self.status_pill.setText("READING" if running else "STOPPED")
        self.status_pill.setProperty("reading", running)
        self.status_pill.style().unpolish(self.status_pill)
        self.status_pill.style().polish(self.status_pill)

    def _live_text(self, sensors: dict | None = None) -> str:
        sensors = sensors if sensors is not None else self.state.sensors_dict()
        sample = sensors["sample"]
        keys = ", ".join(sensors["active_keys"]) or "none"
        verb = "Holding" if sensors["injection_enabled"] and sensors["bridge_running"] else "Matched"
        state = "reading" if sensors["bridge_running"] else "stopped"
        error = f"   {sensors['bridge_error']}" if sensors["bridge_error"] else ""
        self._set_running_chrome(bool(sensors["bridge_running"]))
        cfg = self.state.config
        if cfg.is_calibrated():
            rest = (
                f"Rest offset ({cfg.offset_ax:.2f}, {cfg.offset_ay:.2f}, {cfg.offset_az:.2f})   "
            )
        else:
            rest = "Rest offset none   "
        return (
            f"Sensors {state}.   "
            f"Accel ({sample['ax']:.2f}, {sample['ay']:.2f}, {sample['az']:.2f})   "
            f"Gyro ({sample['gx']:.2f}, {sample['gy']:.2f}, {sample['gz']:.2f})   "
            f"{rest}"
            f"{verb}: {keys}{error}"
        )

    def _status_text(self) -> str:
        serial = self.state.config.selected_serial or "no phone selected"
        base = getattr(self.state, "api_base_url", "") or ""
        api = f"   API {base}/api/v1" if base else ""
        sending = "sending keys" if self.state.config.injection_enabled else "keys paused"
        return f"Phone: {serial}   {sending}{api}"
