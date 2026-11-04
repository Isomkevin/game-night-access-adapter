# Desktop application

Cross-platform (Windows and Linux) desktop app that maps Android phone sensors to keyboard combinations and exposes those controls on a local API.

The earlier phone-tilt proof of concept under `adapters/phone_tilt/` is unchanged. This application is the configurable version of that idea: mappings live in a settings file, devices are chosen from an ADB scan, and the main window edits the mappings.

## Layout

```text
access_adapter/
  mapping.py     sensor sample → key combination
  config.py      JSON settings
  keys.py        press / release the active combination
  version.py     version shared with installers
tests/           phase tests
```

Later phases add device scanning, the local API, the PySide window, and installers. See [development-phases.md](development-phases.md).

## Settings file

| Platform | Path |
|----------|------|
| Linux | `~/.config/game-night-access-adapter/config.json` |
| Windows | `%APPDATA%\GameNightAccessAdapter\config.json` |
| Either | path in `ACCESS_ADAPTER_CONFIG` |

The file is created when you save from the app or the API. Until then the built-in tilt profile is used:

| Label | Sensor | Condition | Keys |
|-------|--------|-----------|------|
| Steer left | accelerometer X | below −2.8 m/s² | `a` |
| Steer right | accelerometer X | above 2.8 m/s² | `d` |
| Accelerate | accelerometer Y | below −2.8 m/s² | `w` |
| Brake | accelerometer Y | above 2.8 m/s² | `s` |

A mapping's `keys` list is a **combination**: every listed key is held at the same time while the condition is true. `["ctrl", "left"]` holds Ctrl and Left together.

### Behavior settings

| Field | Default | Meaning |
|-------|---------|---------|
| `single_axis_only` | `true` | When several mappings match, hold only the strongest one |
| `axis_dominance` | `1.0` | Strongest reading must be at least this many times the next reading. Raise it (for example `1.15`) to ignore ambiguous diagonals |
| `invert_x` / `invert_y` | `false` | Flip an axis for the way the phone is held |
| `poll_interval` | `0.08` | Seconds between sensor reads |
| `injection_enabled` | `true` | When false, show the active mapping but do not press keys |
| `selected_serial` | empty | ADB serial chosen in Add device |

Comparators:

| Value | Fires when |
|-------|------------|
| `gt` | axis > threshold |
| `lt` | axis < threshold |
| `abs_gt` | abs(axis) > threshold |

Sensors are `accelerometer` and `gyroscope`. Axes are `x`, `y`, and `z`.

## Run the tests for this phase

```bash
python3 -m pip install -r requirements-dev.txt
python3 -m pytest tests/test_mapping.py tests/test_config.py tests/test_keys.py -q
```

`tests/test_keys.py` uses a fake keyboard. It does not type into the focused window.
