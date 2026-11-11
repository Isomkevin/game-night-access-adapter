# Game Night Access Adapter

Accessibility adapter for gaming controls: players with different access needs — starting with co-designer **Justin Machogu** (limited finger mobility) — remap camera, voice, phone, and on-screen inputs onto the keyboard actions browser games already understand. Pin any `http(s)` game tab with **Use this tab** and retune key codes in Setup. **[LibreCorsa](https://github.com/KhazP/librecorsa)** ships as a ready demo.

> **What is this supposed to be and do?** Full narrative: **[docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md)**.  
> **Just want to play?** Read the **[player tutorial](docs/USER_GUIDE.md)** and install the **[Game Night desktop app](docs/launcher.md)** — no terminal.  
> **New to the repo?** Start with **[docs/ONBOARDING.md](docs/ONBOARDING.md)** (clone → extension → bridge).  
> Full doc index: **[docs/README.md](docs/README.md)**.

> **Status:** Phase A scaffold + extension demo path landed. A phone-tilt desktop path is also implemented under `adapters/phone_tilt/` and `access_adapter/` (Linux + Samsung Galaxy A25). Test with Justin before calling features supported — see [`docs/testing-log.md`](docs/testing-log.md).

## Problem

Browser games often assume players can use a mouse, multi-key chords, and continuous play. That excludes many people from playing with friends and family. Justin’s core ask: **fully remappable controls**.

## Solution

```text
Camera / voice / phone / demo UI
        ↓
 Local bridge (WebSocket :18765)
        ↓
 Chrome extension (remap table → pinned game tab)
        ↓
 KeyboardEvent.code (defaults: KeyW/A/S/D, … — retune per game)
```

- **No extra hardware for the web phone path.** The LAN web page controller works on Justin’s MacBook without USB/ADB.
- **Desktop phone tilt (ADB).** Wireless ADB can also read motion sensors and map tilt to OS keystrokes aimed at the focused game window — see [Phone-tilt desktop adapter](#phone-tilt-desktop-adapter).
- **Remap without code.** Extension Options / Setup maps logical inputs (`phone:tiltLeft`, `voice:go`, …) onto game actions and key codes; profiles export/import as JSON.
- **Toolkit:** [AI for Accessibility Toolkit](https://github.com/AI-for-Accessibility-Collective/AI-for-Accessibility-Toolkit) via fork [Isomkevin/AI-for-Accessibility-Toolkit](https://github.com/Isomkevin/AI-for-Accessibility-Toolkit). Contribution pack: [`docs/toolkit-contribution/`](docs/toolkit-contribution/).

Intended inputs, remapping rules, piece-by-piece roles, and “done” criteria: [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md).

## Prerequisites

| Tool | Notes |
| --- | --- |
| Git | Submodule support |
| Node.js 18+ | 20 LTS recommended |
| Chrome / Chromium | MV3 extension + best MediaPipe / Web Speech support |
| Python 3.10+ + `adb` | Only for the optional phone-tilt desktop app / installers |

## Clone

```bash
git clone --recurse-submodules https://github.com/Isomkevin/game-night-access-adapter.git
cd game-night-access-adapter
```

If you already cloned without submodules:

```bash
git submodule update --init --recursive
```

## Quick start

**Players:** [docs/launcher.md](docs/launcher.md) (one-click desktop app).  
**Contributors:** [docs/ONBOARDING.md](docs/ONBOARDING.md) · [docs/DEPLOY.md](docs/DEPLOY.md) (local stack + hosted Render bridge).

### 1. Game (any keyboard browser game — LibreCorsa demo)

```bash
cd game
npm install
npm run dev
```

Open `http://localhost:3000` and get into a **driving** session (keyboard is ignored on menus).

### 2. Chrome extension

1. `chrome://extensions` → Developer mode → **Load unpacked** → select `extension/`
2. Pin the extension. Open **Setup** (options) for the guided Welcome → Choose → Customize → Ready flow.
3. Use the popup for on-screen controls (Hold or Latch), **Use this tab** (pin any browser game), **Stop all inputs**, and **Open game** (LibreCorsa demo).

Badge `OFF` = access bridge offline (on-screen controls still work). Badge `ON` = bridge connected.

### 3. Bridge (optional — camera / phone / voice)

```bash
cd bridge
npm install
npm start
```

| UI | Local | Hosted (Render) |
| --- | --- | --- |
| Landing | `http://127.0.0.1:18765/` | https://game-night-bridge.onrender.com/ |
| Presentation | `http://127.0.0.1:18765/presentation/` | https://game-night-bridge.onrender.com/presentation/ |
| Control hub | `http://127.0.0.1:18765/hub/` | https://game-night-bridge.onrender.com/hub/ |
| Phone | `http://127.0.0.1:18765/phone/` (or LAN IP) | https://game-night-bridge.onrender.com/phone/ |
| Camera | `http://127.0.0.1:18765/camera/` | https://game-night-bridge.onrender.com/camera/ |
| Head-only steering | `http://127.0.0.1:18765/camera/head-steering.html` | https://game-night-bridge.onrender.com/camera/head-steering.html |
| Voice | `http://127.0.0.1:18765/voice/` | https://game-night-bridge.onrender.com/voice/ |
| Health | `http://127.0.0.1:18765/health` | https://game-night-bridge.onrender.com/health |

For the hosted bridge, set the extension Setup connection address to `wss://game-night-bridge.onrender.com`. Free Render instances sleep after idle — expect a short cold start. Prefer local/LAN for Justin’s live tests.

**Redeploy:** pushes to `main` auto-deploy the bridge ([`render.yaml`](render.yaml)). Blueprint deeplink:  
https://dashboard.render.com/blueprint/new?repo=https://github.com/Isomkevin/game-night-access-adapter

## Phone-tilt desktop adapter

Configurable phone-sensor mappings, an Add device scan for USB and wireless ADB, and a local API. Windows and Linux installers ship the PySide window. Each mapping can hold keys continuously or type once when you enter that pose.

**Downloads (v0.2.7 — current):**
- Linux: [game-night-access-adapter_0.2.7_amd64.deb](releases/game-night-access-adapter_0.2.7_amd64.deb)
- Windows: [setup.exe](releases/game-night-access-adapter-0.2.7-setup.exe) · [portable zip](releases/game-night-access-adapter-0.2.7-windows.zip)

**Previous (v0.2.2, still available):**
- Linux: [game-night-access-adapter_0.2.2_all.deb](releases/game-night-access-adapter_0.2.2_all.deb)
- Windows: [MSI installer](releases/game-night-access-adapter-0.2.2.msi) · [setup.exe](releases/game-night-access-adapter-0.2.2-setup.exe) · [portable zip](releases/game-night-access-adapter-0.2.2-windows.zip)

On Windows the installer installs Python automatically if it is missing. **adb** is included (Android platform-tools). On Linux: `sudo apt install ./game-night-access-adapter_0.2.7_amd64.deb` (Python 3 required). Or run the Windows MSI / `setup.exe`.

```bash
python3 -m pip install -r requirements.txt
python3 -m access_adapter
```

Focus the game, then tilt the phone. Details: [docs/desktop-app.md](docs/desktop-app.md), [docs/phone-tilt-adapter.md](docs/phone-tilt-adapter.md), [docs/local-api.md](docs/local-api.md), and [docs/installers.md](docs/installers.md).

CLI PoC without the desktop UI:

```bash
cd adapters/phone_tilt
python3 pair_and_connect.py <PAIR_IP:PORT> <6_DIGIT_CODE>
python3 -m pip install -r requirements.txt
python3 gyro_controller.py
```

## Repo layout

| Path | Role | Owner | Docs |
| --- | --- | --- | --- |
| `game/` | LibreCorsa submodule | upstream | upstream README |
| `toolkit/` | AI-for-Accessibility fork | Bunny / Kevin | [toolkit-contribution](docs/toolkit-contribution/) |
| `extension/` | Chrome MV3 remap + injection | Kevin | [extension/README.md](extension/README.md) |
| `bridge/` | Local WebSocket hub | Omar (+ Kevin stub) | [bridge/README.md](bridge/README.md) |
| `phone-controller/` | Gyro + big buttons | Omar / Kevin | [phone-controller/README.md](phone-controller/README.md) |
| `camera/` | MediaPipe vision controller (head/face/hand/finger → remappable actions) | **Tim** (Kevin backup) | [camera/README.md](camera/README.md) |
| `voice/` | Bridge voice (toolkit → WS); no game edits | Bunny → toolkit Controller | [voice/README.md](voice/README.md) |
| `packages/shared/` | Action IDs + protocol | shared | [packages/shared/README.md](packages/shared/README.md) |
| `access_adapter/` | PySide desktop app, mappings, local API | Omar | [docs/desktop-app.md](docs/desktop-app.md) |
| `adapters/phone_tilt/` | ADB tilt → keystroke PoC | Omar | [docs/phone-tilt-adapter.md](docs/phone-tilt-adapter.md) |
| `packaging/` | Linux/Windows installers | Omar | [docs/installers.md](docs/installers.md) |
| `docs/` | Onboarding, architecture, testing | team | [docs/README.md](docs/README.md) |

## Documentation map

Full index with reading order: **[docs/README.md](docs/README.md)**.

| Doc | When to read |
| --- | --- |
| [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md) | What the project is supposed to be and do |
| [docs/GLOSSARY.md](docs/GLOSSARY.md) | Shared terms (logical action, pin, pulse, …) |
| [docs/ONBOARDING.md](docs/ONBOARDING.md) | First day — get a working demo |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Local full stack + hosted Render bridge |
| [docs/DEV_ENVIRONMENT.md](docs/DEV_ENVIRONMENT.md) | Terminals, ports, env vars, shells |
| [docs/architecture.md](docs/architecture.md) | Understand data flow / injection |
| [docs/protocol.md](docs/protocol.md) | Before changing inputs or remap |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | Before your first push / first PR walkthrough |
| [docs/FAQ.md](docs/FAQ.md) | Common questions |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | When something fails |
| [docs/writeup.md](docs/writeup.md) | Challenge short write-up |
| [docs/testing-log.md](docs/testing-log.md) | Justin / smoke-test records |
| [docs/presentation-checklist.md](docs/presentation-checklist.md) | Saturday demo / slides |
| [docs/demo-video.md](docs/demo-video.md) | Video shot list |
| [docs/toolkit-contribution/](docs/toolkit-contribution/) | Upstream toolkit PR |
| [docs/phone-tilt-adapter.md](docs/phone-tilt-adapter.md) | Desktop ADB phone-tilt path (optional) |
| [docs/desktop-app.md](docs/desktop-app.md) | PySide window and mappings |
| [docs/installers.md](docs/installers.md) | Windows/Linux installer packages |

## Team workflow

- Branch per person; **document before push** (see [CONTRIBUTING.md](docs/CONTRIBUTING.md)); notify WhatsApp after each push
- Check-ins Wed–Fri **20:30**
- Bunny: merges; Kevin: backup merges + AWS if cloud hosting is needed

## Challenge deliverables

- [x] Working code in a public repository (this repo)
- [x] Pull request to the toolkit — [#55](https://github.com/AI-for-Accessibility-Collective/AI-for-Accessibility-Toolkit/pull/55)
- [x] README + short write-up ([docs/writeup.md](docs/writeup.md))
- [ ] Short demo video — shot list in [docs/demo-video.md](docs/demo-video.md)
- [x] Presentation — bridge **[/presentation/](http://127.0.0.1:18765/presentation/)** (or [docs/presentation.html](docs/presentation.html)); ←/→ keys, download from the deck; checklist in [docs/presentation-checklist.md](docs/presentation-checklist.md)
- [ ] Toolkit issues logged from Justin testing — template in [docs/toolkit-contribution/ISSUE_TEMPLATE.md](docs/toolkit-contribution/ISSUE_TEMPLATE.md)

## Credits

Game Night team with co-designer Justin Machogu.  
LibreCorsa code: MIT. Toolkit: Apache-2.0. Adapter code in this repository: MIT (see `LICENSE`).

## License

MIT for original Game Night adapter code. Upstream `game/` and `toolkit/` keep their own licenses.
