# Voice input

**Owner:** Bunny (toolkit Controller). This folder is a **Web Speech demo** that already speaks the shared protocol so the wire path can be tested without the full toolkit.

## Two layers (do not confuse them)

| Layer | Path | Purpose |
| --- | --- | --- |
| Demo (now) | `voice/` served by the bridge | Prove `source:"voice"` events reach the extension |
| Judged integration | AI-for-Accessibility Toolkit **Controller** | Extend the provided toolkit; open upstream PR — see [docs/toolkit-contribution/](../docs/toolkit-contribution/) |

Bunny should treat the demo as a reference sender, then replace or wrap it with `createController` / grammar / voice-mode from the toolkit submodule.

## Run the demo

1. `cd bridge && npm start`
2. Open `http://127.0.0.1:18765/voice/` in **Chrome**
3. Allow microphone; click **Start listening**
4. With LibreCorsa driving + extension badge `ON`, say:

| Phrase | Logical `action` | Default game action |
| --- | --- | --- |
| turn left / left | `turnLeft` | steerLeft |
| turn right / right | `turnRight` | steerRight |
| go / accelerate / throttle | `go` | throttle |
| stop / brake | `stop` | brake |
| boost | `boost` | boost |
| pause | `pause` | pause |

Events use `state: "pulse"` (short key down/up).

## Files

| File | Role |
| --- | --- |
| `index.html` | UI + phrase list |
| `style.css` | Simple readable layout |
| `voice.js` | Web Speech → WebSocket `input` events |

## Adding phrases

Edit the `PHRASES` array in `voice.js`, then add matching rows to `LOGICAL_INPUTS` / `DEFAULT_REMAP` in `packages/shared/protocol.js` **and** `extension/lib/protocol.js`, and document in [docs/protocol.md](../docs/protocol.md).

## Toolkit next step

Follow [docs/toolkit-contribution/README.md](../docs/toolkit-contribution/README.md). Fork branch with the example docs:

https://github.com/Isomkevin/AI-for-Accessibility-Toolkit/tree/feat/game-night-librecorsa-example
