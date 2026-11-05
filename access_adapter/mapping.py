"""Map a phone motion sample to the keyboard combination that should be held.

A rule watches one sensor axis. While the axis satisfies the comparator, every
key in that rule is held together (a combination, not a sequence). When several
rules match and ``single_axis_only`` is set, only the strongest reading is
used, and only when it beats the next reading by ``axis_dominance``.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
import re
from typing import Any, Iterable


SENSORS = ("accelerometer", "gyroscope")
AXES = ("x", "y", "z")
COMPARATORS = ("gt", "lt", "abs_gt")

# Names accepted in mapping config. Single letters and digits are also valid.
_SPECIAL_KEYS = {
    "space": "space",
    "enter": "enter",
    "return": "enter",
    "tab": "tab",
    "esc": "esc",
    "escape": "esc",
    "shift": "shift",
    "ctrl": "ctrl",
    "control": "ctrl",
    "alt": "alt",
    "up": "up",
    "down": "down",
    "left": "left",
    "right": "right",
    "backspace": "backspace",
    "delete": "delete",
    "home": "home",
    "end": "end",
    "pageup": "pageup",
    "pagedown": "pagedown",
    "insert": "insert",
}


@dataclass(frozen=True)
class SensorSample:
    """One accelerometer and gyroscope reading. Units are m/s² and rad/s."""

    ax: float = 0.0
    ay: float = 0.0
    az: float = 0.0
    gx: float = 0.0
    gy: float = 0.0
    gz: float = 0.0
    source: str = "none"
    ts: float = 0.0


@dataclass
class MappingRule:
    """One sensor condition and the keys it holds while the condition is true."""

    id: str
    label: str
    sensor: str
    axis: str
    comparator: str
    threshold: float
    keys: list[str]
    enabled: bool = True

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def canonical_key(token: str) -> str:
    """Normalize one key token from a mapping (``Ctrl``, ``left``, ``w``)."""
    name = token.strip().lower()
    if not name:
        raise ValueError("Key name is empty")
    if name in _SPECIAL_KEYS:
        return _SPECIAL_KEYS[name]
    if re.fullmatch(r"f([1-9]|1[0-2])", name):
        return name
    if len(name) == 1 and name.isalnum():
        return name
    raise ValueError(f"Unknown key {token!r}")


def parse_key_combination(text: str) -> list[str]:
    """Parse ``ctrl+left`` or ``w`` into a list of canonical key names."""
    raw = text.strip()
    if not raw:
        raise ValueError("A mapping needs at least one key")
    parts = re.split(r"\s*\+\s*", raw)
    keys = [canonical_key(part) for part in parts if part.strip()]
    if not keys:
        raise ValueError("A mapping needs at least one key")
    return keys


def format_key_combination(keys: Iterable[str]) -> str:
    return "+".join(keys)


def validate_rule(rule: MappingRule) -> None:
    if not rule.id.strip():
        raise ValueError("Mapping id is required")
    if not rule.label.strip():
        raise ValueError("Mapping label is required")
    if rule.sensor not in SENSORS:
        raise ValueError(f"Sensor must be one of: {', '.join(SENSORS)}")
    if rule.axis not in AXES:
        raise ValueError(f"Axis must be one of: {', '.join(AXES)}")
    if rule.comparator not in COMPARATORS:
        raise ValueError(f"Comparator must be one of: {', '.join(COMPARATORS)}")
    if not rule.keys:
        raise ValueError("A mapping needs at least one key")
    rule.keys = [canonical_key(key) for key in rule.keys]


def rule_from_dict(data: dict[str, Any]) -> MappingRule:
    try:
        keys = data["keys"]
        if isinstance(keys, str):
            keys = parse_key_combination(keys)
        rule = MappingRule(
            id=str(data["id"]).strip(),
            label=str(data["label"]).strip(),
            sensor=str(data["sensor"]).strip().lower(),
            axis=str(data["axis"]).strip().lower(),
            comparator=str(data["comparator"]).strip().lower(),
            threshold=float(data["threshold"]),
            keys=list(keys),
            enabled=bool(data.get("enabled", True)),
        )
    except KeyError as exc:
        raise ValueError(f"Mapping is missing {exc.args[0]}") from exc
    except (TypeError, ValueError) as exc:
        raise ValueError(str(exc)) from exc
    validate_rule(rule)
    return rule


def rest_offsets_from_sample(sample: SensorSample) -> dict[str, float]:
    """Treat the current accelerometer reading as the player's rest pose."""
    return {
        "offset_ax": float(sample.ax),
        "offset_ay": float(sample.ay),
        "offset_az": float(sample.az),
    }


