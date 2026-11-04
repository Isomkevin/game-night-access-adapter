"""Shared window styling. Large type and high contrast for easier use."""

from __future__ import annotations


STYLESHEET = """
QMainWindow, QDialog {
    background: #12161c;
    color: #f4f7fb;
}
QLabel {
    color: #f4f7fb;
    font-size: 15px;
}
QLabel#title {
    font-size: 22px;
    font-weight: 600;
}
QLabel#hint, QLabel#muted {
    color: #c5ceda;
    font-size: 13px;
}
QPushButton {
    background: #2c3644;
    color: #f4f7fb;
    border: 1px solid #66758a;
    border-radius: 6px;
    padding: 8px 14px;
    min-height: 36px;
    font-size: 14px;
}
QPushButton:hover { background: #3a4656; }
QPushButton#primary { background: #1d6b45; border-color: #2f9d62; }
QTableWidget {
    background: #1b212b;
    color: #f4f7fb;
    gridline-color: #334052;
    font-size: 14px;
    selection-background-color: #24543a;
    selection-color: #f4f7fb;
}
QHeaderView::section {
    background: #242b36;
    color: #f4f7fb;
    padding: 8px;
    border: 0;
    font-size: 13px;
}
QLineEdit, QComboBox, QDoubleSpinBox, QSpinBox {
    background: #1b212b;
    color: #f4f7fb;
    border: 1px solid #66758a;
    border-radius: 4px;
    padding: 6px;
    min-height: 28px;
    font-size: 14px;
}
QCheckBox { font-size: 14px; spacing: 8px; }
QGroupBox {
    border: 1px solid #334052;
    border-radius: 6px;
    margin-top: 12px;
    padding: 8px;
    font-size: 14px;
}
QGroupBox::title { subcontrol-origin: margin; left: 10px; padding: 0 4px; }
QStatusBar { color: #d5dbe3; font-size: 13px; }
"""

COMPARATOR_LABELS = {
    "gt": "above",
    "lt": "below",
    "abs_gt": "absolute value above",
}
LABEL_TO_COMPARATOR = {label: key for key, label in COMPARATOR_LABELS.items()}
