# What this project is supposed to be and do

**Game Night Access Adapter** is an accessibility adapter for gaming controls. It lets players with different motor access needs — starting with co-designer **Justin Machogu** (limited finger mobility) — play keyboard-driven browser games using remappable camera, voice, phone, and on-screen controls instead of mouse and multi-key keyboard chords. [LibreCorsa](https://github.com/KhazP/librecorsa) is the included demo game, not the product limit.

The game itself is **not** rewritten. Alternate inputs are translated into the keyboard codes the focused game already understands.

New developers: [ONBOARDING.md](ONBOARDING.md) (run the stack) → [DEPLOY.md](DEPLOY.md) (local + Render) → [GLOSSARY.md](GLOSSARY.md) (terms) → [DEV_ENVIRONMENT.md](DEV_ENVIRONMENT.md) (ports/terminals). Technical data flow: [architecture.md](architecture.md). Wire contract: [protocol.md](protocol.md). Short judging write-up: [writeup.md](writeup.md). Full index: [README.md](README.md).

## Problem

Browser games often assume the player can hold several keys, use a mouse, and react continuously. That locks people with motor access needs out of playing with friends and family. Justin likes racing games, but stock controls are not something he can rebind to the body movements he can actually use.

Justin’s core ask: **fully remappable controls** — change mappings without editing code.

Challenge constraints:

- **No extra hardware** (no USB gamepad requirement; phone is a software controller, not ADB/USB)
- Must work on Justin’s **macOS** MacBook as well as Windows/Chrome
- Prefer in-browser APIs (WebSocket, getUserMedia, Web Speech)

## What it is supposed to do

Any accessible input becomes a **logical** action, gets remapped by the player, and is injected as a key the game already listens for:

```text
Camera / voice / phone / demo (on-screen) UI
        ↓  JSON events
 Local bridge (WebSocket, port 18765)
        ↓
 Chrome extension (player’s remap table)
        ↓
 Game keyboard codes (defaults: KeyW, KeyA, KeyS, KeyD, Space, …)
```

### Intended input methods

| Input | How it is meant to work |
| --- | --- |
| **Camera / vision** | Webcam + MediaPipe. Head tilt, face/hand/finger gestures map to remappable `camera:*` actions (steer, throttle, etc.). Head-only steering page available under `/camera/head-steering.html`. |
| **Voice** | Spoken phrases such as “turn left”, “go”, “stop”, “boost”, “pause”. Demo in `voice/`; judged path uses the AI for Accessibility Toolkit **Controller**. |
| **Phone** | A web page on the same Wi‑Fi. Tilt the phone to steer; large on-screen buttons for throttle, brake, and boost. Software controller only — not USB/ADB. |
| **On-screen / demo pad** | Buttons in the extension popup (hold or latch). Works even if the bridge is offline so injection can be tested without phone/camera/voice. |

### Remapping (Justin’s core need)

1. An input source sends logical `action` + `source` (e.g. phone + `tiltLeft`).
2. The extension builds a key such as `phone:tiltLeft`.
3. It looks up the player’s remap → game action (e.g. `steerLeft`).
4. It looks up the key code (`KeyA` or a player override).
5. It injects `keydown` / `keyup` into the pinned game tab.

Profiles live in `chrome.storage.local` and can be exported/imported as JSON from the extension Options / Setup UI. Default game actions and keys use common WASD bindings (matching the LibreCorsa demo):

| Game action | Default key |
| --- | --- |
| Steer left / right | A / D |
| Throttle / brake | W / S |
| Boost | Space |
| Pause | Esc |
| Gear up / down | E / Q |
| Aero | X |
| Restart | Backspace |

Holds (`down` then `up`) are for steering and pedals. Voice (and some camera pulses) use a short `pulse` (keydown, then keyup after ~120 ms). Sources that send `down` must eventually send `up`, or the game treats the key as stuck.

### When keys matter

Injection applies to the pinned, focused game tab. Games that listen for `keydown` / `keyup` on `window` without requiring `event.isTrusted` work best (the LibreCorsa demo does). The extension can dispatch synthetic `KeyboardEvent`s (with a page-world hook as fallback).

## How the pieces fit

This is a monorepo. `game/` (LibreCorsa) and `toolkit/` (fork of the [AI for Accessibility Toolkit](https://github.com/AI-for-Accessibility-Collective/AI-for-Accessibility-Toolkit)) are git submodules and stay upstream code. The adapter is everything around them.

| Piece | Role |
| --- | --- |
| `camera/`, `voice/`, `phone-controller/` | Turn sensors/buttons into JSON `{ type:"input", source, action, state, … }` |
| `bridge/` | Local Node HTTP + WebSocket hub on port **18765**; serves controller pages; fans `input` events to the extension |
| `extension/` | Chrome MV3 remap UI, WebSocket client, keystroke injection into the game tab |
| `packages/shared/` | Action IDs + protocol (vendored into `extension/lib/` because MV3 cannot import outside the extension folder) |

```text
[phone | camera | voice | demo popup]
        │  JSON { type:"input", source, action, state }
        ▼
   bridge :18765  (fans out to role=extension)
        ▼
   extension background  (remap source:action → game action → KeyW/…)
        ▼
   content script on pinned game tab  (keydown/keyup)
        ▼
   game physics
```

Demo / on-screen controls talk to the extension **directly** (no bridge required). Badge `OFF` = bridge offline; badge `ON` = bridge connected.

### Why not only the toolkit adapter runtime?

The toolkit’s `extension/` runs accessibility **page adapters** (DOM/CSS). Continuous racing input needs a dedicated content script + remap store. Voice still targets the toolkit **Controller**; contribution materials live in [toolkit-contribution/](toolkit-contribution/). Upstream example PR: [AI-for-Accessibility-Toolkit#55](https://github.com/AI-for-Accessibility-Collective/AI-for-Accessibility-Toolkit/pull/55).

### Deployment

Default: everything local (`game` via `npm run dev`, bridge, Load unpacked extension). Step-by-step: [DEPLOY.md](DEPLOY.md).

**Local:** `cd game && npm run dev` → Load unpacked `extension/` → `cd bridge && npm start` (http://127.0.0.1:18765/).

**Cloud (Render):** https://game-night-bridge.onrender.com hosts landing / hub / phone / camera / voice. Point the extension at `wss://game-night-bridge.onrender.com`. Latency-sensitive co-designer racing still prefers LAN/localhost.

## Who it is for

| Role | Focus |
| --- | --- |
| Justin (co-designer / tester) | Remap UI + camera / voice / phone; feedback in [testing-log.md](testing-log.md) |
| Kevin | Extension, monorepo, coordination |
| Omar | Bridge, phone controller |
| Tim | Camera / MediaPipe vision |
| Bunny | Toolkit voice + merges / toolkit PR |

## Status and “done”

**Status:** Phase A scaffold + extension demo path landed. Treat camera / voice / phone as supported only after sessions are recorded in [testing-log.md](testing-log.md) (especially Justin on macOS).

What “done” means for the challenge Saturday:

- Public monorepo with game + toolkit submodules and a working extension demo path
- Remappable controls Justin can change without editing code
- At least one accessible input beyond the on-screen pad (voice and/or camera and/or phone)
- Testing log + toolkit issues + demo video + [writeup.md](writeup.md)

Deliverable checklist: root [README.md](../README.md). Presentation: [presentation.html](presentation.html).

## Credits / license

Game Night team with co-designer Justin Machogu. Demo game LibreCorsa (MIT). AI for Accessibility Toolkit (Apache-2.0). Original adapter code in this repository: MIT (see `LICENSE`).