def axis_value(
    sample: SensorSample,
    sensor: str,
    axis: str,
    *,
    invert_x: bool = False,
    invert_y: bool = False,
    offset_ax: float = 0.0,
    offset_ay: float = 0.0,
    offset_az: float = 0.0,
) -> float:
    table = {
        ("accelerometer", "x"): sample.ax - offset_ax,
        ("accelerometer", "y"): sample.ay - offset_ay,
        ("accelerometer", "z"): sample.az - offset_az,
        ("gyroscope", "x"): sample.gx,
        ("gyroscope", "y"): sample.gy,
        ("gyroscope", "z"): sample.gz,
    }
    try:
        value = table[(sensor, axis)]
    except KeyError as exc:
        raise ValueError(f"Unknown sensor axis {sensor}.{axis}") from exc
    if axis == "x" and invert_x:
        return -value
    if axis == "y" and invert_y:
        return -value
    return value


def rule_matches(
    rule: MappingRule,
    sample: SensorSample,
    *,
    invert_x: bool = False,
    invert_y: bool = False,
    offset_ax: float = 0.0,
    offset_ay: float = 0.0,
    offset_az: float = 0.0,
) -> bool:
    if not rule.enabled:
        return False
    value = axis_value(
        sample,
        rule.sensor,
        rule.axis,
        invert_x=invert_x,
        invert_y=invert_y,
        offset_ax=offset_ax,
        offset_ay=offset_ay,
        offset_az=offset_az,
    )
    if rule.comparator == "gt":
        return value > rule.threshold
    if rule.comparator == "lt":
        return value < rule.threshold
    if rule.comparator == "abs_gt":
        return abs(value) > rule.threshold
    raise ValueError(f"Unknown comparator {rule.comparator}")


def active_rules(
    rules: Iterable[MappingRule],
    sample: SensorSample,
    *,
    single_axis_only: bool = True,
    axis_dominance: float = 1.0,
    invert_x: bool = False,
    invert_y: bool = False,
    offset_ax: float = 0.0,
    offset_ay: float = 0.0,
    offset_az: float = 0.0,
) -> list[MappingRule]:
    """Return the rules whose keys should be held for this sample."""
    axis_kwargs = {
        "invert_x": invert_x,
        "invert_y": invert_y,
        "offset_ax": offset_ax,
        "offset_ay": offset_ay,
        "offset_az": offset_az,
    }
    matched: list[tuple[MappingRule, float]] = []
    for rule in rules:
        if not rule_matches(rule, sample, **axis_kwargs):
            continue
        magnitude = abs(axis_value(sample, rule.sensor, rule.axis, **axis_kwargs))
        matched.append((rule, magnitude))
    if not matched:
        return []
    if not single_axis_only:
        return [rule for rule, _magnitude in matched]

    matched.sort(key=lambda item: item[1], reverse=True)
    best_rule, best_magnitude = matched[0]
    if len(matched) == 1:
        return [best_rule]
    _runner_up, second_magnitude = matched[1]
    if second_magnitude <= 0:
        return [best_rule]
    if best_magnitude + 1e-9 >= second_magnitude * max(axis_dominance, 1.0):
        return [best_rule]
    return []


def active_key_names(
    rules: Iterable[MappingRule],
    sample: SensorSample,
    **kwargs: Any,
) -> list[str]:
    """Key names to hold, de-duplicated, in rule order."""
    held: list[str] = []
    seen: set[str] = set()
    for rule in active_rules(rules, sample, **kwargs):
        for key in rule.keys:
            if key not in seen:
                seen.add(key)
                held.append(key)
    return held


def default_rules() -> list[MappingRule]:
    """Tilt left/right/forward/back → A/D/W/S, one direction at a time."""
    return [
        MappingRule(
            id="tilt-left",
            label="Steer left",
            sensor="accelerometer",
            axis="x",
            comparator="lt",
            threshold=-2.8,
            keys=["a"],
        ),
        MappingRule(
            id="tilt-right",
            label="Steer right",
            sensor="accelerometer",
            axis="x",
            comparator="gt",
            threshold=2.8,
            keys=["d"],
        ),
        MappingRule(
            id="tilt-forward",
            label="Accelerate",
            sensor="accelerometer",
            axis="y",
            comparator="lt",
            threshold=-2.8,
            keys=["w"],
        ),
        MappingRule(
            id="tilt-back",
            label="Brake",
            sensor="accelerometer",
            axis="y",
            comparator="gt",
            threshold=2.8,
            keys=["s"],
        ),
    ]
