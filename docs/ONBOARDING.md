# Developer onboarding

Goal of this guide: on a clean machine, go from zero to **driving a browser game with the extension demo pad** in under 30 minutes (LibreCorsa is the ready demo), then optionally add bridge inputs (phone / camera / voice).

## Learning path (read in order)

| Step | Time | Doc |
| --- | --- | --- |
| 1. Why this exists | 10 min | [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) |
| 2. Words we use | 5 min | [GLOSSARY.md](GLOSSARY.md) |
| 3. Run the stack (this file) | 20–40 min | Sections 1–3 below |
| 3b. Non-technical install | 10 min | [launcher.md](launcher.md) (desktop app) |
| 4. Terminals / ports | 5 min | [DEV_ENVIRONMENT.md](DEV_ENVIRONMENT.md) |
| 5. Local vs hosted deploy | 5 min | [DEPLOY.md](DEPLOY.md) |
| 6. How data flows | 10 min | [architecture.md](architecture.md) + [protocol.md](protocol.md) |
| 7. Ship a change | 10 min | [CONTRIBUTING.md](CONTRIBUTING.md) |
| 8. When stuck | as needed | [TROUBLESHOOTING.md](TROUBLESHOOTING.md), [FAQ.md](FAQ.md) |

You do **not** need to understand the toolkit submodule or the Python desktop adapter on day one.

## Who this project is for

| Role | Read first | Then own |
| --- | --- | --- |
| Anyone joining | This file + [architecture.md](architecture.md) | — |
| Kevin | [extension/README.md](../extension/README.md) | Extension, monorepo, coordination |
| Omar | [bridge/README.md](../bridge/README.md), [phone-controller/README.md](../phone-controller/README.md), [desktop-app.md](desktop-app.md) | Bridge, phone (web + optional ADB) |
| Bunny | [voice/README.md](../voice/README.md), [toolkit-contribution/](toolkit-contribution/) | Toolkit voice + merges |
| Tim | [camera/README.md](../camera/README.md) | MediaPipe vision controller |
| Testers (Justin) | Sections 2–2d below + remap UI | Feedback in [testing-log.md](testing-log.md) |

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

**OS:** develop on Windows, macOS, or Linux. **Justin tests on macOS** — prefer WebSocket + in-browser APIs for his sessions. The optional Python/ADB desktop path is documented separately and is **not** required to onboard.

Shell tips (PowerShell vs Bash): [DEV_ENVIRONMENT.md](DEV_ENVIRONMENT.md)#shell-notes.

## Success criteria (day one)

You are onboarded when **all** of these are true:

1. LibreCorsa runs at `http://localhost:3000` and you reach a **driving** session.
2. The Chrome extension is loaded from `extension/` (not the repo root).
3. Popup demo pad steers or throttles the car (Hold or Latch).
4. You opened **Setup → Customize**, changed one mapping (or confirmed defaults), and understand Export JSON exists.
5. You know where [TROUBLESHOOTING.md](TROUBLESHOOTING.md) and [FAQ.md](FAQ.md) live.

Optional same day: bridge badge `ON` + one of phone / camera / voice.

## 0. Prefer the desktop app?

If you are **not** developing the code, install **Game Night** instead of cloning: [launcher.md](launcher.md). Come back here only for contributor workflows.

## 1. Clone the monorepo

```bash
git clone --recurse-submodules https://github.com/Isomkevin/game-night-access-adapter.git
cd game-night-access-adapter
```

If `game/` or `toolkit/` is empty:

```bash
git submodule update --init --recursive
```

Confirm (Bash / Git Bash / macOS):

```bash
ls game/package.json toolkit/README.md extension/manifest.json
```

PowerShell:

```powershell
Test-Path game/package.json, toolkit/README.md, extension/manifest.json
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
6. Click **Use this tab** while LibreCorsa is active so the pin is explicit (recommended)

If nothing happens → [TROUBLESHOOTING.md](TROUBLESHOOTING.md)#extension-demo-pad-does-nothing · [FAQ.md](FAQ.md)

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

### 3b. Hosted bridge (optional — no local Node for controllers)

If you do not want to run `bridge/` locally, use the Render service:

1. Keep LibreCorsa on `localhost:3000` (or open https://khazp.github.io/librecorsa/)
2. Extension **Setup → Advanced** → connection address  
   `wss://game-night-bridge.onrender.com`
3. Open https://game-night-bridge.onrender.com/hub/ (phone / camera / voice links)

Free tier **cold-starts** after idle — prefer §3 local bridge for Justin. Full steps: [DEPLOY.md](DEPLOY.md).

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

## 7. Day-two paths (pick your ownership)

| You own… | Do this next |
| --- | --- |
| Extension | [extension/README.md](../extension/README.md) — message types, pin, camera dock |
| Bridge / phone web | [bridge/README.md](../bridge/README.md), [phone-controller/README.md](../phone-controller/README.md) |
| Camera | [camera/README.md](../camera/README.md) — calibrate, overlay, head-steering |
| Voice / toolkit | [voice/README.md](../voice/README.md), [toolkit-contribution/](toolkit-contribution/) |
| Desktop ADB tilt | [phone-tilt-adapter.md](phone-tilt-adapter.md), [desktop-app.md](desktop-app.md) |
| Protocol change | [packages/shared/README.md](../packages/shared/README.md) then vendor into `extension/lib/` |

## 8. Next reading by task

- Local or cloud deploy → [DEPLOY.md](DEPLOY.md)
- Shipping a code change → [CONTRIBUTING.md](CONTRIBUTING.md) (includes first-PR walkthrough)
- Something broken → [TROUBLESHOOTING.md](TROUBLESHOOTING.md) · [FAQ.md](FAQ.md)
- Saturday deliverables → root [README.md](../README.md) + [presentation-checklist.md](presentation-checklist.md)
- Co-designer sessions → [testing-log.md](testing-log.md)
- Doc index → [README.md](README.md) (this folder)

## 9. Team contacts / rhythm

- Daily check-ins **Wed–Fri 20:30** (local)
- Notify the WhatsApp group after every push so others can pull and retest
- Documentation is part of judging — update the relevant README **in the same PR** as the code
- Stuck after Troubleshooting + FAQ → GitHub issue with [.github/ISSUE_TEMPLATE/component.yml](../.github/ISSUE_TEMPLATE/component.yml)
