"""Stitch-derived theme: mint telemetry on dark cinematic surfaces."""

from __future__ import annotations

from PySide6.QtGui import QFont, QFontDatabase
from PySide6.QtWidgets import QApplication


STYLESHEET = """
QMainWindow, QDialog {
    background: #0a0f15;
    color: #dee3eb;
    font-family: "Manrope", "Segoe UI", "Ubuntu", sans-serif;
    font-size: 14px;
}
QLabel {
    color: #dee3eb;
    font-size: 14px;
}
QLabel#brand {
    color: #62fda4;
    font-family: "Space Grotesk", "Manrope", "Ubuntu", sans-serif;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 0.4px;
}
QScrollArea { border: 0; background: #0a0f15; }
QScrollArea > QWidget > QWidget { background: #0a0f15; }
QLabel#subtitle {
    color: #bac8d9;
    font-size: 16px;
    font-weight: 600;
    opacity: 0.8;
}
QLabel#cardTitle {
    font-family: "Space Grotesk", "Manrope", "Ubuntu", sans-serif;
    font-size: 22px;
    font-weight: 600;
    color: #dee3eb;
}
QLabel#hint, QLabel#muted, QLabel#telemetry {
    color: #9aa8b8;
    font-size: 13px;
}
QLabel#telemetry {
    font-family: "JetBrains Mono", "Ubuntu Mono", monospace;
    font-size: 12px;
    letter-spacing: 0.4px;
}
QLabel#statusPill {
    background: #252a31;
    color: #bac8d9;
    border: 1px solid #3c4a3f;
    border-radius: 999px;
    padding: 6px 14px;
    font-family: "JetBrains Mono", "Ubuntu Mono", monospace;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 1.2px;
}
QLabel#statusPill[reading="true"] {
    background: #123326;
    color: #62fda4;
    border-color: #3ee08a;
}
QLabel#monoBadge {
    background: #0f141a;
    color: #62fda4;
    border: 1px solid #3c4a3f;
    border-radius: 999px;
    padding: 6px 12px;
    font-family: "JetBrains Mono", "Ubuntu Mono", monospace;
    font-size: 12px;
    font-weight: 600;
}
QLabel#keyChip {
    background: #171c22;
    border: 1px solid #30353c;
    border-radius: 12px;
    padding: 10px 12px;
    font-size: 13px;
    font-weight: 600;
    color: #bbcbbc;
}
QLabel#keyChip[active="true"] {
    background: #123326;
    border-color: #3ee08a;
    color: #62fda4;
}
QFrame#card {
    background: #171c22;
    border: 1px solid #2a3442;
    border-radius: 20px;
}
QFrame#topBar {
    background: #0f141a;
    border-bottom: 1px solid #3c4a3f;
}
QPushButton {
    background: #1b2026;
    color: #dee3eb;
    border: 1px solid #3c4a3f;
    border-radius: 999px;
    padding: 8px 14px;
    min-height: 36px;
    font-size: 14px;
    font-weight: 600;
}
QPushButton:hover { background: #252a31; }
QPushButton#bridgeButton {
    background: #3ee08a;
    color: #00391d;
    border: 0;
    min-width: 120px;
}
QPushButton#bridgeButton:hover { background: #62fda4; }
QPushButton#bridgeButton[running="true"] {
    background: #93000a;
    color: #ffdad6;
}
QPushButton#bridgeButton[running="true"]:hover { background: #b3261e; }
QTableWidget {
    background: #141b22;
    color: #dee3eb;
    gridline-color: #252a31;
    font-size: 14px;
    selection-background-color: #123326;
    selection-color: #62fda4;
    border: 1px solid #252a31;
    border-radius: 12px;
}
QHeaderView::section {
    background: #141b22;
    color: #859587;
    padding: 10px;
    border: 0;
    border-bottom: 1px solid #252a31;
    font-family: "JetBrains Mono", "Ubuntu Mono", monospace;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 1px;
}
QTableWidget::item { padding: 6px; }
QLineEdit, QComboBox, QDoubleSpinBox, QSpinBox {
    background: #0f141a;
    color: #dee3eb;
    border: 1px solid #3c4a3f;
    border-radius: 10px;
    padding: 8px 12px;
    min-height: 40px;
    font-size: 14px;
}
QCheckBox {
    font-size: 13px;
    spacing: 10px;
    color: #dee3eb;
}
QCheckBox::indicator {
    width: 36px;
    height: 20px;
    border-radius: 10px;
    background: #30353c;
    border: 1px solid #3c4a3f;
}
QCheckBox::indicator:checked {
    background: #3ee08a;
    border-color: #3ee08a;
}
QStatusBar {
    color: #859587;
    font-family: "JetBrains Mono", "Ubuntu Mono", monospace;
    font-size: 12px;
    background: #0a0f15;
}
QSplitter::handle { background: #1b2026; width: 8px; height: 8px; }
QTabWidget::pane {
    border: 1px solid #2a3442;
    border-radius: 12px;
    background: #141b22;
    padding: 8px;
}
QTabBar::tab {
    background: #171c22;
    color: #bac8d9;
    padding: 10px 18px;
    margin-right: 6px;
    border-top-left-radius: 10px;
    border-top-right-radius: 10px;
    min-height: 28px;
}
QTabBar::tab:selected {
    background: #123326;
    color: #62fda4;
}
QDialogButtonBox QPushButton { min-width: 96px; }
QFormLayout { spacing: 14px; }
"""

COMPARATOR_LABELS = {
    "gt": "above",
    "lt": "below",
    "abs_gt": "absolute value above",
}
LABEL_TO_COMPARATOR = {label: key for key, label in COMPARATOR_LABELS.items()}


def apply_app_fonts(app: QApplication) -> None:
    """Prefer Stitch typefaces when the OS has them."""
    families = set(QFontDatabase.families())
    ui = "Manrope" if "Manrope" in families else "Ubuntu" if "Ubuntu" in families else app.font().family()
    font = QFont(ui, 14)
    font.setHintingPreference(QFont.HintingPreference.PreferFullHinting)
    app.setFont(font)
