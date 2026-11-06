# Developer onboarding

Goal of this guide: on a clean machine, go from zero to **steering LibreCorsa with the extension demo pad** in under 30 minutes, then optionally add bridge inputs (phone / camera / voice).

Before you dig into commands, skim **[PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md)** for what the adapter is supposed to be and do (problem, inputs, remap, status).

## Who this project is for

| Role | Read first | Then own |
| --- | --- | --- |
| Anyone joining | This file + [architecture.md](architecture.md) | — |
| Kevin | [extension/README.md](../extension/README.md) | Extension, monorepo, coordination |
| Omar | [bridge/README.md](../bridge/README.md), [phone-controller/README.md](../phone-controller/README.md) | Bridge, phone sensors |
| Bunny | [voice/README.md](../voice/README.md), [toolkit-contribution/](toolkit-contribution/) | Toolkit voice + merges |
| Tim | [camera/README.md](../camera/README.md) | MediaPipe vision controller |
| Testers (Justin) | Quick start below + remap UI | Feedback in [testing-log.md](testing-log.md) |

## Prerequisites

| Tool | Version / notes |
| --- | --- |
| **Git** | With submodule support |
| **Node.js** | **18+** (20 LTS recommended). Check: `node -v` |
| **npm** | Comes with Node. Check: `npm -v` |
| **Google Chrome** or Chromium | MV3 extensions; Web Speech + MediaPipe work best here |
| **Disk / network** | First `npm install` in `game/` downloads a large Next.js tree |

Optional:

- Second device on the **same Wi‑Fi** for the phone controller
- Webcam for head tracking
- Microphone for the voice demo

**OS:** develop on Windows, macOS, or Linux. **Justin tests on macOS** — prefer WebSocket + in-browser APIs; do not require ADB or Windows-only native helpers for the Saturday PoC.

## 1. Clone the monorepo

```bash
git clone --recurse-submodules https://github.com/Isomkevin/game-night-access-adapter.git
cd game-night-access-adapter
```

If `game/` or `toolkit/` is empty:

```bash
git submodule update --init --recursive
```

Confirm:

```bash
ls game/package.json toolkit/README.md extension/manifest.json
```

Canonical paths are **`game/`** (LibreCorsa) and **`toolkit/`** (AI-for-Accessibility fork) via git submodules. Do not use ad-hoc folders like `librecorsa-game/` or a second toolkit clone at the repo root — those are ignored local duplicates if present.

## 2. Minimum path (no bridge) — prove the extension works

### 2a. Start LibreCorsa

```bash
cd game
npm install
npm run dev
```

Leave this terminal running. Open **http://localhost:3000**.

**Important:** the simulator only consumes driving keys while `phase === "driving"`. From the title / setup menus, finish setup and start a practice or race session until you are in the car on track. Keys are ignored on loading and title screens by design.

Default LibreCorsa keys (when not remapped in-game):

| Key | Action |
| --- | --- |
| W / ↑ | Throttle |
| S / ↓ | Brake |
| A / ← | Steer left |
| D / → | Steer right |
| Space | Boost |
| Esc | Pause |

### 2b. Load the Chrome extension

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. **Load unpacked** → select the repo’s **`extension`** folder (the folder that contains `manifest.json`, not the repo root)
4. Pin **Game Night Access Adapter** to the toolbar

Badge meanings:

| Badge | Meaning |
| --- | --- |
| `OFF` | Access bridge offline — on-screen popup controls still work |
| `…` | Connecting to the access bridge |
| `ON` | Access bridge connected (phone / camera / voice can reach the game) |

**First-run product UI:** open the extension **Options** page (popup → **Setup**, or right-click the extension → Options). It walks through Welcome → Choose controls → Setup → Customize → Ready. Advanced connection settings stay under **Advanced**.

### 2c. Drive with the demo pad

1. Focus the **LibreCorsa** tab (click the game canvas)
2. Open the extension popup
3. Use **Hold** or **Latch** mode for Throttle / Left / Right
4. You should see the car respond
5. Use **Stop all inputs** if a control sticks

If nothing happens → [TROUBLESHOOTING.md](TROUBLESHOOTING.md)#extension-demo-pad-does-nothing

