"""JSON settings for sensor mappings and adapter behavior.

Search order for the file:

1. ``ACCESS_ADAPTER_CONFIG`` when it is set
2. ``%APPDATA%/GameNightAccessAdapter/config.json`` on Windows
3. ``$XDG_CONFIG_HOME/game-night-access-adapter/config.json`` otherwise
   (``~/.config/game-night-access-adapter/config.json`` when XDG is unset)
"""

from __future__ import annotations

from dataclasses import dataclass, field
import json
import os
from pathlib import Path
import tempfile
from typing import Any

from access_adapter.mapping import MappingRule, default_rules, rule_from_dict
from access_adapter.version import DEFAULT_HOST, DEFAULT_PORT


@dataclass
class AppConfig:
    selected_serial: str = ""
    injection_enabled: bool = True
    single_axis_only: bool = True
    axis_dominance: float = 1.0
    invert_x: bool = False
    invert_y: bool = False
    poll_interval: float = 0.08
    api_host: str = DEFAULT_HOST
    api_port: int = DEFAULT_PORT
    rules: list[MappingRule] = field(default_factory=default_rules)

    def to_dict(self) -> dict[str, Any]:
        return {
            "selected_serial": self.selected_serial,
            "injection_enabled": self.injection_enabled,
            "single_axis_only": self.single_axis_only,
            "axis_dominance": self.axis_dominance,
            "invert_x": self.invert_x,
            "invert_y": self.invert_y,
            "poll_interval": self.poll_interval,
            "api_host": self.api_host,
            "api_port": self.api_port,
            "rules": [rule.to_dict() for rule in self.rules],
        }

    def mapping_kwargs(self) -> dict[str, Any]:
        return {
            "single_axis_only": self.single_axis_only,
            "axis_dominance": self.axis_dominance,
            "invert_x": self.invert_x,
            "invert_y": self.invert_y,
        }


def default_config_path() -> Path:
    override = os.environ.get("ACCESS_ADAPTER_CONFIG", "").strip()
    if override:
        return Path(override).expanduser()
    if os.name == "nt":
        root = os.environ.get("APPDATA") or str(Path.home() / "AppData" / "Roaming")
        return Path(root) / "GameNightAccessAdapter" / "config.json"
    xdg = os.environ.get("XDG_CONFIG_HOME", "").strip()
    root = Path(xdg).expanduser() if xdg else Path.home() / ".config"
    return root / "game-night-access-adapter" / "config.json"


def config_from_dict(data: dict[str, Any]) -> AppConfig:
    rules_raw = data.get("rules")
    if rules_raw is None:
        rules = default_rules()
    else:
        if not isinstance(rules_raw, list):
            raise ValueError("rules must be a list")
        rules = [rule_from_dict(item) for item in rules_raw]
        ids = [rule.id for rule in rules]
        if len(ids) != len(set(ids)):
            raise ValueError("Mapping ids must be unique")

    try:
        poll_interval = float(data.get("poll_interval", 0.08))
        axis_dominance = float(data.get("axis_dominance", 1.0))
        api_port = int(data.get("api_port", DEFAULT_PORT))
    except (TypeError, ValueError) as exc:
        raise ValueError("Numeric setting is invalid") from exc
    if poll_interval <= 0:
        raise ValueError("poll_interval must be greater than 0")
    if axis_dominance < 1:
        raise ValueError("axis_dominance must be at least 1")
    if not 1 <= api_port <= 65535:
        raise ValueError("api_port must be between 1 and 65535")

    return AppConfig(
        selected_serial=str(data.get("selected_serial", "") or ""),
        injection_enabled=bool(data.get("injection_enabled", True)),
        single_axis_only=bool(data.get("single_axis_only", True)),
        axis_dominance=axis_dominance,
        invert_x=bool(data.get("invert_x", False)),
        invert_y=bool(data.get("invert_y", False)),
        poll_interval=poll_interval,
        api_host=str(data.get("api_host", DEFAULT_HOST) or DEFAULT_HOST),
        api_port=api_port,
        rules=rules,
    )


def load_config(path: Path | None = None) -> AppConfig:
    target = path or default_config_path()
    if not target.is_file():
        return AppConfig()
    try:
        data = json.loads(target.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Settings file is not valid JSON: {target}") from exc
    if not isinstance(data, dict):
        raise ValueError("Settings file must contain a JSON object")
    return config_from_dict(data)


def save_config(config: AppConfig, path: Path | None = None) -> Path:
    target = path or default_config_path()
    target.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(config.to_dict(), indent=2) + "\n"
    fd, tmp_name = tempfile.mkstemp(prefix=".config-", dir=target.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp_name, target)
    except Exception:
        try:
            os.unlink(tmp_name)
        except OSError:
            pass
        raise
    return target
