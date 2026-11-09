# Glossary

Short definitions used across this repo. If a PR introduces a new term, add it here.

| Term | Meaning |
| --- | --- |
| **Logical action** | What an input *source* emits before remapping (e.g. `tiltLeft`, `go`). Not a keyboard key. |
| **Game action** | What the game should do after remapping (e.g. `steerLeft`, `throttle`). Mapped to a `KeyboardEvent.code`. |
| **Remap key** | String `` `${source}:${logicalAction}` `` such as `phone:tiltLeft` or `voice:go`. Stored in the extension profile. |
| **Source** | Channel that produced the event: `demo`, `phone`, `camera`, `voice`. |
| **State** | `down` / `up` for held controls; `pulse` for a short tap (~120 ms). |
| **Bridge** | Node HTTP + WebSocket server (`bridge/`, default port **18765**) that fans inputs to the extension. Run locally or use the hosted Render URL. |
| **Hosted bridge** | Public Render deploy at https://game-night-bridge.onrender.com (`wss://…` for the extension). See [DEPLOY.md](DEPLOY.md). |
| **Local deploy** | Full stack on one machine: LibreCorsa (`game/`), Load unpacked extension, bridge `npm start`. |
| **Extension** | Chrome MV3 app in `extension/` — remap UI, WebSocket client, keystroke injection. |
| **Pin / Use this tab** | Session flag that tells the extension which browser tab receives injected keys. |
| **Demo pad** | On-screen controls in the extension popup. Works with the bridge **offline**. |
| **Badge OFF / ON** | Extension toolbar badge: bridge disconnected vs connected. Demo pad works either way. |
| **Driving phase** | LibreCorsa state where driving keys are consumed. Menus ignore them. |
| **Vendoring** | Copying `packages/shared/*` into `extension/lib/` because Chrome cannot import outside the extension folder. |
| **MAIN-world hook** | `page-hook.js` injected into the page context so synthetic keys still reach the game if needed. |
| **Toolkit** | [AI for Accessibility Toolkit](https://github.com/AI-for-Accessibility-Collective/AI-for-Accessibility-Toolkit) (submodule `toolkit/`). Voice’s judged path uses its Controller / VoiceCommands. |
| **Phone web controller** | `phone-controller/` served by the bridge — tilt + big buttons over LAN. No USB. |
| **Phone-tilt desktop adapter** | Optional Python / ADB path (`access_adapter/`, `adapters/phone_tilt/`) that sends OS keystrokes. Separate from the web phone page. |
| **Hub / Landing** | Product pages served by the bridge at `/` and `/hub/` linking to phone, camera, voice. |
| **Co-designer** | Justin Machogu — primary accessibility tester (macOS). Record sessions in [testing-log.md](testing-log.md). |
| **PoC** | Proof of concept scoped to one game (LibreCorsa demo) plus remappable inputs — not a universal multi-game product claim. |
