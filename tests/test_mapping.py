"""Phase 1: sensor readings become keyboard combinations."""

import pytest

from access_adapter.mapping import (
    MappingRule,
    SensorSample,
    active_key_names,
    default_rules,
    parse_key_combination,
    rule_from_dict,
)


def _sample(**kwargs) -> SensorSample:
    return SensorSample(**kwargs)


def test_default_tilt_left_holds_a():
    keys = active_key_names(default_rules(), _sample(ax=-4.0), axis_dominance=1.0)
    assert keys == ["a"]


def test_default_tilt_forward_holds_w():
    keys = active_key_names(default_rules(), _sample(ay=-4.0), axis_dominance=1.0)
    assert keys == ["w"]


def test_inside_deadzone_holds_nothing():
    keys = active_key_names(default_rules(), _sample(ax=-1.0, ay=1.0))
    assert keys == []


def test_ambiguous_diagonal_holds_nothing_when_dominance_is_strict():
    keys = active_key_names(
        default_rules(),
        _sample(ax=-3.0, ay=-3.0),
        single_axis_only=True,
        axis_dominance=1.15,
    )
    assert keys == []


def test_dominant_axis_wins():
    keys = active_key_names(
        default_rules(),
        _sample(ax=-4.0, ay=-3.0),
        single_axis_only=True,
        axis_dominance=1.15,
    )
    assert keys == ["a"]


def test_single_axis_off_holds_both_directions():
    keys = active_key_names(
        default_rules(),
        _sample(ax=-4.0, ay=-4.0),
        single_axis_only=False,
    )
    assert keys == ["a", "w"]


def test_combination_holds_every_key_in_the_rule():
    rules = [
        MappingRule(
            id="boost-left",
            label="Boost left",
            sensor="accelerometer",
            axis="x",
            comparator="lt",
            threshold=-2.0,
            keys=["ctrl", "left"],
        )
    ]
    assert active_key_names(rules, _sample(ax=-3)) == ["ctrl", "left"]


def test_disabled_rule_is_ignored():
    rules = default_rules()
    rules[0].enabled = False
    assert active_key_names(rules, _sample(ax=-5)) == []


def test_invert_x_flips_left_and_right():
    keys = active_key_names(
        default_rules(),
        _sample(ax=-4.0),
        invert_x=True,
        axis_dominance=1.0,
    )
    assert keys == ["d"]


def test_gyroscope_rule():
    rules = [
        MappingRule(
            id="spin",
            label="Spin",
            sensor="gyroscope",
            axis="z",
            comparator="abs_gt",
            threshold=1.5,
            keys=["space"],
        )
    ]
    assert active_key_names(rules, _sample(gz=2.0)) == ["space"]
    assert active_key_names(rules, _sample(gz=0.2)) == []


def test_parse_key_combination_accepts_aliases():
    assert parse_key_combination("Ctrl+Left") == ["ctrl", "left"]
    assert parse_key_combination("w") == ["w"]


def test_unknown_key_is_rejected():
    with pytest.raises(ValueError):
        parse_key_combination("not-a-key")


def test_rule_from_dict_accepts_combination_string():
    rule = rule_from_dict(
        {
            "id": "custom",
            "label": "Custom",
            "sensor": "accelerometer",
            "axis": "z",
            "comparator": "gt",
            "threshold": 8,
            "keys": "shift+space",
        }
    )
    assert rule.keys == ["shift", "space"]
    assert rule.press_mode == "hold"


def test_rule_from_dict_accepts_once_press_mode():
    rule = rule_from_dict(
        {
            "id": "tap-left",
            "label": "Tap left",
            "sensor": "accelerometer",
            "axis": "x",
            "comparator": "lt",
            "threshold": -2.8,
            "keys": ["a"],
            "press_mode": "tap",
        }
    )
    assert rule.press_mode == "once"
