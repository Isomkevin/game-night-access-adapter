# Development phases

Each phase is implemented, tested, and committed before the next one starts. Commands below are what that phase's tests cover. Re-run them from the repository root.

## Phase 1 — Mapping engine and settings

Sensor readings turn into keyboard combinations. Settings load and save as JSON.

```bash
python3 -m pytest tests/test_mapping.py tests/test_config.py tests/test_keys.py -q
```

Covered:

- Default tilt profile (left / right / forward / back → A / D / W / S)
- Deadzone, axis dominance, invert, disabled rules
- Multi-key combinations
- Settings round-trip and rejection of duplicate ids
- Key injector presses only the requested keys (fake keyboard)

## Phase 2 — ADB device scan

USB and wireless devices are classified from `adb devices -l`. Pair and connect check the endpoint and the 6-digit code before calling `adb`.

```bash
python3 -m pytest tests/test_adb_devices.py -q
```

Covered:

- USB serial, `host:port`, `adb-tls` name, and emulator classification
- mDNS connect vs pairing rows
- Rejected endpoints never invoke `adb`
- Missing `adb` reports a clear error

## Phase 3 — Local API

`http://127.0.0.1:8765/api/v1` (port 0 in tests) reads and writes mappings, scans devices, and refuses a non-loopback bind.

```bash
python3 -m pytest tests/test_api.py -q
```

Covered:

- Health, default mappings, replace / add / delete, settings saved to disk
- Scan classifies USB and wireless; connect and select
- Bad endpoint returns HTTP 400
- Bind to `0.0.0.0` is rejected

## Phase 4 — PySide window

The main screen is the sensor mapping table. Add device scans USB and wireless phones. Tests use the offscreen Qt platform and do not move the real mouse.

```bash
QT_QPA_PLATFORM=offscreen python3 -m pytest tests/test_ui.py -q
```

Covered:

- Default four mappings render in the table
- Dominance, invert, add, and remove update the saved settings
- Scan lists a USB serial and a wireless `host:port`, then selects the USB phone
- A stored sample shows the key that would be held

## Phase 5 — Live sensor bridge

The selected phone is polled with `adb shell dumpsys sensorservice`. Matching mappings hold keys while injection is enabled. The window refreshes the live readout, and the API can start and stop the bridge.

```bash
python3 -m pytest tests/test_bridge.py -q
python3 -m access_adapter --version
```

Covered:

- Dumpsys text becomes accelerometer and gyroscope values for one serial
- A left tilt presses `a`; pausing injection releases keys and still reports the match
- The reader loop stops cleanly and releases keys
- `POST /api/v1/bridge/start` on a selected phone reports the active key
- Start reading with no phone selected explains that in the window

## Later phases

| Phase | Work |
|-------|------|
| 6 | Windows and Linux installers |
