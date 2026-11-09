# Voice input

**Supported path:** bridge UI → WebSocket → Chrome extension → LibreCorsa keys.  
**LibreCorsa stays unmodified.** Do not apply `game.patch`.

## Bridge voice (recommended)

Uses the AI-for-Accessibility Toolkit `VoiceCommands` adapter from `toolkit/`, then sends shared-protocol `source:"voice"` events to the bridge.

| | |
| --- | --- |
| URL | `http://127.0.0.1:18765/voice/` |
| Hosted | https://game-night-bridge.onrender.com/voice/ |
| Browser | Chrome (Web Speech API; mic permission) |
| Settings | **Voice settings** on the page (phrases + language in `localStorage` key `gnaa.voice.bridge.v1`) |

### Run

Full local deploy: [docs/DEPLOY.md](../docs/DEPLOY.md).

1. Start LibreCorsa (`cd game && npm run dev`) — no patches
2. Load the Chrome extension from `extension/`
3. `cd bridge && npm start` (or point Setup at `wss://game-night-bridge.onrender.com`)
4. Open `http://127.0.0.1:18765/voice/` (or the hosted `/voice/` URL), allow the mic, **Start listening**
5. Pin or focus a driving session; extension badge should be `ON`

### Default phrases

| Say | Logical action | Default game key |
| --- | --- | --- |
| go / drive / accelerate / throttle | `go` (held) | W |
| stop / brake | `stop` (held) | S |
| coast / free / easy | release throttle & brake | — |
| left / turn left | `turnLeft` (0.3 s) | A |
| right / turn right | `turnRight` (0.3 s) | D |
| gear up / gear down | `gearUp` / `gearDown` | E / Q |
| boost | `boost` | Space |
| wing / aero | `aero` | X |
| restart / again | `restart` | Backspace |
| pause | `pause` | Esc |

Remap any of these in the extension Setup UI (`voice:go` → …).

### Choosing your own phrases

Open **Voice settings**. Type comma-separated phrases, use **Record** for accents, set language (US / UK / Kenya English, Kiswahili Kenya), then **Save**. Empty box turns that action off.

### Files

| File | Role |
| --- | --- |
| `index.html` | Main voice UI (toolkit → bridge) |
| `toolkit-voice.js` | VoiceCommands + held throttle/brake + settings |
| `command-settings.js` / `settings-panel.js` | Editable phrases |
| `tap.html` + `voice.js` | Optional short-tap-only demo |
| `toolkit.html` | Redirects to `/voice/` |

### Toolkit contribution

Judged toolkit work still goes through [docs/toolkit-contribution/](../docs/toolkit-contribution/). Fork example branch:

https://github.com/Isomkevin/AI-for-Accessibility-Toolkit/tree/feat/game-night-librecorsa-example

## Not used: in-game patch

`game-voice.js` and `game.patch` would inject voice into the game tab and **require editing LibreCorsa**. That path is unsupported. Keep the game submodule clean; use `/voice/` instead.
