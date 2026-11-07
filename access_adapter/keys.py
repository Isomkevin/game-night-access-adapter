"""Hold and release operating-system keys for the active sensor mappings.

``KeyInjector`` talks to a platform controller unless tests pass a fake one.

Windows hold must not go through ``pynput``. ``KeyCode.from_char`` becomes a
Unicode type event; ``from_vk`` still leaves ``wVk`` set, and games using
DirectInput or browser ``event.code`` never see a held WASD key. This module
sends ``SendInput`` scan-code down/up (the pydirectinput pattern) and keeps
the key down until the mapping stops matching.

On X11, letters use ``KeyCode._from_symbol`` so pynput emits XTest
FakeKeyEvent instead of XSendEvent.
"""

from __future__ import annotations

import ctypes
import sys
import threading
import time
from typing import Any, Callable, Iterable, Protocol

from access_adapter.mapping import MappingRule, canonical_key


KEYEVENTF_EXTENDEDKEY = 0x0001
KEYEVENTF_KEYUP = 0x0002
KEYEVENTF_SCANCODE = 0x0008
INPUT_KEYBOARD = 1
SPI_GETKEYBOARDSPEED = 0x000A
SPI_GETKEYBOARDDELAY = 0x0016

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

Win32Sender = Callable[[list[tuple[int, int, int]]], None]


class _KeyController(Protocol):
    def press(self, key: Any) -> None: ...

    def release(self, key: Any) -> None: ...


class KeyInjector:
    """Keep the pressed set equal to the key names from the mapping engine."""

    def __init__(self, controller: _KeyController | None = None) -> None:
        self._controller = controller if controller is not None else _default_controller()
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

    def tap(self, key_names: Iterable[str]) -> None:
        for name in key_names:
            self._tap(canonical_key(name))

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
        self._controller.press(name)
        self._held[name] = name

    def _release(self, name: str) -> None:
        self._held.pop(name, None)
        try:
            self._controller.release(name)
        except Exception:
            pass


class _PynputController:
    def __init__(self) -> None:
        from pynput.keyboard import Controller

        self._controller = Controller()

    def press(self, key: Any) -> None:
        self._controller.press(_to_pynput_key(str(key)))

    def release(self, key: Any) -> None:
        self._controller.release(_to_pynput_key(str(key)))


class Win32HoldController:
    """Scan-code key down/up that games treat as a held hardware key.

    Windows does not auto-repeat injected keys; a physical keyboard does. While
    a key is held this controller re-sends key-down at the user's keyboard
    repeat delay and rate, the way X11 auto-repeats XTest keys on Linux.
    """

    def __init__(
        self,
        sender: Win32Sender | None = None,
        *,
        repeat_delay: float | None = None,
        repeat_interval: float | None = None,
    ) -> None:
        self._sender = sender or send_win32_inputs
        delay, interval = _win32_repeat_timing()
        self._delay = delay if repeat_delay is None else repeat_delay
        self._interval = interval if repeat_interval is None else repeat_interval
        self._next_repeat: dict[str, float] = {}
        self._lock = threading.Lock()
        self._wake = threading.Event()
        self._thread: threading.Thread | None = None

    def press(self, key: Any) -> None:
        name = str(key)
        with self._lock:
            self._sender(win32_hold_events(name, is_press=True))
            self._next_repeat[name] = time.monotonic() + self._delay
            self._ensure_thread()
        self._wake.set()

    def release(self, key: Any) -> None:
        name = str(key)
        with self._lock:
            self._next_repeat.pop(name, None)
            self._sender(win32_hold_events(name, is_press=False))

    def _ensure_thread(self) -> None:
        if self._thread is not None and self._thread.is_alive():
            return
        self._thread = threading.Thread(target=self._repeat_loop, name="key-repeat", daemon=True)
        self._thread.start()

    def _repeat_loop(self) -> None:
        while True:
            with self._lock:
                now = time.monotonic()
                for name, due in list(self._next_repeat.items()):
                    if due <= now:
                        self._sender(win32_hold_events(name, is_press=True))
                        self._next_repeat[name] = now + self._interval
                wait = min((due - now for due in self._next_repeat.values()), default=None)
            self._wake.clear()
            self._wake.wait(timeout=None if wait is None else max(0.0, wait))


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


