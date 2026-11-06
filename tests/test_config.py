"""Phase 1: settings round-trip and validation."""

from pathlib import Path

import pytest

from access_adapter.config import AppConfig, config_from_dict, load_config, save_config
from access_adapter.mapping import default_rules


def test_default_config_has_four_tilt_mappings():
    config = AppConfig()
    assert [rule.id for rule in config.rules] == [rule.id for rule in default_rules()]
    assert config.injection_enabled is True
    assert config.single_axis_only is True


def test_save_and_load_round_trip(tmp_path: Path):
    path = tmp_path / "config.json"
    config = AppConfig(selected_serial="192.168.1.20:5555", invert_x=True)
    config.rules[0].keys = ["left"]
    save_config(config, path)
    loaded = load_config(path)
    assert loaded.selected_serial == "192.168.1.20:5555"
    assert loaded.invert_x is True
    assert loaded.rules[0].keys == ["left"]
    assert loaded.rules[1].id == "tilt-right"


def test_missing_file_returns_defaults(tmp_path: Path):
    loaded = load_config(tmp_path / "missing.json")
    assert len(loaded.rules) == 4


def test_duplicate_ids_rejected():
    payload = AppConfig().to_dict()
    payload["rules"][1]["id"] = payload["rules"][0]["id"]
    with pytest.raises(ValueError, match="unique"):
        config_from_dict(payload)


def test_dominance_below_one_rejected():
    with pytest.raises(ValueError, match="axis_dominance"):
        config_from_dict({"axis_dominance": 0.5})


def test_invalid_json_raises(tmp_path: Path):
    path = tmp_path / "config.json"
    path.write_text("{", encoding="utf-8")
    with pytest.raises(ValueError, match="JSON"):
        load_config(path)
