# Input protocol

Shared contract between the Chrome extension, local bridge, camera, voice, and phone controller.

Why these messages exist (product intent): [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md).

**Code source of truth:**

- [`packages/shared/protocol.js`](../packages/shared/protocol.js)
- [`packages/shared/actions.js`](../packages/shared/actions.js)
- Vendored copies: [`extension/lib/`](../extension/lib/)

If you change the wire format, update this doc **and** both copies in the same PR. See [packages/shared/README.md](../packages/shared/README.md).

## Transport

| Item | Value |
| --- | --- |
| WebSocket | `ws://127.0.0.1:18765` (default; override with `GNAA_PORT`) |
| HTTP (same port) | Serves `/phone/`, `/camera/`, `/voice/`, `/health` |
| Frame format | One JSON object per text frame |

### Roles (`hello`)

Clients should identify themselves once after connect:

```json
{ "type": "hello", "role": "extension|phone|camera|voice", "v": 1, "ts": 0 }
```

| Role | Who |
| --- | --- |
| `extension` | Chrome extension service worker (receives `input`) |
| `phone` | Phone controller page |
| `camera` | Vision controller page (head / face / hand / finger) |
| `voice` | Voice demo or toolkit Controllersender |

## Input event

```json
{
  "type": "input",
  "source": "camera|voice|phone|demo",
  "action": "tiltLeft",
  "state": "down|up|pulse",
  "strength": 1.0,
  "ts": 1730000000000,
  "v": 1
}
```

| Field | Required | Meaning |
| --- | --- | --- |
| `type` | yes | Always `"input"` |
| `source` | yes | Which device/channel produced the event |
| `action` | yes | **Logical** action id for that source (see below) |
| `state` | yes | `down` / `up` for holds; `pulse` for one-shots |
| `strength` | no | `0..1` analog intensity (tilt magnitude) |
| `ts` | recommended | Epoch ms |
| `v` | recommended | Protocol version (`1`) |

### Logical vs game actions

Senders emit **logical** ids. The extension remaps with key `` `${source}:${action}` ``.

| Source | Logical `action` values |
| --- | --- |
| `camera` | See **Camera logical actions** below |
| `voice` | `turnLeft`, `turnRight`, `go`, `stop`, `boost`, `pause`, `gearUp`, `gearDown` |
| `phone` | `tiltLeft`, `tiltRight`, `throttle`, `brake`, `boost` |
| `demo` | `steerLeft`, `steerRight`, `throttle`, `brake`, `boost`, `pause` |

#### Camera logical actions

Senders use gesture ids under `source: "camera"`. Only enabled gestures emit. Default remap keeps legacy yaw steering; other gestures are **unmapped until assigned**.

| Group | `action` ids |
| --- | --- |
| Head (legacy) | `tiltLeft`, `tiltRight` — yaw aliases; default → steer |
| Head | `headYawLeft`, `headYawRight`, `headPitchUp`, `headPitchDown`, `headRollLeft`, `headRollRight`, `headCloser`, `headFarther` (experimental) |
| Face | `mouthOpen`, `smile`, `browRaise`, `frown`, `blinkLeft`, `blinkRight`, `blinkBoth`, `squint` |
| Hands | `handRaise`, `handLeft`, `handRight`, `palmOpen`, `fist`, `thumbUp`, `thumbDown`, `pointUp` |
| Fingers | `pinch`, `indexPoint` |

Full catalog: [`camera/lib/catalog.js`](../camera/lib/catalog.js) and `LOGICAL_INPUTS` in shared protocol.

Game actions after remap (injected as keys):

`steerLeft`, `steerRight`, `throttle`, `brake`, `boost`, `pause`, `shiftUp`, `shiftDown`, `aero`, `restart`

Defaults live in `DEFAULT_REMAP` / `DEFAULT_KEY_CODES` in shared code.

### Hold vs pulse

| Pattern | Use | Extension behaviour |
| --- | --- | --- |
| `down` then later `up` | Steering, throttle, brake, boost holds | Matches keydown/keyup |
| `pulse` | Voice commands | keydown + short delayed keyup (~120ms) |

Always send `up` if you sent `down`, or the game will think the key is stuck.

### Camera refresh and partial steering

The head-only camera controller implements proportional steering by sending `down`/`up` over a
150 ms duty cycle. `strength` remains informational to the current injector;
the camera sender determines how long the mapped key is held. No direct
game keys or new action IDs are emitted by the camera.

The head-only sender refreshes continuous holds every 100 ms. The vision
controller also refreshes held/toggle actions after fresh valid detection
frames (at most every 100 ms). Camera `pulse` events become 120 ms presses.
The extension
expires camera holds after 800 ms without refresh and releases them on
bridge disconnect. Neutral, missing face, Stop, and hiding the camera page
send releases. On reconnect the head-only controller sends `hello`, releases
both steering actions, and recalibrates. The vision controller retains its
profile/calibration flow. The v1 message shape and other senders are unchanged.
See [camera/README.md](../camera/README.md) and [head-only setup](../camera/head-steering.md).

## Status broadcast

```json
{ "type": "status", "clients": { "extension": 1, "phone": 0 }, "v": 1, "ts": 0 }
```

Informational; clients may ignore.

## setRemap (camera → extension)

Optional message so the vision controller can push bindings into the extension without editing Options by hand. Bridge fans out to `role=extension` only (same as `input`).

```json
{
  "type": "setRemap",
  "entries": { "camera:mouthOpen": "throttle", "camera:blinkLeft": "brake" },
  "merge": true,
  "v": 1,
  "ts": 1730000000000
}
```

| Field | Meaning |
| --- | --- |
| `entries` | Map of logical id → game action. Empty string clears a binding. |
| `merge` | `true` (default): merge into existing remap. `false`: start from `DEFAULT_REMAP` then apply entries. |

Phone / voice / demo do not need this message. Unknown `type` values remain ignored by other clients.

## Default LibreCorsa key codes

| Game action | `KeyboardEvent.code` |
| --- | --- |
| steerLeft / steerRight | KeyA / KeyD |
| throttle / brake | KeyW / KeyS |
| boost | Space |
| pause | Escape |
| shiftUp / shiftDown | KeyE / KeyQ |
| aero | KeyX |
| restart | Backspace |

These match LibreCorsa `DEFAULT_KEY_BINDINGS` in `game/src/lib/input/bindings.ts`. If the player rebound keys **inside** LibreCorsa, update the extension Options “Key codes sent to the game” to match.

## Example: phone tilt left

```json
{ "type": "input", "source": "phone", "action": "tiltLeft", "state": "down", "strength": 0.6, "ts": 1730000000000, "v": 1 }
```

Extension: `phone:tiltLeft` → (default) `steerLeft` → `KeyA` keydown on the game tab.

## Phone = software controller

The phone opens a local web page over LAN Wi‑Fi and streams sensors over WebSocket. No USB/ADB. Intentional for the no-extra-hardware rule and Justin’s macOS laptop.

## Compatibility

- Do not remove fields without bumping `v` and updating all senders
- Unknown `type` values should be ignored by receivers
- Bridge drops malformed JSON silently
