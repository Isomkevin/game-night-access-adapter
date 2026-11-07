"""Hold and release operating-system keys for the active sensor mappings.

``KeyInjector`` talks to ``pynput`` unless a controller is passed in. Tests pass
a fake controller and never touch the real keyboard.
"""

from __future__ import annotations

from typing import Any, Iterable, Protocol

from access_adapter.mapping import MappingRule, canonical_key


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
    return KeyCode.from_char(name)
