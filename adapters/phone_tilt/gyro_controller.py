#!/usr/bin/env python3
"""Phone-tilt → keyboard bridge for Game Night Access Adapter.

Reads live samples from :mod:`sensor_reader`, maps tilt into a single
digital direction (WASD or arrows), and injects keystrokes with ``pynput``
so a focused browser game receives normal keyboard input.

Controls (controller window)
----------------------------
- ``P`` — pause / resume injection
- ``Esc`` / close window — quit and release all keys

Tuning constants live at the top of this file; see
``docs/phone-tilt-adapter.md`` for setup and limitations.
"""

from __future__ import annotations

import sys

import pygame
from pynput.keyboard import Controller, Key, KeyCode

from sensor_reader import SensorReader

# --- tuning ---
ACCEL_DEADZONE = 2.8          # m/s² before tilt counts as a key
AXIS_DOMINANCE = 1.15         # winner must beat the other axis by this factor
SINGLE_AXIS_ONLY = True       # never hold two directions at once (kills diagonals)
INVERT_X = False
INVERT_Y = False
USE_ARROWS = False            # True → arrow keys instead of WASD
HOLD_SPACE_ON_UP = False      # tilt phone face-up-ish → hold space
WINDOW_SIZE = (720, 420)


def _keys():
    if USE_ARROWS:
        return {
            "left": Key.left,
            "right": Key.right,
            "up": Key.up,
            "down": Key.down,
        }
    return {
        "left": KeyCode.from_char("a"),
        "right": KeyCode.from_char("d"),
        "up": KeyCode.from_char("w"),
        "down": KeyCode.from_char("s"),
    }


class KeyInjector:
    """Hold/release OS keys so only the currently active directions stay down."""

    def __init__(self):
        self.kb = Controller()
        self.held: set = set()
        self.enabled = True
        self.map = _keys()

    def set_directions(self, left: bool, right: bool, up: bool, down: bool, space: bool = False):
        """Sync pressed keys to the desired direction set (idempotent)."""
        wanted = set()
        if self.enabled:
            if left:
                wanted.add(self.map["left"])
            if right:
                wanted.add(self.map["right"])
            if up:
                wanted.add(self.map["up"])
            if down:
                wanted.add(self.map["down"])
            if space and HOLD_SPACE_ON_UP:
                wanted.add(Key.space)

        for key in list(self.held - wanted):
            try:
                self.kb.release(key)
            except Exception:
                pass
            self.held.discard(key)

        for key in wanted - self.held:
            try:
                self.kb.press(key)
            except Exception:
                pass
            self.held.add(key)

    def release_all(self):
        for key in list(self.held):
            try:
                self.kb.release(key)
            except Exception:
                pass
        self.held.clear()


def tilt_to_dirs(ax: float, ay: float, az: float, gx: float, gy: float, gz: float):
    """Convert phone orientation / tilt into digital directions.

    Phone flat on table face-up ≈ (0, 0, 9.8). Tilting left/right/forward
    moves gravity into X/Y. Only the dominant axis above the deadzone fires,
    so diagonal tilts don't press two keys at once.
    """
    del gx, gy, gz  # reserved; accel tilt is stabler for discrete keys
    x = -ax if INVERT_X else ax
    y = -ay if INVERT_Y else ay

    abs_x, abs_y = abs(x), abs(y)
    left = right = up = down = False

    if max(abs_x, abs_y) >= ACCEL_DEADZONE:
        if SINGLE_AXIS_ONLY:
            # Pick one axis; require clear dominance when both are large
            if abs_x >= abs_y * AXIS_DOMINANCE and abs_x >= ACCEL_DEADZONE:
                left, right = x < 0, x > 0
            elif abs_y >= abs_x * AXIS_DOMINANCE and abs_y >= ACCEL_DEADZONE:
                up, down = y < 0, y > 0
            elif abs_x >= abs_y and abs_x >= ACCEL_DEADZONE:
                left, right = x < 0, x > 0
            elif abs_y > abs_x and abs_y >= ACCEL_DEADZONE:
                up, down = y < 0, y > 0
        else:
            left = x < -ACCEL_DEADZONE
            right = x > ACCEL_DEADZONE
            up = y < -ACCEL_DEADZONE
            down = y > ACCEL_DEADZONE

    space = az > 7.0 and abs(ax) < 3.0 and abs(ay) < 3.0
    return left, right, up, down, space


