"""Hold and release operating-system keys for the active sensor mappings.

``KeyInjector`` talks to ``pynput`` unless a controller is passed in. Tests pass
a fake controller and never touch the real keyboard.

On Windows, letter keys are sent as hardware scan codes (``KEYEVENTF_SCANCODE``)
so DirectInput / Unity games see a held WASD key. ``KeyCode.from_char`` becomes
a Unicode type event that notepad shows but games ignore. On X11, letters use
``KeyCode._from_symbol`` so pynput emits XTest FakeKeyEvent instead of
XSendEvent.
"""

from __future__ import annotations

import sys
from typing import Any, Iterable, Protocol

from access_adapter.mapping import MappingRule, canonical_key


KEYEVENTF_EXTENDEDKEY = 0x0001
KEYEVENTF_SCANCODE = 0x0008

# Virtual-key and set-1 scan codes for canonical mapping names.
_WIN32_KEYS: dict[str, tuple[int, int, bool]] = {
    **{chr(ord("a") + i): (0x41 + i, scan, False) for i, scan in enumerate(
        [
            0x1E, 0x30, 0x2E, 0x20, 0x12, 0x21, 0x22, 0x23, 0x17, 0x24,
            0x25, 0x26, 0x32, 0x31, 0x18, 0x19, 0x10, 0x13, 0x1F, 0x14,
            0x16, 0x2F, 0x11, 0x2D, 0x15, 0x2C,
        ]
    )},
    **{str(i): (0x30 + i, (0x0B if i == 0 else 0x01 + i), False) for i in range(10)},
    **{f"f{i}": (0x6F + i, (0x3A + i if i <= 10 else (0x57 if i == 11 else 0x58)), False) for i in range(1, 13)},
    "space": (0x20, 0x39, False),
    "enter": (0x0D, 0x1C, False),
    "tab": (0x09, 0x0F, False),
    "esc": (0x1B, 0x01, False),
    "shift": (0x10, 0x2A, False),
    "ctrl": (0x11, 0x1D, False),
    "alt": (0x12, 0x38, False),
    "up": (0x26, 0x48, True),
    "down": (0x28, 0x50, True),
    "left": (0x25, 0x4B, True),
    "right": (0x27, 0x4D, True),
    "backspace": (0x08, 0x0E, False),
    "delete": (0x2E, 0x53, True),
    "home": (0x24, 0x47, True),
    "end": (0x23, 0x4F, True),
    "pageup": (0x21, 0x49, True),
    "pagedown": (0x22, 0x51, True),
    "insert": (0x2D, 0x52, True),
}


class _KeyController(Protocol):
    def press(self, key: Any) -> None: ...

    def release(self, key: Any) -> None: ...


class KeyInjector:
    """Keep the pressed set equal to the key names from the mapping engine."""

    def __init__(self, controller: _KeyController | None = None) -> None:
        self._controller = controller if controller is not None else _PynputController()
        self._held: dict[str, Any] = {}
        self._once_latched: set[str] = set()

    @property
    def held_names(self) -> list[str]:
        return list(self._held)

    def sync(self, key_names: Iterable[str]) -> None:
        wanted = [canonical_key(name) for name in key_names]
        wanted_set = set(wanted)
        for name in list(self._held):
            if name not in wanted_set:
                self._release(name)
        for name in wanted:
            if name not in self._held:
                self._press(name)

    def apply_rules(self, rules: Iterable[MappingRule]) -> list[str]:
        """Hold continuous mappings; tap once-mappings on the rising edge."""
        matched = list(rules)
        current_ids = {rule.id for rule in matched}
        hold: list[str] = []
        for rule in matched:
            if rule.press_mode == "once":
                if rule.id not in self._once_latched:
                    for name in rule.keys:
                        self._tap(canonical_key(name))
                    self._once_latched.add(rule.id)
            else:
                hold.extend(rule.keys)
        self._once_latched &= current_ids
        self.sync(hold)
        shown: list[str] = []
        seen: set[str] = set()
        for rule in matched:
            for key in rule.keys:
                if key not in seen:
                    seen.add(key)
                    shown.append(key)
        return shown

    def release_all(self) -> None:
        self._once_latched.clear()
        for name in list(self._held):
            self._release(name)

    def _tap(self, name: str) -> None:
        if name in self._held:
            self._release(name)
        self._press(name)
        self._release(name)

    def _press(self, name: str) -> None:
        key = _to_pynput_key(name)
        self._controller.press(key)
        self._held[name] = key

    def _release(self, name: str) -> None:
        key = self._held.pop(name)
        try:
            self._controller.release(key)
        except Exception:
            pass


class _PynputController:
    def __init__(self) -> None:
        from pynput.keyboard import Controller

        self._controller = Controller()

    def press(self, key: Any) -> None:
        self._controller.press(key)

    def release(self, key: Any) -> None:
        self._controller.release(key)


def win32_key_spec(name: str) -> tuple[int, int, int]:
    """Return ``(vk, scan, SendInput flags)`` for a canonical key name."""
    try:
        vk, scan, extended = _WIN32_KEYS[name]
    except KeyError as exc:
        raise ValueError(f"Unknown key {name!r}") from exc
    flags = KEYEVENTF_SCANCODE
    if extended:
        flags |= KEYEVENTF_EXTENDEDKEY
    return vk, scan, flags


def _to_pynput_key(name: str) -> Any:
    from pynput.keyboard import Key, KeyCode

    if sys.platform == "win32":
        vk, scan, flags = win32_key_spec(name)
        return KeyCode.from_vk(vk, _scan=scan, _flags=flags)

    special = {
        "space": Key.space,
        "enter": Key.enter,
        "tab": Key.tab,
        "esc": Key.esc,
        "shift": Key.shift,
        "ctrl": Key.ctrl,
        "alt": Key.alt,
        "up": Key.up,
        "down": Key.down,
        "left": Key.left,
        "right": Key.right,
        "backspace": Key.backspace,
        "delete": Key.delete,
        "home": Key.home,
        "end": Key.end,
        "pageup": Key.page_up,
        "pagedown": Key.page_down,
        "insert": Key.insert,
    }
    if name in special:
        return special[name]
    if name.startswith("f") and name[1:].isdigit():
        return getattr(Key, name)
    from_symbol = getattr(KeyCode, "_from_symbol", None)
    if callable(from_symbol):
        try:
            key = from_symbol(name)
        except Exception:
            key = None
        if key is not None and getattr(key, "vk", None):
            return key
    return KeyCode.from_char(name)