def win32_hold_events(name: str, *, is_press: bool) -> list[tuple[int, int, int]]:
    """``(wVk, wScan, dwFlags)`` packet for one key-down or key-up.

    A scan-code event (``wVk=0``) reaches DirectInput games, and Windows maps
    it to the virtual key so browsers and normal windows get ``keydown`` too.
    """
    _vk, scan, flags = win32_key_spec(name)
    up = 0 if is_press else KEYEVENTF_KEYUP
    return [(0, scan, flags | up)]


def _win32_repeat_timing() -> tuple[float, float]:
    """Keyboard repeat delay and interval from Windows settings (seconds)."""
    delay_index, speed_index = 1, 31
    if sys.platform == "win32":
        value = ctypes.c_uint(0)
        if ctypes.windll.user32.SystemParametersInfoW(SPI_GETKEYBOARDDELAY, 0, ctypes.byref(value), 0):
            delay_index = min(max(value.value, 0), 3)
        if ctypes.windll.user32.SystemParametersInfoW(SPI_GETKEYBOARDSPEED, 0, ctypes.byref(value), 0):
            speed_index = min(max(value.value, 0), 31)
    rate = 2.5 + speed_index * (27.5 / 31)
    return 0.25 * (delay_index + 1), 1.0 / rate


def send_win32_inputs(events: list[tuple[int, int, int]]) -> None:
    """Send one or more keyboard ``INPUT`` records. Windows only."""
    if sys.platform != "win32" or not events:
        return
    extra = ctypes.c_ulong(0)
    extra_ptr = ctypes.pointer(extra)
    records = (_INPUT * len(events))()
    for index, (vk, scan, flags) in enumerate(events):
        records[index].type = INPUT_KEYBOARD
        records[index].ii.ki.wVk = vk
        records[index].ii.ki.wScan = scan
        records[index].ii.ki.dwFlags = flags
        records[index].ii.ki.time = 0
        records[index].ii.ki.dwExtraInfo = extra_ptr
    sent = ctypes.windll.user32.SendInput(
        len(events), ctypes.byref(records), ctypes.sizeof(_INPUT)
    )
    if sent != len(events):
        for vk, scan, flags in events:
            ctypes.windll.user32.keybd_event(vk & 0xFF, scan & 0xFF, flags, 0)


def _default_controller() -> _KeyController:
    if sys.platform == "win32":
        return Win32HoldController()
    return _PynputController()


def _to_pynput_key(name: str) -> Any:
    from pynput.keyboard import Key, KeyCode

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


class _KEYBDINPUT(ctypes.Structure):
    _fields_ = [
        ("wVk", ctypes.c_ushort),
        ("wScan", ctypes.c_ushort),
        ("dwFlags", ctypes.c_ulong),
        ("time", ctypes.c_ulong),
        ("dwExtraInfo", ctypes.POINTER(ctypes.c_ulong)),
    ]


class _MOUSEINPUT(ctypes.Structure):
    _fields_ = [
        ("dx", ctypes.c_long),
        ("dy", ctypes.c_long),
        ("mouseData", ctypes.c_ulong),
        ("dwFlags", ctypes.c_ulong),
        ("time", ctypes.c_ulong),
        ("dwExtraInfo", ctypes.POINTER(ctypes.c_ulong)),
    ]


class _HARDWAREINPUT(ctypes.Structure):
    _fields_ = [
        ("uMsg", ctypes.c_ulong),
        ("wParamL", ctypes.c_short),
        ("wParamH", ctypes.c_ushort),
    ]


class _INPUT_I(ctypes.Union):
    _fields_ = [("ki", _KEYBDINPUT), ("mi", _MOUSEINPUT), ("hi", _HARDWAREINPUT)]


class _INPUT(ctypes.Structure):
    _fields_ = [("type", ctypes.c_ulong), ("ii", _INPUT_I)]
