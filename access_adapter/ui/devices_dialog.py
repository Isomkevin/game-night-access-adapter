"""Scan USB and wireless ADB devices and choose one."""

from __future__ import annotations

from PySide6.QtWidgets import (
    QDialog,
    QDialogButtonBox,
    QFrame,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QLineEdit,
    QPushButton,
    QScrollArea,
    QTabWidget,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from access_adapter.adb_devices import validate_endpoint
from access_adapter.state import AppState


class DeviceDialog(QDialog):
    """Add device: scan phones already visible to adb, or connect a wireless one."""

    def __init__(self, state: AppState, parent=None) -> None:
        super().__init__(parent)
        self.state = state
        self.setWindowTitle("Add device")
        self.resize(640, 560)
        self.setMinimumSize(480, 420)
        self.setSizeGripEnabled(True)
        self.chosen_serial = ""

        intro = QLabel("Plug in a USB phone, or pair wireless debugging, then select it.")
        intro.setWordWrap(True)
        intro.setObjectName("hint")

        self.message = QLabel("")
        self.message.setWordWrap(True)
        self.message.setObjectName("muted")

        self.scan_button = QPushButton("Scan")
        self.scan_button.setObjectName("scanDevicesButton")
        self.scan_button.clicked.connect(self.scan)

        self.table = QTableWidget(0, 4)
        self.table.setHorizontalHeaderLabels(["Serial", "Link", "State", "Model"])
        self.table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.table.setSelectionMode(QTableWidget.SelectionMode.SingleSelection)
        self.table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self.table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self.table.verticalHeader().setVisible(False)
        self.table.setAccessibleName("ADB devices")

        self.services = QTableWidget(0, 3)
        self.services.setHorizontalHeaderLabels(["Kind", "Name", "Address"])
        self.services.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.services.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self.services.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.Stretch)
        self.services.verticalHeader().setVisible(False)
        self.services.setAccessibleName("Wireless debugging services")
        self.services.cellDoubleClicked.connect(self._fill_from_service)

        use_button = QPushButton("Use selected phone")
        use_button.setObjectName("bridgeButton")
        use_button.clicked.connect(self.use_selected)
        fill_button = QPushButton("Copy address into connect")
        fill_button.clicked.connect(self._fill_from_service)

        phones = QWidget()
        phones_layout = QVBoxLayout(phones)
        phones_layout.setContentsMargins(16, 16, 16, 16)
        phones_layout.setSpacing(12)
        phones_layout.addWidget(self.table, stretch=1)
        phones_layout.addWidget(use_button)

        ads = QWidget()
        ads_layout = QVBoxLayout(ads)
        ads_layout.setContentsMargins(16, 16, 16, 16)
        ads_layout.setSpacing(12)
        ads_layout.addWidget(self.services, stretch=1)
        ads_layout.addWidget(fill_button)

        self.connect_host = QLineEdit()
        self.connect_host.setPlaceholderText("192.168.1.20")
        self.connect_host.setAccessibleName("Connect host")
        self.connect_host.setFixedHeight(44)
        self.connect_port = QLineEdit("5555")
        self.connect_port.setAccessibleName("Connect port")
        self.connect_port.setFixedHeight(44)
        connect_button = QPushButton("Connect")
        connect_button.setObjectName("bridgeButton")
        connect_button.clicked.connect(self.connect_wireless)

        self.pair_host = QLineEdit()
        self.pair_host.setPlaceholderText("192.168.1.20")
        self.pair_host.setAccessibleName("Pair host")
        self.pair_host.setFixedHeight(44)
        self.pair_port = QLineEdit()
        self.pair_port.setPlaceholderText("37123")
        self.pair_port.setAccessibleName("Pair port")
        self.pair_port.setFixedHeight(44)
        self.pair_code = QLineEdit()
        self.pair_code.setPlaceholderText("6 digits")
        self.pair_code.setAccessibleName("Pairing code")
        self.pair_code.setFixedHeight(44)
        pair_button = QPushButton("Pair")
        pair_button.clicked.connect(self.pair_wireless)

        def labeled_field(caption: str, widget) -> QWidget:
            block = QWidget()
            block_layout = QVBoxLayout(block)
            block_layout.setContentsMargins(0, 0, 0, 0)
            block_layout.setSpacing(6)
            caption_label = QLabel(caption)
            caption_label.setObjectName("muted")
            block_layout.addWidget(caption_label)
            block_layout.addWidget(widget)
            return block

        connect_inner = QWidget()
        connect_layout = QVBoxLayout(connect_inner)
        connect_layout.setContentsMargins(20, 16, 20, 16)
        connect_layout.setSpacing(14)
        connect_layout.addWidget(labeled_field("Host", self.connect_host))
        connect_layout.addWidget(labeled_field("Port", self.connect_port))
        connect_layout.addWidget(connect_button)
        connect_layout.addSpacing(8)
        connect_layout.addWidget(labeled_field("Pair host", self.pair_host))
        connect_layout.addWidget(labeled_field("Pair port", self.pair_port))
        connect_layout.addWidget(labeled_field("Pairing code", self.pair_code))
        connect_layout.addWidget(pair_button)
        connect_layout.addStretch(1)
        connect_scroll = QScrollArea()
        connect_scroll.setWidgetResizable(True)
        connect_scroll.setFrameShape(QFrame.Shape.NoFrame)
        connect_scroll.setWidget(connect_inner)
        connect_tab = QWidget()
        wrap = QVBoxLayout(connect_tab)
        wrap.setContentsMargins(0, 0, 0, 0)
        wrap.addWidget(connect_scroll)

        self.tabs = QTabWidget()
        self.tabs.addTab(phones, "Phones")
        self.tabs.addTab(ads, "Wireless ads")
        self.tabs.addTab(connect_tab, "Connect / pair")

        close = QDialogButtonBox(QDialogButtonBox.StandardButton.Close)
        close.rejected.connect(self.reject)
        close.accepted.connect(self.reject)

        top = QHBoxLayout()
        top.addWidget(self.scan_button)
        top.addStretch(1)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 20, 20, 16)
        layout.setSpacing(14)
        layout.addWidget(intro)
        layout.addLayout(top)
        layout.addWidget(self.message)
        layout.addWidget(self.tabs, stretch=1)
        layout.addWidget(close)
        self.refresh_tables()

    def scan(self) -> None:
        try:
            self.state.scan_devices()
            count = len(self.state.devices)
            extra = len(self.state.wireless)
            self.message.setText(f"Found {count} phone(s) adb can see, and {extra} wireless advertisement(s).")
        except RuntimeError as exc:
            self.message.setText(str(exc))
        self.refresh_tables()

    def refresh_tables(self) -> None:
        self.table.setRowCount(len(self.state.devices))
        for row, device in enumerate(self.state.devices):
            serial = QTableWidgetItem(device.serial)
            self.table.setItem(row, 0, serial)
            self.table.setItem(row, 1, QTableWidgetItem(device.transport))
            self.table.setItem(row, 2, QTableWidgetItem(device.state))
            self.table.setItem(row, 3, QTableWidgetItem(device.model))
        self.services.setRowCount(len(self.state.wireless))
        for row, service in enumerate(self.state.wireless):
            self.services.setItem(row, 0, QTableWidgetItem(service.kind))
            self.services.setItem(row, 1, QTableWidgetItem(service.instance))
            self.services.setItem(row, 2, QTableWidgetItem(service.endpoint))

    def use_selected(self) -> None:
        row = self.table.currentRow()
        if row < 0:
            self.message.setText("Select a phone in the list first.")
            return
        item = self.table.item(row, 0)
        if item is None:
            return
        serial = item.text()
        try:
            self.state.select_device(serial)
        except ValueError as exc:
            self.message.setText(str(exc))
            return
        self.chosen_serial = serial
        self.accept()

    def connect_wireless(self) -> None:
        endpoint = f"{self.connect_host.text().strip()}:{self.connect_port.text().strip()}"
        try:
            validate_endpoint(endpoint)
            message = self.state.adb.connect(endpoint)
            self.state.scan_devices()
            self.state.select_device(endpoint)
        except (ValueError, RuntimeError) as exc:
            self.message.setText(str(exc))
            return
        self.message.setText(message)
        self.chosen_serial = endpoint
        self.refresh_tables()
        self.accept()

    def pair_wireless(self) -> None:
        endpoint = f"{self.pair_host.text().strip()}:{self.pair_port.text().strip()}"
        try:
            message = self.state.adb.pair(endpoint, self.pair_code.text())
        except (ValueError, RuntimeError) as exc:
            self.message.setText(str(exc))
            return
        self.message.setText(message + " Now connect using the address on the wireless debugging screen.")

    def _fill_from_service(self, *_args) -> None:
        row = self.services.currentRow()
        if row < 0:
            self.message.setText("Select a wireless advertisement first.")
            return
        kind_item = self.services.item(row, 0)
        endpoint_item = self.services.item(row, 2)
        if kind_item is None or endpoint_item is None or ":" not in endpoint_item.text():
            return
        host, port = endpoint_item.text().rsplit(":", 1)
        if kind_item.text() == "pairing":
            self.pair_host.setText(host)
            self.pair_port.setText(port)
        else:
            self.connect_host.setText(host)
            self.connect_port.setText(port)
