"""Press a mapping's keys on request from another local program (voice control).

Holds are leases: a caller that wants a mapping held must repeat ``down``
before ``lease_seconds`` runs out, so a closed browser or crashed client never
leaves a key stuck down.
"""

from __future__ import annotations

import threading
import time
from typing import Any, Callable

from access_adapter.keys import KeyInjector
from access_adapter.mapping import MappingRule
from access_adapter.state import AppState

PRESS_STATES = ("down", "up", "pulse")


class RemotePresses:
    def __init__(
        self,
        state: AppState,
        injector: KeyInjector | None = None,
        *,
        lease_seconds: float = 2.5,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.state = state
        self._injector = injector
        self.lease_seconds = lease_seconds
        self._clock = clock
        self._leases: dict[str, tuple[float, list[str]]] = {}
        self._lock = threading.Lock()
        self._thread: threading.Thread | None = None

    @property
    def injector(self) -> KeyInjector:
        if self._injector is None:
            self._injector = KeyInjector()
        return self._injector

    def held_mappings(self) -> list[str]:
        with self._lock:
            return list(self._leases)

    def press(self, mapping_id: str, press_state: str) -> dict[str, Any]:
        if press_state not in PRESS_STATES:
            raise ValueError(f"state must be one of: {', '.join(PRESS_STATES)}")
        rule = self._find_rule(mapping_id)
        with self._lock:
            if press_state == "down":
                self._leases[rule.id] = (self._clock() + self.lease_seconds, list(rule.keys))
            elif press_state == "up":
                self._leases.pop(rule.id, None)
            self._sync_locked()
        if press_state == "pulse":
            self.injector.tap(rule.keys)
        if press_state == "down":
            self._ensure_expiry_thread()
        return {"mapping": rule.id, "label": rule.label, "keys": list(rule.keys), "state": press_state}

    def release_all(self) -> None:
        with self._lock:
            self._leases.clear()
            self._sync_locked()

    def expire(self) -> None:
        now = self._clock()
        with self._lock:
            expired = [rule_id for rule_id, (until, _keys) in self._leases.items() if until <= now]
            for rule_id in expired:
                del self._leases[rule_id]
            if expired:
                self._sync_locked()

    def _find_rule(self, mapping_id: str) -> MappingRule:
        cleaned = str(mapping_id or "").strip()
        if not cleaned:
            raise ValueError("mapping is required")
        for rule in self.state.config.rules:
            if rule.id == cleaned:
                if not rule.enabled:
                    raise ValueError(f"Mapping {cleaned} is turned off")
                return rule
        raise KeyError(cleaned)

    def _sync_locked(self) -> None:
        wanted: list[str] = []
        for _until, keys in self._leases.values():
            wanted.extend(key for key in keys if key not in wanted)
        self.injector.sync(wanted)

    def _ensure_expiry_thread(self) -> None:
        if self._thread is not None and self._thread.is_alive():
            return
        self._thread = threading.Thread(target=self._expiry_loop, name="remote-press-leases", daemon=True)
        self._thread.start()

    def _expiry_loop(self) -> None:
        while True:
            time.sleep(0.2)
            self.expire()
            with self._lock:
                if not self._leases:
                    self._thread = None
                    return