def draw_ui(screen, font, small, sample, dirs, injector, reader, fps):
    screen.fill((18, 22, 28))
    left, right, up, down, space = dirs

    title = font.render("Phone Tilt → Keys", True, (240, 244, 250))
    screen.blit(title, (24, 18))

    status = "INJECTING" if injector.enabled else "PAUSED (P)"
    color = (80, 220, 140) if injector.enabled else (240, 180, 60)
    screen.blit(font.render(status, True, color), (24, 60))

    device = reader.device or "?"
    screen.blit(small.render(f"device: {device}", True, (160, 170, 185)), (24, 100))
    screen.blit(small.render(f"source: {sample.source}   fps≈{fps:.0f}", True, (160, 170, 185)), (24, 122))
    if reader.error:
        screen.blit(small.render(f"err: {reader.error[:80]}", True, (255, 120, 120)), (24, 144))

    vals = (
        f"accel  x={sample.ax:7.2f}  y={sample.ay:7.2f}  z={sample.az:7.2f}"
    )
    gvals = (
        f"gyro   x={sample.gx:7.2f}  y={sample.gy:7.2f}  z={sample.gz:7.2f}"
    )
    screen.blit(small.render(vals, True, (210, 220, 235)), (24, 180))
    screen.blit(small.render(gvals, True, (210, 220, 235)), (24, 202))

    # Direction pad visualization
    cx, cy, r = 560, 210, 90
    pygame.draw.circle(screen, (40, 48, 60), (cx, cy), r, 2)
    pygame.draw.circle(screen, (40, 48, 60), (cx, cy), 8)

    # live tilt marker
    mx = int(cx + max(-1.0, min(1.0, sample.ax / 8.0)) * (r - 12))
    my = int(cy + max(-1.0, min(1.0, sample.ay / 8.0)) * (r - 12))
    pygame.draw.circle(screen, (90, 180, 255), (mx, my), 10)

    def key_box(label, active, rect):
        bg = (70, 160, 110) if active else (45, 52, 64)
        pygame.draw.rect(screen, bg, rect, border_radius=8)
        t = small.render(label, True, (255, 255, 255))
        screen.blit(t, (rect.centerx - t.get_width() // 2, rect.centery - t.get_height() // 2))

    key_box("W↑" if not USE_ARROWS else "↑", up, pygame.Rect(120, 250, 64, 48))
    key_box("A←" if not USE_ARROWS else "←", left, pygame.Rect(50, 308, 64, 48))
    key_box("S↓" if not USE_ARROWS else "↓", down, pygame.Rect(120, 308, 64, 48))
    key_box("D→" if not USE_ARROWS else "→", right, pygame.Rect(190, 308, 64, 48))
    if HOLD_SPACE_ON_UP:
        key_box("SPACE", space, pygame.Rect(280, 308, 90, 48))

    help_lines = [
        "Tilt phone left/right/forward/back → A/D/W/S",
        "P pause · Esc quit · focus the game window after starting",
        f"deadzone={ACCEL_DEADZONE}  dominance={AXIS_DOMINANCE}  single-axis={SINGLE_AXIS_ONLY}",
    ]
    for i, line in enumerate(help_lines):
        screen.blit(small.render(line, True, (130, 140, 155)), (24, 370 + i * 18))


def main() -> int:
    pygame.init()
    pygame.display.set_caption("Game Night — Phone Tilt Adapter")
    screen = pygame.display.set_mode(WINDOW_SIZE)
    # Prefer system fonts; fall back to pygame default if fc-list is slow/unavailable.
    try:
        font = pygame.font.SysFont("DejaVu Sans", 28, bold=True)
        small = pygame.font.SysFont("DejaVu Sans Mono", 16)
    except Exception:
        font = pygame.font.Font(None, 32)
        small = pygame.font.Font(None, 20)
    clock = pygame.time.Clock()

    reader = SensorReader(interval=0.07)
    injector = KeyInjector()

    try:
        reader.start()
    except Exception as exc:
        print(f"Failed to start sensor reader: {exc}", file=sys.stderr)
        print("Pair the phone first: ./connect_phone.sh", file=sys.stderr)
        return 1

    running = True
    fps = 0.0
    try:
        while running:
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    running = False
                elif event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_ESCAPE:
                        running = False
                    elif event.key == pygame.K_p:
                        injector.enabled = not injector.enabled
                        if not injector.enabled:
                            injector.release_all()

            sample = reader.sample
            dirs = tilt_to_dirs(sample.ax, sample.ay, sample.az, sample.gx, sample.gy, sample.gz)
            injector.set_directions(*dirs)

            draw_ui(screen, font, small, sample, dirs, injector, reader, fps)
            pygame.display.flip()
            dt = clock.tick(60)
            fps = 1000.0 / dt if dt else 0.0
    finally:
        injector.release_all()
        reader.stop()
        pygame.quit()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
