# Voice input

## In-game voice (toolkit VoiceCommands)

Voice control runs inside the LibreCorsa tab using the AI-for-Accessibility Toolkit `VoiceCommands` adapter (`toolkit/tools/adapters/voice-commands.js`), unchanged. Game commands are added with the toolkit's `addCommand()` in [`game-voice.js`](game-voice.js).

- **Language:** Kenyan English (`en-KE`)
- **Browser:** Chrome (Web Speech API; needs microphone permission and internet)
- **Loaded:** in dev mode only, via `game/src/app/layout.tsx` (see [`game.patch`](game.patch))

### Setup

```bash
cd game
git apply ../voice/game.patch   # once, if the game edits are not applied yet
npm install                     # first time only
npm run dev
```

Open `http://localhost:3000` in Chrome and allow the microphone. Listening starts when the page loads.

### Choosing your own phrases

Every action's phrases can be changed by the player. Open **Voice settings** with the button at the bottom-left of the game, or say "voice settings".

- Type one or more phrases per action, separated by commas. Leave a box empty to turn that action off.
- **Record** listens once and adds exactly what the recogniser heard. That works better for accents than typing.
- **Language** sets the recognition language (English Kenya / US / UK, Kiswahili Kenya).
- **Save** checks for problems first: one phrase used for two actions, or "stop listening" (reserved). It also warns when a phrase replaces a toolkit built-in command.
- Settings are saved in this browser (`localStorage`, key `gnaa.voice.librecorsa-ingame.v1`) and apply straight away. **Reset to defaults** brings back the tables below.

Phrases only fire as whole words, and longer phrases are checked first ("big left" before "left").

The bridge page `/voice/toolkit.html` has the same **Voice settings** button. Its settings are stored separately (`gnaa.voice.bridge.v1`).

The tables below are the **default** phrases.

### Menus

| Say | Key | Action |
|---|---|---|
| start | Enter | Start the game from the loading screen |
| okay / yes | Enter | Select the highlighted item |
| up / down | ↑ / ↓ | Move through menu items |
| left / right | ← / → | Move left / right in menus |
| back / go back | Esc | Go back a menu |

### Driving

| Say | Key | Action |
|---|---|---|
| drive / go | W (held) | Throttle on until "stop", "easy" or "free" |
| easy | F (held) | Half throttle until "drive"/"go", "stop" or "free" |
| stop / brake | S (held) | Brake on until "drive"/"go", "easy" or "free" |
| free | — | Release throttle and brake |
| left / right | ← / → | Steer for 0.3 s |
| big left / big right | ← / → | Steer for 0.6 s |
| gear up / gear down | E / Q | Shift gear |
| boost | B | Boost on / off |
| wing | X | Active aero switch |
| auto | P | Autopilot on / off |
| restart / again | Backspace | Restart the race |
| pause | Esc | Release all keys and pause |

### Display and other

| Say | Key | Action |
|---|---|---|
| camera | C | Change camera view |
| line | R | Show / hide racing line |
| replay | T | Instant replay |
| mute | M | Sound on / off |
| next | I | Next MFD page |

### Toolkit built-in commands

These come with the toolkit adapter and are left as they are.

| Say | Action in LibreCorsa |
|---|---|
| click *name* (also press / tap) | Clicks the button with that name, e.g. "click race" |
| click | Clicks the focused control |
| next button | Moves focus to the next button |
| next link / previous link | Moves between links (few in the game) |
| type *words* | Types into a focused text field |
| stop listening | Turns voice commands off (releases held keys) |
| scroll up / down, page up / down, go to top / bottom | No effect (nothing to scroll) |
| go forward, refresh | Leaves or reloads the page — avoid during a race |
| read page / stop reading | No effect (read-aloud adapter not loaded) |

"go back" is overridden by the game commands to press Esc instead of leaving the page.

### Notes

- A phrase fires if it appears anywhere in what was heard, so "alright" triggers "right" and "slow down" triggers "down". Keep phrases short.
- "go" only fires as a whole word, so "good" or "going" do not trigger it. "go forward" is a toolkit command that leaves the page — avoid it.
- Held keys are released when the tab loses focus, on "pause", "back", "restart" and "stop listening".
- After editing `voice/game-voice.js`, reload the page; hot reload does not re-register commands.
- The language and phrases are set in **Voice settings** (see below), not in the code.

## Bridge demo

**Owner:** Bunny (toolkit Controller). This folder is a **Web Speech demo** that already speaks the shared protocol so the wire path can be tested without the full toolkit.

### Two layers (do not confuse them)

| Layer | Path | Purpose |
| --- | --- | --- |
| Demo (now) | `voice/` served by the bridge | Prove `source:"voice"` events reach the extension |
| Judged integration | AI-for-Accessibility Toolkit **Controller** | Extend the provided toolkit; open upstream PR — see [docs/toolkit-contribution/](../docs/toolkit-contribution/) |

Bunny should treat the demo as a reference sender, then replace or wrap it with `createController` / grammar / voice-mode from the toolkit submodule.

### Run the demo

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

### Files

| File | Role |
| --- | --- |
| `index.html` | UI + phrase list |
| `style.css` | Simple readable layout |
| `voice.js` | Web Speech → WebSocket `input` events |

### Adding phrases

Edit the `PHRASES` array in `voice.js`, then add matching rows to `LOGICAL_INPUTS` / `DEFAULT_REMAP` in `packages/shared/protocol.js` **and** `extension/lib/protocol.js`, and document in [docs/protocol.md](../docs/protocol.md).

### Toolkit next step

Follow [docs/toolkit-contribution/README.md](../docs/toolkit-contribution/README.md). Fork branch with the example docs:

https://github.com/Isomkevin/AI-for-Accessibility-Toolkit/tree/feat/game-night-librecorsa-example