### 2d. Remap (Justin’s core need)

Popup → **Setup** (or extension → Options) → **Customize**.

- Choose a human-readable game action for each input
- Use **Test** on a row while the game is focused and driving
- Changes save to `chrome.storage.local` immediately
- Save named **presets**, or **Export / Import settings (JSON)** for backup
- Key-code overrides stay under **Advanced: match keys rebound in the game**

## 3. Full path — bridge + alternate inputs

Open a **second** terminal at the repo root:

```bash
cd bridge
npm install
npm start
```

Open the **product landing** at `http://127.0.0.1:18765/` or the **control hub** at `http://127.0.0.1:18765/hub/` — the hub links to phone, camera, and voice with readiness labels. Health check:

```bash
curl http://127.0.0.1:18765/health
# {"ok":true,"clients":{...}}
```

Reload the extension (or click **Reconnect** in the popup). Badge should become `ON`.

| Input | Open | Notes |
| --- | --- | --- |
| Landing | `http://127.0.0.1:18765/` | Public product page |
| Hub | `http://127.0.0.1:18765/hub/` | Chooser for all methods |
| Phone | `http://127.0.0.1:18765/phone/` or `http://<your-lan-ip>:18765/phone/` | Same Wi‑Fi; Enable motion; Hold or Latch buttons |
| Camera | `http://127.0.0.1:18765/camera/` | Experimental; calibrate; Pause control releases stuck inputs |
| Voice | `http://127.0.0.1:18765/voice/` | Bridge toolkit voice (holds throttle/brake); Chrome + mic; no game edits |

Keep **LibreCorsa focused** while testing holds (throttle/steer). Voice uses `pulse` (short key taps) — not continuous drive.

## 4. How data moves (mental model)

```text
[phone | camera | voice | demo popup]
        │  JSON { type:"input", source, action, state }
        ▼
   bridge :18765  (fans out to role=extension)
        ▼
   extension background  (remap source:action → game action → KeyW/…)
        ▼
   content script on LibreCorsa tab  (keydown/keyup)
        ▼
   game physics
```

Contract details: [protocol.md](protocol.md).  
Design rationale: [architecture.md](architecture.md).

## 5. Where to change what

| If you want to… | Edit |
| --- | --- |
| Add a game action / default key | `packages/shared/actions.js` **and** copy into `extension/lib/actions.js` |
| Change WebSocket message shape | `packages/shared/protocol.js` **and** `extension/lib/protocol.js` + docs |
| Change remap defaults | `DEFAULT_REMAP` in both protocol files |
| Change injection / tab matching | `extension/background.js`, `extension/content/` |
| Change bridge port / routing | `bridge/server.js`, env `GNAA_PORT` |
| Tune camera gestures / sensitivity | Camera page UI (thresholds, calibrate, profiles) or `camera/lib/` |
| Add voice phrases (demo) | `voice/voice.js` (`PHRASES`) |
| Wire toolkit Controller | See [toolkit-contribution/](toolkit-contribution/) — do not only change the Web Speech demo |

**Vendoring rule:** the extension cannot import from outside its folder. After editing `packages/shared/`, copy the same changes into `extension/lib/`.

## 6. Verify your environment (checklist)

Copy this into a PR or WhatsApp note when you claim “works on my machine”:

```text
[ ] OS: ___________
[ ] Node: ___________
[ ] Chrome: ___________
[ ] git submodule game/ present
[ ] LibreCorsa driving session at localhost:3000
[ ] Extension loaded from extension/
[ ] Demo pad steers / throttles
[ ] (optional) Bridge health 200, badge ON
[ ] (optional) Phone / camera / voice tested
```

## 7. Next reading by task

- Shipping a code change → [CONTRIBUTING.md](CONTRIBUTING.md)
- Something broken → [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- Saturday deliverables → root [README.md](../README.md) + [presentation-checklist.md](presentation-checklist.md)
- Co-designer sessions → [testing-log.md](testing-log.md)

## 8. Team contacts / rhythm

- Daily check-ins **Wed–Fri 20:30** (local)
- Notify the WhatsApp group after every push so others can pull and retest
- Documentation is part of judging — update the relevant README **in the same PR** as the code
