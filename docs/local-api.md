# Local API

The desktop app serves a JSON API on the loopback interface so scripts and a future browser extension can change mappings without clicking through the window.

Default base URL: `http://127.0.0.1:8765/api/v1`

Override the port with `ACCESS_ADAPTER_PORT`. The process refuses to bind anything other than loopback unless `ACCESS_ADAPTER_ALLOW_LAN=1` is set. Leave that unset on a shared network. There is no authentication, because the listener is local.

Successful responses:

```json
{"ok": true, "data": {}}
```

Errors:

```json
{"ok": false, "error": {"code": "INVALID_PAYLOAD", "message": "..."}}
```

| Code | HTTP | When |
|------|------|------|
| `INVALID_PAYLOAD` | 400 | Missing field, bad endpoint, bad key name |
| `NOT_FOUND` | 404 | Unknown path or mapping id |
| `DEVICE_OFFLINE` | 503 | `adb` failed or is not installed |
| `SERVICE_ERROR` | 500 | Unexpected failure |

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/health` | Version and status |
| GET | `/api/v1/settings` | Behavior settings (not the mapping list) |
| PUT | `/api/v1/settings` | Update one or more settings |
| GET | `/api/v1/mappings` | Current sensor mappings |
| PUT | `/api/v1/mappings` | Replace the list. Body: `{"rules": [ ... ]}` |
| POST | `/api/v1/mappings` | Add one rule. `id` is optional. `keys` may be a string such as `ctrl+left`. `press_mode` is `hold` or `once` |
| DELETE | `/api/v1/mappings/{id}` | Remove one rule |
| GET | `/api/v1/devices` | Last scan |
| POST | `/api/v1/devices/scan` | Run `adb devices -l` and `adb mdns services` |
| POST | `/api/v1/devices/connect` | `{"endpoint": "192.168.1.20:5555"}` |
| POST | `/api/v1/devices/pair` | `{"endpoint": "192.168.1.20:37123", "code": "123456"}` |
| POST | `/api/v1/devices/disconnect` | `{"serial": "192.168.1.20:5555"}` |
| POST | `/api/v1/devices/select` | `{"serial": "..."}` stored as the phone to read |
| GET | `/api/v1/sensors` | Latest sample, active keys, whether the bridge is running |
| POST | `/api/v1/bridge/start` | Start reading the selected phone |
| POST | `/api/v1/bridge/stop` | Stop reading and release every held key |
| POST | `/api/v1/injection` | `{"enabled": false}` pauses key presses |
| POST | `/api/v1/calibrate` | Save rest-pose offsets. Body may be empty (uses the latest sample) or `{"ax": 1.2, "ay": 0.1, "az": 9.6}` |
| POST | `/api/v1/calibrate/reset` | Clear rest-pose offsets |

Settings that PUT accepts: `selected_serial`, `injection_enabled`, `single_axis_only`, `axis_dominance`, `invert_x`, `invert_y`, `offset_ax`, `offset_ay`, `offset_az`, `poll_interval`.

### Examples

```bash
curl -s http://127.0.0.1:8765/api/v1/health
curl -s http://127.0.0.1:8765/api/v1/mappings
curl -s -X POST http://127.0.0.1:8765/api/v1/devices/scan
curl -s -X PUT http://127.0.0.1:8765/api/v1/settings \
  -H 'Content-Type: application/json' \
  -d '{"axis_dominance": 1.15, "invert_x": true}'
```

Changes are written to the settings file described in [desktop-app.md](desktop-app.md).
