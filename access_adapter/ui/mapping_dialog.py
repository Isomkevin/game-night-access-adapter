"""Edit one sensor-to-key mapping."""

from __future__ import annotations

from PySide6.QtWidgets import (
    QCheckBox,
    QComboBox,
    QDialog,
    QDialogButtonBox,
    QDoubleSpinBox,
    QFormLayout,
    QLineEdit,
    QVBoxLayout,
)

from access_adapter.mapping import AXES, SENSORS, MappingRule, parse_key_combination
from access_adapter.ui.style import COMPARATOR_LABELS, LABEL_TO_COMPARATOR


class MappingDialog(QDialog):
    """Form for a single mapping. ``payload`` is what the API and state expect."""

    def __init__(self, rule: MappingRule | None = None, parent=None) -> None:
        super().__init__(parent)
        self.setWindowTitle("Edit mapping" if rule else "Add mapping")
        self.resize(460, 320)
        self._rule_id = rule.id if rule else ""

        self.label = QLineEdit(rule.label if rule else "")
        self.label.setPlaceholderText("Steer left")
        self.label.setAccessibleName("Mapping label")

        self.sensor = QComboBox()
        self.sensor.addItems(list(SENSORS))
        self.axis = QComboBox()
        self.axis.addItems(list(AXES))
        self.comparator = QComboBox()
        self.comparator.addItems(list(COMPARATOR_LABELS.values()))

        self.threshold = QDoubleSpinBox()
        self.threshold.setRange(-80.0, 80.0)
        self.threshold.setDecimals(2)
        self.threshold.setSingleStep(0.1)
        self.threshold.setValue(rule.threshold if rule else 2.8)

        self.keys = QLineEdit()
        self.keys.setPlaceholderText("a    or    ctrl+left")
        self.keys.setAccessibleName("Key combination")
        if rule:
            self.sensor.setCurrentText(rule.sensor)
            self.axis.setCurrentText(rule.axis)
            self.comparator.setCurrentText(COMPARATOR_LABELS[rule.comparator])
            self.keys.setText("+".join(rule.keys))

        self.enabled = QCheckBox("Enabled")
        self.enabled.setChecked(True if rule is None else rule.enabled)

        form = QFormLayout()
        form.addRow("Label", self.label)
        form.addRow("Sensor", self.sensor)
        form.addRow("Axis", self.axis)
        form.addRow("When reading is", self.comparator)
        form.addRow("Threshold", self.threshold)
        form.addRow("Keys", self.keys)
        form.addRow("", self.enabled)

        buttons = QDialogButtonBox(QDialogButtonBox.StandardButton.Save | QDialogButtonBox.StandardButton.Cancel)
        buttons.accepted.connect(self._accept_if_valid)
        buttons.rejected.connect(self.reject)

        layout = QVBoxLayout(self)
        layout.addLayout(form)
        layout.addWidget(buttons)

    def payload(self) -> dict:
        """Validated mapping body. Raises ``ValueError`` when the keys are unknown."""
        keys = parse_key_combination(self.keys.text())
        label = self.label.text().strip()
        if not label:
            raise ValueError("Label is required")
        body = {
            "label": label,
            "sensor": self.sensor.currentText(),
            "axis": self.axis.currentText(),
            "comparator": LABEL_TO_COMPARATOR[self.comparator.currentText()],
            "threshold": float(self.threshold.value()),
            "keys": keys,
            "enabled": self.enabled.isChecked(),
        }
        if self._rule_id:
            body["id"] = self._rule_id
        return body

    def _accept_if_valid(self) -> None:
        try:
            self.payload()
        except ValueError as exc:
            self.keys.setFocus()
            self.keys.setToolTip(str(exc))
            self.setWindowTitle(str(exc))
            return
        self.accept()
