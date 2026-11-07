"""3D phone widget that leans with accelerometer tilt."""

from __future__ import annotations

import math
from typing import Iterable

from PySide6.QtCore import QPointF, QRectF, Qt, QTimer
from PySide6.QtGui import (
    QColor,
    QLinearGradient,
    QPainter,
    QPainterPath,
    QPen,
    QPolygonF,
)
from PySide6.QtWidgets import QSizePolicy, QWidget


def tilt_from_sample(
    ax: float,
    ay: float,
    *,
    offset_ax: float = 0.0,
    offset_ay: float = 0.0,
    invert_x: bool = False,
    invert_y: bool = False,
) -> tuple[float, float]:
    """Map accel (m/s²) to roll / pitch degrees for the on-screen phone."""
    dx = ax - offset_ax
    dy = ay - offset_ay
    if invert_x:
        dx = -dx
    if invert_y:
        dy = -dy
    roll = max(-72.0, min(72.0, dx / 9.81 * 90.0))
    pitch = max(-72.0, min(72.0, dy / 9.81 * 90.0))
    return roll, pitch


def _rotate(point: tuple[float, float, float], roll: float, pitch: float) -> tuple[float, float, float]:
    x, y, z = point
    pr = math.radians(pitch)
    rr = math.radians(-roll)
    # Pitch: top toward / away from the camera.
    y1 = y * math.cos(pr) - z * math.sin(pr)
    z1 = y * math.sin(pr) + z * math.cos(pr)
    # Roll: left / right edge in or out.
    x2 = x * math.cos(rr) + z1 * math.sin(rr)
    z2 = -x * math.sin(rr) + z1 * math.cos(rr)
    return x2, y1, z2


def _project(
    point: tuple[float, float, float],
    cx: float,
    cy: float,
    scale: float,
    focal: float = 4.2,
) -> QPointF:
    x, y, z = point
    depth = focal / (focal + z)
    return QPointF(cx + x * scale * depth, cy - y * scale * depth)


