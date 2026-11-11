# Deploy Game Night Access Adapter

Ways to run the stack:

| Mode | When to use | Latency |
| --- | --- | --- |
| **Desktop app (Game Night)** | Non-technical players — no terminal | Best |
| **Local (full stack)** | Contributors / co-designer sessions with Node | Best |
| **Hosted bridge (Render)** | Judges / teammates open controllers over HTTPS without Node | Higher; free tier cold-starts |

**Any keyboard-driven browser game** works: open it in Chrome → extension **Use this tab**. LibreCorsa is an optional demo for contributors, not required.

End-user install: **[launcher.md](launcher.md)**. Build the app: [launcher/README.md](../launcher/README.md).

## 0. Desktop app (recommended for players)

1. Install **Game Night** for your OS ([launcher.md](launcher.md)).
2. Launch it — tray icon starts the bridge and coaches the one-time extension install.
3. Open **your** browser game → **Use this tab** → control hub.

No Git, no `npm`, no specific game URL. After reboot, Start at login (or open the app once) is enough.

## A. Local deploy (contributors / Justin with Node)

### Prerequisites

- Git (with submodules)
- Node.js **18+** (20 LTS recommended)
- Chrome / Chromium

### 1. Clone

```bash
git clone --recurse-submodules https://github.com/Isomkevin/game-night-access-adapter.git
cd game-night-access-adapter
```

If `game/` is empty: `git submodule update --init --recursive`.

### 2. Open a browser game

Use any keyboard-driven `http(s)` game in Chrome. Optional LibreCorsa demo:

```bash
cd game
npm install
npm run dev
```

Open **http://localhost:3000** (for LibreCorsa, enter a **driving** session — keys are ignored on menus).

### 3. Load the Chrome extension

1. `chrome://extensions` → **Developer mode** → **Load unpacked**
2. Select the repo’s **`extension/`** folder (contains `manifest.json`)
3. Pin the extension; open **Setup** for Welcome → Choose → Customize → Ready
4. Focus the game tab → popup → **Use this tab**

On-screen popup controls work **without** the bridge (badge `OFF`).

### 4. Start the access bridge (phone / camera / voice)

In a **second** terminal:

```bash
cd bridge
npm install
npm start
```

| UI | URL |
| --- | --- |
| Landing | http://127.0.0.1:18765/ |
| Control hub | http://127.0.0.1:18765/hub/ |
| Phone | http://127.0.0.1:18765/phone/ (or `http://<lan-ip>:18765/phone/` on the same Wi‑Fi) |
| Camera | http://127.0.0.1:18765/camera/ |
| Voice | http://127.0.0.1:18765/voice/ |
| Presentation | http://127.0.0.1:18765/presentation/ |
| Health | http://127.0.0.1:18765/health |

Default WebSocket for the extension: `ws://127.0.0.1:18765` (Setup → Advanced if you change the port).

```bash
# Health check
curl http://127.0.0.1:18765/health
# {"ok":true,"clients":{...}}
```

Port conflict: `GNAA_PORT=18766 npm start`, then set the extension connection to `ws://127.0.0.1:18766`.

### 5. Daily layout (3 terminals)

See [DEV_ENVIRONMENT.md](DEV_ENVIRONMENT.md). Summary:

| Terminal | Command | Opens |
| --- | --- | --- |
| Game | `cd game && npm run dev` | http://localhost:3000 |
| Bridge | `cd bridge && npm start` | http://127.0.0.1:18765 |
| Git / docs | repo root | — |

Full first-day walkthrough: [ONBOARDING.md](ONBOARDING.md).

## B. Hosted bridge (Render)

**Live service:** https://game-night-bridge.onrender.com  
**Extension WebSocket:** `wss://game-night-bridge.onrender.com`  
**Dashboard:** https://dashboard.render.com/web/srv-dbm5vu59fdbs73bupg9g  
**Blueprint:** [`render.yaml`](../render.yaml) at the repo root

### Use the hosted bridge

1. Run LibreCorsa locally (`cd game && npm run dev`) **or** open https://khazp.github.io/librecorsa/
2. Load the Chrome extension from `extension/`
3. Extension **Setup → Advanced** (connection address) → save  
   `wss://game-night-bridge.onrender.com`
4. Open controllers on HTTPS, for example:
   - https://game-night-bridge.onrender.com/hub/
   - https://game-night-bridge.onrender.com/phone/
   - https://game-night-bridge.onrender.com/camera/
   - https://game-night-bridge.onrender.com/voice/

Free Render instances **sleep after idle** (~15 minutes). The first request after sleep can take 30–60+ seconds (cold start). Prefer local/LAN for Justin’s live racing tests.

### Redeploy / create from Blueprint

Auto-deploy is on for `main`. Pushing bridge-related commits to GitHub redeploys the service.

To recreate from IaC:

1. Confirm [`render.yaml`](../render.yaml) is on the default branch
2. Open  
   https://dashboard.render.com/blueprint/new?repo=https://github.com/Isomkevin/game-night-access-adapter  
3. Apply the Blueprint (free plan, Frankfurt, `rootDir: bridge`)

The bridge listens on PaaS `PORT` (falls back to `GNAA_PORT` / `18765`). Details: [bridge/README.md](../bridge/README.md).

## C. What stays local vs cloud

| Piece | Local deploy | With hosted bridge |
| --- | --- | --- |
| LibreCorsa | `npm run dev` in `game/` | Same, or GitHub Pages |
| Chrome extension | Load unpacked | Load unpacked (set `wss://…`) |
| Bridge + phone/camera/voice UIs | `npm start` in `bridge/` | Render URL |
| Remap profiles | Chrome storage on that browser | Same |

Cloud does **not** replace the extension or remove the need for a focused driving tab.

## Related

- [ONBOARDING.md](ONBOARDING.md) — first successful demo
- [DEV_ENVIRONMENT.md](DEV_ENVIRONMENT.md) — ports and shells
- [FAQ.md](FAQ.md) — short answers
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — failures
- [architecture.md](architecture.md)#deployment — design rationale
