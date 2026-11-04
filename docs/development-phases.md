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

## Later phases

| Phase | Work |
|-------|------|
| 2 | Scan USB and wireless ADB devices |
| 3 | Local API |
| 4 | PySide main window for mappings and Add device |
| 5 | Live sensor bridge wired to the window and the API |
| 6 | Windows and Linux installers |
