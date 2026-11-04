# Game Night Access Adapter

Proof-of-concept accessibility adapter for **[LibreCorsa](https://github.com/KhazP/librecorsa)** so players with different access needs — starting with co-designer **Justin Machogu** (limited finger mobility) — can remap camera, voice, and phone inputs onto the keyboard actions the game already understands.

> **Status:** Phase A scaffold + extension demo path landed. Test features with Justin before calling them supported. See [`docs/testing-log.md`](docs/testing-log.md).

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

### 3. Bridge (optional, for camera / phone / voice)

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

## Repo layout

| Path | Role | Owner |
| --- | --- | --- |
| `game/` | LibreCorsa submodule | upstream |
| `toolkit/` | AI-for-Accessibility fork submodule | Bunny / Kevin |
| `extension/` | Chrome MV3 remap + injection | Kevin |
| `bridge/` | Local WebSocket hub | Omar (+ Kevin stub) |
| `phone-controller/` | Gyro + big buttons | Omar / Kevin |
| `camera/` | MediaPipe head tilt | **Tim** (Kevin backup) |
| `voice/` | Web Speech demo → protocol | Bunny wraps with toolkit Controller |
| `packages/shared/` | Action IDs + protocol | shared |
| `docs/` | Architecture, protocol, testing, write-up | team |

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — design + keystroke spike notes
- [`docs/protocol.md`](docs/protocol.md) — WebSocket contract
- [`docs/writeup.md`](docs/writeup.md) — short challenge write-up
- [`docs/testing-log.md`](docs/testing-log.md) — Justin sessions
- [`docs/presentation-checklist.md`](docs/presentation-checklist.md) — Saturday demo / slides
- [`docs/toolkit-contribution/`](docs/toolkit-contribution/) — upstream PR pack

## Team workflow

- Branch per person; document **before** push; notify WhatsApp after push
- Check-ins Wed–Fri **20:30**
- Bunny: merges; Kevin: backup merges + AWS if cloud hosting is needed

## Challenge deliverables

- [x] Working code in a public repository (this repo)
- [ ] Pull request to the toolkit — fork branch ready: [Isomkevin:feat/game-night-librecorsa-example](https://github.com/Isomkevin/AI-for-Accessibility-Toolkit/tree/feat/game-night-librecorsa-example) → open compare vs upstream ([compare link](https://github.com/AI-for-Accessibility-Collective/AI-for-Accessibility-Toolkit/compare/main...Isomkevin:AI-for-Accessibility-Toolkit:feat/game-night-librecorsa-example)) (needs Collective collaborator rights to submit)
- [x] README + short write-up
- [ ] Short demo video
- [ ] Presentation
- [ ] Toolkit issues logged from Justin testing

## Credits

Game Night team with co-designer Justin Machogu.  
LibreCorsa code: MIT. Toolkit: Apache-2.0. Adapter code in this repository: MIT (see `LICENSE`).

## License

MIT for original Game Night adapter code. Upstream `game/` and `toolkit/` keep their own licenses.