class PhoneTiltView(QWidget):
    """Perspective phone. ``set_pose`` updates lean and which keys are active."""

    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self.setMinimumSize(160, 180)
        self.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        self.setAccessibleName("3D phone tilt")
        self._roll = 0.0
        self._pitch = 0.0
        self._target_roll = 0.0
        self._target_pitch = 0.0
        self._keys: list[str] = []
        self._reading = False
        self._error = ""
        self._anim = QTimer(self)
        self._anim.setInterval(16)
        self._anim.timeout.connect(self._tick)

    def set_pose(
        self,
        roll: float,
        pitch: float,
        keys: Iterable[str] | None = None,
        *,
        reading: bool = False,
        error: str = "",
    ) -> None:
        self._target_roll = roll
        self._target_pitch = pitch
        self._keys = list(keys or [])
        self._reading = reading
        self._error = error
        if abs(self._target_roll - self._roll) > 8 or abs(self._target_pitch - self._pitch) > 8:
            self._roll = self._target_roll
            self._pitch = self._target_pitch
        if abs(self._target_roll - self._roll) > 0.05 or abs(self._target_pitch - self._pitch) > 0.05:
            if not self._anim.isActive():
                self._anim.start()
        self.update()

    def _tick(self) -> None:
        self._roll += (self._target_roll - self._roll) * 0.55
        self._pitch += (self._target_pitch - self._pitch) * 0.55
        if abs(self._target_roll - self._roll) <= 0.05 and abs(self._target_pitch - self._pitch) <= 0.05:
            self._roll = self._target_roll
            self._pitch = self._target_pitch
            self._anim.stop()
        self.update()

    def paintEvent(self, event) -> None:  # noqa: N802 — Qt override
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        rect = self.rect()
        bg = QLinearGradient(rect.topLeft(), rect.bottomRight())
        bg.setColorAt(0.0, QColor("#0a0f15"))
        bg.setColorAt(0.55, QColor("#0f1a14"))
        bg.setColorAt(1.0, QColor("#0a0f15"))
        painter.fillRect(rect, bg)
        glow = QPainterPath()
        glow.addEllipse(QRectF(rect.center().x() - 160, rect.center().y() - 90, 320, 260))
        painter.setPen(Qt.PenStyle.NoPen)
        painter.setBrush(QColor(62, 224, 138, 18 if self._reading else 8))
        painter.drawPath(glow)

        cx = rect.center().x()
        cy = rect.center().y() - 12
        scale = min(rect.width(), rect.height()) * 0.28
        roll, pitch = self._roll, self._pitch

        self._draw_shadow(painter, cx, cy, scale, roll, pitch)
        self._draw_phone(painter, cx, cy, scale, roll, pitch)
        self._draw_caption(painter, rect)

    def _xf(self, x: float, y: float, z: float, cx: float, cy: float, scale: float, roll: float, pitch: float) -> QPointF:
        return _project(_rotate((x, y, z), roll, pitch), cx, cy, scale)

    def _draw_shadow(self, painter: QPainter, cx: float, cy: float, scale: float, roll: float, pitch: float) -> None:
        shadow = QPainterPath()
        shadow.addEllipse(QRectF(cx - 90 + roll * 0.8, cy + scale * 1.55, 180, 36))
        painter.setPen(Qt.PenStyle.NoPen)
        painter.setBrush(QColor(0, 0, 0, 90))
        painter.drawPath(shadow)

    def _face(
        self,
        corners: list[tuple[float, float, float]],
        cx: float,
        cy: float,
        scale: float,
        roll: float,
        pitch: float,
    ) -> tuple[QPolygonF, float]:
        rotated = [_rotate(p, roll, pitch) for p in corners]
        poly = QPolygonF([_project(p, cx, cy, scale) for p in rotated])
        depth = sum(p[2] for p in rotated) / len(rotated)
        return poly, depth

    def _draw_phone(self, painter: QPainter, cx: float, cy: float, scale: float, roll: float, pitch: float) -> None:
        w, h, d = 0.78, 1.58, 0.09
        faces = {
            "front": [(-w, -h, d), (w, -h, d), (w, h, d), (-w, h, d)],
            "back": [(w, -h, -d), (-w, -h, -d), (-w, h, -d), (w, h, -d)],
            "left": [(-w, -h, -d), (-w, -h, d), (-w, h, d), (-w, h, -d)],
            "right": [(w, -h, d), (w, -h, -d), (w, h, -d), (w, h, d)],
            "top": [(-w, h, -d), (-w, h, d), (w, h, d), (w, h, -d)],
            "bottom": [(-w, -h, d), (-w, -h, -d), (w, -h, -d), (w, -h, d)],
        }
        drawn: list[tuple[float, str, QPolygonF]] = []
        for name, corners in faces.items():
            poly, depth = self._face(corners, cx, cy, scale, roll, pitch)
            drawn.append((depth, name, poly))
        drawn.sort(reverse=True)

        keys = set(self._keys)
        glow = QColor("#3ee08a") if keys else QColor("#3fe18b")
        body = {
            "front": QColor("#12181e"),
            "back": QColor("#0b1016"),
            "left": QColor("#161c22"),
            "right": QColor("#1c232b"),
            "top": QColor("#252a31"),
            "bottom": QColor("#0a0f15"),
        }
        for _depth, name, poly in drawn:
            painter.setPen(QPen(QColor("#0b0e12"), 1.2))
            painter.setBrush(body[name])
            painter.drawPolygon(poly)
            if name == "front":
                self._draw_screen(painter, cx, cy, scale, roll, pitch, keys, glow)
            if name == "back":
                bump = [
                    (-0.18, 1.18, -d - 0.02),
                    (0.18, 1.18, -d - 0.02),
                    (0.18, 0.82, -d - 0.02),
                    (-0.18, 0.82, -d - 0.02),
                ]
                bpoly, _ = self._face(bump, cx, cy, scale, roll, pitch)
                painter.setBrush(QColor("#11151b"))
                painter.drawPolygon(bpoly)

    def _draw_screen(
        self,
        painter: QPainter,
        cx: float,
        cy: float,
        scale: float,
        roll: float,
        pitch: float,
        keys: set[str],
        glow: QColor,
    ) -> None:
        inset = 0.09
        w, h, d = 0.78 - inset, 1.58 - inset, 0.092
        screen, _ = self._face(
            [(-w, -h, d), (w, -h, d), (w, h, d), (-w, h, d)],
            cx,
            cy,
            scale,
            roll,
            pitch,
        )
        fill = QLinearGradient(screen.boundingRect().topLeft(), screen.boundingRect().bottomLeft())
        fill.setColorAt(0.0, QColor("#10261a") if keys else QColor("#0c1410"))
        fill.setColorAt(1.0, QColor("#07140e") if keys else QColor("#070c10"))
        painter.setBrush(fill)
        painter.setPen(QPen(glow if keys else QColor("#3c4a3f"), 1.8))
        painter.drawPolygon(screen)

        # Direction chevrons on the glass.
        marks = {
            "a": [(-0.42, 0.08, d + 0.01), (-0.22, 0.22, d + 0.01), (-0.22, -0.06, d + 0.01)],
            "d": [(0.42, 0.08, d + 0.01), (0.22, 0.22, d + 0.01), (0.22, -0.06, d + 0.01)],
            "w": [(0.0, 0.72, d + 0.01), (-0.16, 0.48, d + 0.01), (0.16, 0.48, d + 0.01)],
            "s": [(0.0, -0.55, d + 0.01), (-0.16, -0.32, d + 0.01), (0.16, -0.32, d + 0.01)],
        }
        aliases = {"left": "a", "right": "d", "up": "w", "down": "s"}
        active = {aliases.get(k, k) for k in keys}
        for name, corners in marks.items():
            poly, _ = self._face(corners, cx, cy, scale, roll, pitch)
            on = name in active
            painter.setBrush(QColor(glow) if on else QColor(62, 224, 138, 40))
            painter.setPen(Qt.PenStyle.NoPen)
            painter.drawPolygon(poly)

        # Home indicator.
        bar, _ = self._face(
            [(-0.22, -h + 0.08, d + 0.012), (0.22, -h + 0.08, d + 0.012), (0.22, -h + 0.14, d + 0.012), (-0.22, -h + 0.14, d + 0.012)],
            cx,
            cy,
            scale,
            roll,
            pitch,
        )
        painter.setBrush(QColor(255, 255, 255, 50))
        painter.drawPolygon(bar)

    def _draw_caption(self, painter: QPainter, rect) -> None:
        painter.setPen(QColor("#859587"))
        if self._error:
            painter.setPen(QColor("#ffb4b4"))
            text = self._error
        elif self._reading:
            keys = "+".join(self._keys) if self._keys else "neutral"
            text = f"Live tilt   {keys}"
        else:
            text = "Start reading to see live tilt"
        painter.drawText(QRectF(12, rect.height() - 28, rect.width() - 24, 22), Qt.AlignmentFlag.AlignHCenter, text)
