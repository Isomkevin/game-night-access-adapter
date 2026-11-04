# Game Night Access Adapter

Proof-of-concept accessibility adapter for **[LibreCorsa](https://github.com/KhazP/librecorsa)** so players with different access needs — starting with co-designer **Justin Machogu** (limited finger mobility) — can remap camera, voice, and phone inputs onto the keyboard actions the game already understands.

> **New to the repo?** Start with **[docs/ONBOARDING.md](docs/ONBOARDING.md)** (clone → game → extension demo pad → optional bridge).  
> Full doc index: **[docs/README.md](docs/README.md)**.

> **Status:** Phase A scaffold + extension demo path landed. Test with Justin before calling features supported — see [`docs/testing-log.md`](docs/testing-log.md).

## Problem

Browser games often assume players can use a mouse, multi-key chords, and continuous play. That excludes many people from playing with friends and family. Justin’s core ask: **fully remappable controls**.

## Solution

```text
Camera / voice / phone / demo UI
        ↓
 Local bridge (WebSocket :18765)
        ↓
 Chrome extension (remap table)
        ↓
 LibreCorsa keyboard codes (KeyW/A/S/D, …)
```

- **No extra hardware.** Phone is a LAN web page (software controller), not USB/ADB — works on Justin’s MacBook.
- **Toolkit:** [AI for Accessibility Toolkit](https://github.com/AI-for-Accessibility-Collective/AI-for-Accessibility-Toolkit) via fork [Isomkevin/AI-for-Accessibility-Toolkit](https://github.com/Isomkevin/AI-for-Accessibility-Toolkit). Contribution pack: [`docs/toolkit-contribution/`](docs/toolkit-contribution/).

## Prerequisites

| Tool | Notes |
| --- | --- |
| Git | Submodule support |
| Node.js 18+ | 20 LTS recommended |
| Chrome / Chromium | MV3 extension + best MediaPipe / Web Speech support |

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

For the full walkthrough (driving phase, badge meanings, verify checklist), use [docs/ONBOARDING.md](docs/ONBOARDING.md).

### 1. Game (LibreCorsa)

```bash
cd game
npm install
npm run dev
```

Open `http://localhost:3000` and get into a **driving** session (keyboard is ignored on menus).

### 2. Chrome extension

1. `chrome://extensions` → Developer mode → **Load unpacked** → select `extension/`
2. Pin the extension. Use the popup demo pad (hold Left / Throttle / Right…) while the game tab is focused.
3. **Remap controls** from the popup link (large-target options page).

Badge `demo` = bridge offline (demo still works). Badge `ON` = bridge connected.

### 3. Bridge (optional — camera / phone / voice)

```bash
cd bridge
npm install
npm start
```

| UI | URL |
| --- | --- |
| Phone | `http://127.0.0.1:18765/phone/` (or `http://<lan-ip>:18765/phone/`) |
| Camera | `http://127.0.0.1:18765/camera/` |
| Voice | `http://127.0.0.1:18765/voice/` |
| Health | `http://127.0.0.1:18765/health` |

## Repo layout

| Path | Role | Owner | Docs |
| --- | --- | --- | --- |
| `game/` | LibreCorsa submodule | upstream | upstream README |
| `toolkit/` | AI-for-Accessibility fork | Bunny / Kevin | [toolkit-contribution](docs/toolkit-contribution/) |
| `extension/` | Chrome MV3 remap + injection | Kevin | [extension/README.md](extension/README.md) |
| `bridge/` | Local WebSocket hub | Omar (+ Kevin stub) | [bridge/README.md](bridge/README.md) |
| `phone-controller/` | Gyro + big buttons | Omar / Kevin | [phone-controller/README.md](phone-controller/README.md) |
| `camera/` | MediaPipe vision controller (head/face/hand/finger → remappable actions) | **Tim** (Kevin backup) | [camera/README.md](camera/README.md) |
| `voice/` | Web Speech demo → protocol | Bunny → toolkit Controller | [voice/README.md](voice/README.md) |
| `packages/shared/` | Action IDs + protocol | shared | [packages/shared/README.md](packages/shared/README.md) |
| `docs/` | Onboarding, architecture, testing | team | [docs/README.md](docs/README.md) |

## Documentation map

| Doc | When to read |
| --- | --- |
| [docs/ONBOARDING.md](docs/ONBOARDING.md) | First day — get a working demo |
| [docs/architecture.md](docs/architecture.md) | Understand data flow / injection |
| [docs/protocol.md](docs/protocol.md) | Before changing inputs or remap |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | Before your first push |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | When something fails |
| [docs/writeup.md](docs/writeup.md) | Challenge short write-up |
| [docs/testing-log.md](docs/testing-log.md) | Justin / smoke-test records |
| [docs/presentation-checklist.md](docs/presentation-checklist.md) | Saturday demo / slides |
| [docs/demo-video.md](docs/demo-video.md) | Video shot list |
| [docs/toolkit-contribution/](docs/toolkit-contribution/) | Upstream toolkit PR |

## Team workflow

- Branch per person; **document before push** (see [CONTRIBUTING.md](docs/CONTRIBUTING.md)); notify WhatsApp after each push
- Check-ins Wed–Fri **20:30**
- Bunny: merges; Kevin: backup merges + AWS if cloud hosting is needed

## Challenge deliverables

- [x] Working code in a public repository (this repo)
- [x] Pull request to the toolkit — [#55](https://github.com/AI-for-Accessibility-Collective/AI-for-Accessibility-Toolkit/pull/55)
- [x] README + short write-up ([docs/writeup.md](docs/writeup.md))
- [ ] Short demo video — shot list in [docs/demo-video.md](docs/demo-video.md)
- [x] Presentation — open [docs/presentation.html](docs/presentation.html) (←/→ keys); checklist in [docs/presentation-checklist.md](docs/presentation-checklist.md)
- [ ] Toolkit issues logged from Justin testing — template in [docs/toolkit-contribution/ISSUE_TEMPLATE.md](docs/toolkit-contribution/ISSUE_TEMPLATE.md)

## Credits

Game Night team with co-designer Justin Machogu.  
LibreCorsa code: MIT. Toolkit: Apache-2.0. Adapter code in this repository: MIT (see `LICENSE`).

## License

MIT for original Game Night adapter code. Upstream `game/` and `toolkit/` keep their own licenses.
