# Architecture

## Goal

Adapt [LibreCorsa](https://github.com/KhazP/librecorsa) so Justin (limited finger mobility) can remap camera, voice, and phone inputs onto the keyboard actions the game already understands — with no extra hardware.

## Components

| Path | Owner | Role |
| --- | --- | --- |
| `extension/` | Kevin | Chrome MV3: remap UI, WebSocket client, keystroke injection into LibreCorsa |
| `bridge/` | Omar (+ Kevin stub) | Local Node WebSocket hub; serves phone controller over LAN |
| `phone-controller/` | Omar / Kevin | DeviceOrientation → protocol events |
| `camera/` | Tim (or Kevin backup) | MediaPipe head tilt → protocol events |
| `toolkit/` submodule | Bunny / Kevin | AI-for-Accessibility fork; voice via Controller → bridge |
| `game/` submodule | upstream | LibreCorsa (unchanged for PoC) |
| `packages/shared/` | shared | Action IDs + protocol |

## Data flow

```text
Camera / Voice / Phone / Demo UI
          ↓  (JSON input events)
   Local bridge :18765
          ↓  WebSocket
   Chrome extension (remap table)
          ↓  KeyboardEvent.code on window
   LibreCorsa tab
```

Demo mode in the extension works **without** the bridge so remapping can be tested on day one.

## Keystroke injection (spike result)

LibreCorsa (`LibreCorsaSimulator.tsx`) listens for `window` `keydown` / `keyup` and maps `e.code` through `buildKeyLookup`. It does **not** check `event.isTrusted`.

**Primary path:** content script dispatches `new KeyboardEvent('keydown'|'keyup', { code, key, bubbles: true })` on `window`.

**Fallback (if a future game build ignores untrusted events):** inject a MAIN-world script that listens for `window.postMessage({ source: 'gnaa', ... })` and dispatches events from the page context. See `extension/content/page-hook.js`.

Validated against LibreCorsa source on 2026-11-04 (bindings use codes like `KeyW`, `KeyA`, `Space`, `Escape`).

## Why not the toolkit adapter runtime?

The toolkit's `extension/` runs accessibility **page adapters** (DOM/CSS). Continuous racing input needs a dedicated content script + remap store. Voice still uses the toolkit **Controller**; Bunny maps phrases to bridge `input` events.

## Cross-platform

- Extension + in-browser MediaPipe + WebSocket phone: Chrome on Windows and macOS.
- Prefer no OS-level keystroke simulation so Justin's MacBook stays first-class.
- ADB/USB phone path is out of scope for the Saturday PoC.

## Remapping

Players edit mappings in the extension Options page (`chrome.storage.local`). Any logical input (`camera:tiltLeft`, `voice:go`, …) can target any game action. Profiles can be exported/imported as JSON.
