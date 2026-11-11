# Developer environment

How to run the stack day-to-day: ports, terminals, env vars, and what to leave running.

## Recommended layout (3 terminals)

| Terminal | Directory | Command | URL / result |
| --- | --- | --- | --- |
| 1 — Game | `game/` | `npm install` once, then `npm run dev` | http://localhost:3000 |
| 2 — Bridge | `bridge/` | `npm install` once, then `npm start` | http://127.0.0.1:18765 |
| 3 — Git / docs | repo root | commits, `git submodule …`, editors | — |

Chrome is not a terminal: Load unpacked from `extension/`, keep DevTools handy on the game tab and on the extension service worker.

**Minimum day-one:** Terminal 1 + Chrome extension only (no bridge).

**Players:** desktop app — [launcher.md](launcher.md) (no terminals).  
**Full local deploy** (extension + bridge + any game) and **hosted Render bridge**: [DEPLOY.md](DEPLOY.md).  
**Launcher development:** `cd launcher && npm install && npm start` (repo bridge).

## Ports

| Port | Service | Notes |
| --- | --- | --- |
| `3000` | LibreCorsa Next.js | From `game/` `npm run dev` |
| `18765` | Bridge HTTP + WS | Override with `GNAA_PORT` or PaaS `PORT` |

If 3000 is taken, Next will often pick another port — update what you open in the browser and pin that tab.

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `GNAA_PORT` | Bridge process | Listen port when `PORT` unset (default `18765`) |
| `PORT` | Bridge (Render / PaaS) | Public listen port; takes precedence over `GNAA_PORT` |

The extension stores its WebSocket URL in `chrome.storage.local` (`bridgeUrl`). Change it in **Setup → Advanced** (or Options connection field), not only in env.

| Mode | Typical `bridgeUrl` |
| --- | --- |
| Local bridge | `ws://127.0.0.1:18765` (default) |
| Hosted Render | `wss://game-night-bridge.onrender.com` |

Hosted URLs: https://game-night-bridge.onrender.com/ (landing), `/hub/`, `/phone/`, `/camera/`, `/voice/`, `/health`.

## One-time installs

```bash
# Repo
git clone --recurse-submodules https://github.com/Isomkevin/game-night-access-adapter.git
cd game-night-access-adapter

# Game
cd game && npm install && cd ..

# Bridge
cd bridge && npm install && cd ..
```

Optional desktop phone-tilt path (Python — not required for web onboarding):

```bash
python3 -m pip install -r requirements.txt   # repo root requirements for access_adapter
```

## Chrome extension hygiene

1. Always Load unpacked from **`…/extension`** (folder with `manifest.json`).
2. After every pull that touches `extension/`, click **Reload** on `chrome://extensions`.
3. Inspect background: extension card → **Service worker** → Inspect.
4. Inspect injection: game tab → DevTools → Console; check for errors; optional `window.__gnaaHookInstalled`.

## Shell notes

| Shell | Tips |
| --- | --- |
| **Git Bash / macOS / Linux** | Docs commands work as written (`curl`, `npm`, `ls`). |
| **PowerShell** | Prefer `curl.exe http://127.0.0.1:18765/health` or `Invoke-RestMethod`. Use `;` instead of `&&` on older PowerShell, or run commands separately. |
| **Paths** | Use forward slashes in docs; Windows accepts them in most Node/npm tooling. |

## Verify quickly

```bash
# Submodules
test -f game/package.json && test -f toolkit/README.md && echo "submodules ok"

# Bridge (while npm start is running)
curl -s http://127.0.0.1:18765/health
```

PowerShell:

```powershell
Test-Path game/package.json
Invoke-RestMethod http://127.0.0.1:18765/health
```

Full human checklist: [ONBOARDING.md](ONBOARDING.md) §6.

## What not to commit

See root `.gitignore`. Never commit:

- `node_modules/`
- `.env` / secrets
- Local duplicate clones of the game/toolkit outside the submodules
- Large unrelated binaries (prefer GitHub Releases for installers)

## IDE tips

- Open the **repo root** as the workspace so `extension/`, `bridge/`, and `docs/` stay visible.
- When editing protocol, keep `packages/shared/` and `extension/lib/` side by side.
- Markdown preview for `docs/ONBOARDING.md` on first day is enough; you do not need to run the toolkit server to play LibreCorsa.
