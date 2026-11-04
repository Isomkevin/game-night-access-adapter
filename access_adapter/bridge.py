"""Poll the selected phone and hold the keys its mappings ask for."""

from __future__ import annotations

import threading

from access_adapter.keys import KeyInjector
from access_adapter.mapping import SensorSample
from access_adapter.sensors import SensorReader
from access_adapter.state import AppState


class SensorBridge:
    """Background reader. ``apply_sample`` is the single place keys are updated."""

    def __init__(
        self,
        state: AppState,
        injector: KeyInjector | None = None,
        reader_factory=None,
    ) -> None:
        self.state = state
        self._injector = injector
        self._reader_factory = reader_factory or (lambda serial: SensorReader(serial))
        self._reader: SensorReader | None = None
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    @property
    def injector(self) -> KeyInjector:
        if self._injector is None:
            self._injector = KeyInjector()
        return self._injector

    def start(self) -> None:
        serial = self.state.config.selected_serial.strip()
        if not serial:
            raise RuntimeError("Select a phone first")
        if self.state.bridge_running:
            return
        self._reader = self._reader_factory(serial)
        self.state.bridge_error = ""
        self.state.bridge_running = True
        self._stop.clear()
        self._thread = threading.Thread(target=self._loop, name="sensor-bridge", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread is not None and self._thread.is_alive():
            self._thread.join(timeout=2.0)
        self._thread = None
        if self._injector is not None:
            self._injector.release_all()
        self.state.bridge_running = False

    def apply_sample(self, sample: SensorSample) -> list[str]:
        keys = self.state.note_sample(sample)
        if self.state.config.injection_enabled:
            self.injector.sync(keys)
        else:
            self.injector.release_all()
        return list(self.state.active_keys)

    def _loop(self) -> None:
        while not self._stop.is_set():
            reader = self._reader
            try:
                if reader is None:
                    raise RuntimeError("Sensor reader is not ready")
                sample = reader.read_once()
                self.apply_sample(sample)
                self.state.bridge_error = ""
            except Exception as exc:  # noqa: BLE001 — keep reading after a bad sample
                self.state.bridge_error = str(exc)
            self._stop.wait(max(0.02, float(self.state.config.poll_interval)))
