# Input protocol

Shared contract between the Chrome extension, local bridge, camera, voice, and phone controller.

Source of truth in code: [`packages/shared/protocol.js`](../packages/shared/protocol.js) and [`packages/shared/actions.js`](../packages/shared/actions.js).

## Transport

- Local bridge WebSocket: `ws://127.0.0.1:18765` (default)
- Bridge also serves HTTP on the same port for the phone controller page
- Extension connects as role `extension`
- Phone / camera / voice connect as role `phone` | `camera` | `voice`

Each text frame is one JSON object.

## Input event

```json
{
  "type": "input",
  "source": "camera|voice|phone|demo",
  "action": "steerLeft",
  "state": "down|up|pulse",
  "strength": 1.0,
  "ts": 1730000000000,
  "v": 1
}
```

| Field | Meaning |
| --- | --- |
| `action` | Logical input id **before** remap (e.g. `tiltLeft`) **or** already a game action — see below |
| `state` | `down` / `up` for holds; `pulse` for one-shots (voice) |
| `strength` | Optional 0..1 (head/phone tilt magnitude) |

### Logical vs game actions

Input sources should send **logical** ids via the `action` field using the names after the colon in remap keys:

- Camera: `tiltLeft`, `tiltRight`
- Voice: `turnLeft`, `turnRight`, `go`, `stop`, `boost`, `pause`
- Phone: `tiltLeft`, `tiltRight`, `throttle`, `brake`, `boost`
- Demo: `steerLeft`, `steerRight`, `throttle`, `brake`, `boost`, `pause`

The extension builds a remap key as `` `${source}:${action}` `` and looks up the player's mapping to a **game action** (`steerLeft`, `throttle`, …), then injects the matching LibreCorsa `KeyboardEvent.code`.

## Hello / status

```json
{ "type": "hello", "role": "extension|phone|camera|voice", "v": 1, "ts": 0 }
```

```json
{ "type": "status", "clients": { "extension": 1, "phone": 0 }, "v": 1, "ts": 0 }
```

## Default LibreCorsa keys

| Game action | `KeyboardEvent.code` |
| --- | --- |
| steerLeft / steerRight | KeyA / KeyD |
| throttle / brake | KeyW / KeyS |
| boost | Space |
| pause | Escape |
| shiftUp / shiftDown | KeyE / KeyQ |
| aero | KeyX |
| restart | Backspace |

## Phone = software controller

The phone opens a local web page over LAN Wi‑Fi and streams orientation over WebSocket. No USB/ADB. This is intentional for the challenge's no-extra-hardware rule and for Justin's macOS laptop.
