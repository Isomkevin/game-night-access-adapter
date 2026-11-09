# FAQ

## Product

### What problem are we solving?

Browser games assume mouse + multi-key keyboard. Justin (and players like him) need **fully remappable** controls so head, voice, phone tilt, or large on-screen buttons can drive the same game. See [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md).

### Do we modify LibreCorsa?

**No** for the accessibility path. Keep the `game/` submodule clean. Inject keys via the Chrome extension. Do not land voice patches inside the game.

### Is the phone “extra hardware”?

For the challenge web path: **no** — the phone is a **software controller** (browser page on Wi‑Fi). The optional ADB desktop adapter is a separate path; prefer the web phone page for Justin’s macOS demos.

### Does this work for every browser game?

The extension can **pin any `http(s)` tab** and inject keys. LibreCorsa is the demo and co-design target. Other games may need different key codes in Setup. Pointer-only or `isTrusted`-gated games may not work.

## Setup

### Which Node version?

**18+**, **20 LTS recommended**. Check with `node -v`.

### Submodules are empty after clone

```bash
git submodule update --init --recursive
```

Always clone with `--recurse-submodules` when possible.

### Do I need the bridge on day one?

**No.** Load the extension and use the popup demo pad against LibreCorsa first. Start the bridge when you test phone / camera / voice.

### How do I deploy / run Game Night locally?

Full stack on one machine:

1. `git clone --recurse-submodules …` then `cd game && npm install && npm run dev` → http://localhost:3000 (driving session)
2. Chrome → Load unpacked → `extension/`
3. `cd bridge && npm install && npm start` → http://127.0.0.1:18765/

Step-by-step: [DEPLOY.md](DEPLOY.md) §A · [ONBOARDING.md](ONBOARDING.md).

### Windows vs macOS vs Linux?

All three work for the web stack (game + extension + bridge). Justin tests on **macOS** — prefer WebSocket + camera/mic permissions in System Settings. PowerShell and bash both work; commands in the docs are POSIX-friendly (`cd`, `npm`, `curl`). On Windows PowerShell, `curl` is an alias for `Invoke-WebRequest`; use `curl.exe` or open Git Bash.

### Where is the hosted bridge?

https://game-night-bridge.onrender.com — product landing, hub, phone, camera, voice, presentation. Point the extension at `wss://game-night-bridge.onrender.com`. Free tier sleeps when idle (cold start). For live co-design, prefer `localhost` / LAN. Details: [DEPLOY.md](DEPLOY.md) §B.

## Extension

### Why doesn’t the car move?

Usually: not in **driving** phase, game tab not focused, or tab not pinned / not a LibreCorsa fallback URL. See [TROUBLESHOOTING.md](TROUBLESHOOTING.md)#extension-demo-pad-does-nothing.

### What does **Use this tab** do?

Pins the current Chrome tab as the injection target for this browser session. Required for non-LibreCorsa games; recommended even for LibreCorsa so routing is explicit.

### Remap didn’t stick

Confirm Options showed **Saved**, reload the extension, check the logical id is `` source:action `` (e.g. `camera:tiltLeft`). Corrupt profiles: Reset to defaults.

### Can two people drive with two phones?

The bridge fans inputs to all `extension` clients. Multiple phones can send events; there is no per-player isolation in the PoC — treat it as one shared control stream.

## Bridge / inputs

### Port already in use

```bash
# Unix-ish
GNAA_PORT=18766 npm start
```

Then set the extension Setup connection to `ws://127.0.0.1:18766`.

### Phone won’t connect on LAN

Same Wi‑Fi (avoid guest isolation), use the LAN IP the bridge prints (not `127.0.0.1` on the phone), allow the port through the laptop firewall if needed.

### Camera works alone but stops when I focus the game

Use popup **Camera overlay** so tracking runs inside the game tab, or keep the camera window visible on a second display.

### Voice phrases don’t match my accent

Open `/voice/` → **Voice settings** → edit phrases / language / Record. Remap still happens in the extension.

## Contributing

### Who merges?

Bunny day-to-day; Kevin backup. See [CONTRIBUTING.md](CONTRIBUTING.md).

### I changed `packages/shared` — anything else?

Copy into `extension/lib/` in the same PR. See [packages/shared/README.md](../packages/shared/README.md).

### How do I know I’m “done” for a feature?

Code + component README update + (if wire format) protocol.md + a [testing-log.md](testing-log.md) smoke entry with OS/browser. Do not claim co-designer support without Justin’s session notes.
