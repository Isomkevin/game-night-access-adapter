"""Shared application state for the window and the local API."""

from __future__ import annotations

from pathlib import Path
import threading
import uuid
from typing import Any

from access_adapter.adb_devices import AdbClient, AdbDevice, WirelessService
from access_adapter.config import AppConfig, config_from_dict, load_config, save_config
from access_adapter.mapping import MappingRule, SensorSample, active_key_names, rule_from_dict


class AppState:
    """Config, last device scan, and the latest sensor sample.

    The sensor bridge (added with the live reader) writes ``last_sample``.
    Until it is running, the sample stays empty and ``bridge_running`` is false.
    """

    def __init__(
        self,
        config_path: Path | None = None,
        adb: AdbClient | None = None,
        config: AppConfig | None = None,
    ) -> None:
        self.config_path = config_path
        self.config = config if config is not None else load_config(config_path)
        self.adb = adb or AdbClient()
        self.devices: list[AdbDevice] = []
        self.wireless: list[WirelessService] = []
        self.last_sample = SensorSample()
        self.active_keys: list[str] = []
        self.bridge_running = False
        self.bridge_error = ""
        self._lock = threading.Lock()

    def save(self) -> None:
        if self.config_path is None:
            return
        save_config(self.config, self.config_path)

    def settings_dict(self) -> dict[str, Any]:
        data = self.config.to_dict()
        data.pop("rules", None)
        return data

    def update_settings(self, payload: dict[str, Any]) -> dict[str, Any]:
        allowed = {
            "selected_serial",
            "injection_enabled",
            "single_axis_only",
            "axis_dominance",
            "invert_x",
            "invert_y",
            "poll_interval",
        }
        unknown = sorted(set(payload) - allowed)
        if unknown:
            raise ValueError(f"Unknown setting: {', '.join(unknown)}")
        merged = self.config.to_dict()
        merged.update(payload)

        with self._lock:
            rules = self.config.rules
            self.config = config_from_dict(merged)
            self.config.rules = rules
            self._refresh_active_keys_locked()
        self.save()
        return self.settings_dict()

    def mappings_dict(self) -> dict[str, Any]:
        return {"rules": [rule.to_dict() for rule in self.config.rules]}

    def replace_mappings(self, rules_payload: list[dict[str, Any]]) -> dict[str, Any]:
        rules = [rule_from_dict(item) for item in rules_payload]
        ids = [rule.id for rule in rules]
        if len(ids) != len(set(ids)):
            raise ValueError("Mapping ids must be unique")
        with self._lock:
            self.config.rules = rules
            self._refresh_active_keys_locked()
        self.save()
        return self.mappings_dict()

    def add_mapping(self, payload: dict[str, Any]) -> MappingRule:
        data = dict(payload)
        if not str(data.get("id", "")).strip():
            data["id"] = uuid.uuid4().hex[:8]
        rule = rule_from_dict(data)
        with self._lock:
            if any(existing.id == rule.id for existing in self.config.rules):
                raise ValueError(f"Mapping id {rule.id} already exists")
            self.config.rules.append(rule)
            self._refresh_active_keys_locked()
        self.save()
        return rule

    def update_mapping(self, rule_id: str, payload: dict[str, Any]) -> MappingRule:
        data = dict(payload)
        data["id"] = rule_id
        rule = rule_from_dict(data)
        with self._lock:
            for index, existing in enumerate(self.config.rules):
                if existing.id == rule_id:
                    self.config.rules[index] = rule
                    self._refresh_active_keys_locked()
                    break
            else:
                raise KeyError(rule_id)
        self.save()
        return rule

    def delete_mapping(self, rule_id: str) -> None:
        with self._lock:
            kept = [rule for rule in self.config.rules if rule.id != rule_id]
            if len(kept) == len(self.config.rules):
                raise KeyError(rule_id)
            self.config.rules = kept
            self._refresh_active_keys_locked()
        self.save()

    def select_device(self, serial: str) -> str:
        cleaned = serial.strip()
        if not cleaned:
            raise ValueError("serial is required")
        with self._lock:
            self.config.selected_serial = cleaned
        self.save()
        return cleaned

    def scan_devices(self) -> dict[str, Any]:
        devices = self.adb.scan()
        wireless = self.adb.discover_wireless()
        with self._lock:
            self.devices = devices
            self.wireless = wireless
        return self.devices_dict()

    def devices_dict(self) -> dict[str, Any]:
        return {
            "selected_serial": self.config.selected_serial,
            "devices": [device.to_dict() for device in self.devices],
            "wireless": [service.to_dict() for service in self.wireless],
        }

    def sensors_dict(self) -> dict[str, Any]:
        sample = self.last_sample
        return {
            "bridge_running": self.bridge_running,
            "bridge_error": self.bridge_error,
            "injection_enabled": self.config.injection_enabled,
            "active_keys": list(self.active_keys),
            "sample": {
                "ax": sample.ax,
                "ay": sample.ay,
                "az": sample.az,
                "gx": sample.gx,
                "gy": sample.gy,
                "gz": sample.gz,
                "source": sample.source,
                "ts": sample.ts,
            },
        }

    def note_sample(self, sample: SensorSample) -> list[str]:
        """Store a reading and recompute the keys the bridge should hold."""
        with self._lock:
            self.last_sample = sample
            self._refresh_active_keys_locked()
            return list(self.active_keys)

    def _refresh_active_keys_locked(self) -> None:
        self.active_keys = active_key_names(
            self.config.rules,
            self.last_sample,
            **self.config.mapping_kwargs(),
        )
