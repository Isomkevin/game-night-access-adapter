# Troubleshooting

Work top-down: game → extension → bridge → input source.

Also see **[FAQ.md](FAQ.md)** for short answers, and **[ONBOARDING.md](ONBOARDING.md)** if you have not completed a demo-pad drive yet.

## Submodules empty / `game/` missing `package.json`

```bash
git submodule update --init --recursive
```

If that fails, check network access to GitHub and that you cloned with a GitHub account that can read public repos.

## `npm install` fails in `game/`

- Confirm Node **18+**: `node -v`
- Delete `game/node_modules` and `game/package-lock.json` only if instructed; prefer `npm ci` if the lockfile is intact: `cd game && npm ci`
- LibreCorsa is large; wait out the first install

## Extension demo pad does nothing

1. **Is a game tab pinned or open?** Popup → **Use this tab** on your game, or **Open game** for the LibreCorsa demo. Without a pin, inputs only go to LibreCorsa demo hosts (`localhost:3000`, GitHub Pages).
2. **Is the game tab focused?** Click the game canvas, then use the popup. Popups can steal focus — hold controls, then click back into the game if needed.
3. **LibreCorsa only:** title menu / loading ignore driving keys — start practice or a race until the car is on track.
4. **Is the extension loaded from `extension/`?** The folder must contain `manifest.json`. Reload the extension after code pulls (`chrome://extensions` → circular arrow).
5. **URL match?** Content scripts load on all `http(s)` pages. Inputs are routed only to the pinned tab (or LibreCorsa fallback URLs). Confirm the popup pin hint shows your game host.
6. **Open DevTools on the game tab** → Console. After a demo press you should not see extension errors. On the service worker: `chrome://extensions` → Service worker → Inspect.
7. **Known risk:** games that ignore untrusted events may still work via MAIN-world `page-hook.js` (`postMessage`). Confirm `window.__gnaaHookInstalled` in the page console. Pointer-only games are out of scope.

## Camera stops when I switch to the game

Use the extension popup **Camera overlay** so the preview runs inside the game tab. A separate `/camera/` tab pauses tracking when hidden (`document.hidden`). Start the bridge first; reload the game tab after updating the extension if the overlay does nothing.

## Badge stuck on `OFF` / bridge won’t connect

1. Is the bridge running? `cd bridge && npm start` (or are you using the hosted URL?)
2. Health: `curl http://127.0.0.1:18765/health` → `"ok": true`  
   Hosted: https://game-night-bridge.onrender.com/health (first hit after sleep can take ~1 minute)
3. Popup → **Reconnect**
4. Port conflict: set `GNAA_PORT=18766` when starting the bridge, then open extension **Options → Bridge connection** and save `ws://127.0.0.1:18766` (or edit storage `bridgeUrl`). Defaults remain `18765`.
5. Hosted: confirm Setup connection is exactly `wss://game-night-bridge.onrender.com` (not `ws://` and not a trailing slash)
6. Firewall blocking localhost is rare; corporate proxies can break WS — try another network

Deploy reference: [DEPLOY.md](DEPLOY.md).

## Phone page loads but doesn’t steer

1. Phone and laptop on the **same Wi‑Fi** (guest/client isolation blocks LAN)
2. Use the LAN IP printed by the bridge, not `127.0.0.1` on the phone
3. Tap **Enable motion sensors** (required on iOS)
4. Hold the phone in portrait; tilt left/right past the dead zone (~8°)
5. Extension badge `ON` and LibreCorsa focused
6. Desktop Chrome can open `/phone/` for button tests without orientation

## Camera page errors / no face

1. Allow camera permission for `http://127.0.0.1:18765`
2. Prefer Chrome; first load downloads MediaPipe WASM + model from CDNs — needs network (hands model loads only when Hands/Fingers are enabled)
3. Good lighting; one face; keep the camera tab open
4. GPU delegate failure: check console — face/hand detectors fall back to CPU
5. Stuck steering: click **Pause control** (releases held keys) or leave the tab until the visibility timeout fires
6. Gestures fire when resting: run **Calibrate neutral**, raise activation thresholds, or disable that gesture
7. Mappings from the camera page do nothing: ensure the extension is connected to the bridge (badge `ON`), then click **Apply mappings to extension**
8. Experimental `headCloser` / `headFarther` are unreliable (monocular scale) — leave off unless testing

## Voice demo hears nothing

1. Chrome + microphone permission
2. Click **Start listening** after the bridge shows connected
3. Speak clearly: “turn left”, “go”, “stop”, “boost”, “pause”
4. Web Speech is not available in all browsers (Firefox/Safari differ) — Chrome is the target
5. Bunny’s toolkit Controller path is separate; see [toolkit-contribution/](toolkit-contribution/)

## Remap changes don’t apply

1. Confirm the Options page showed **Saved**
2. Reload the extension service worker
3. Logical id must match `` `${source}:${action}` `` from the sender (e.g. phone sends `action: "tiltLeft"` with `source: "phone"` → `phone:tiltLeft`)
4. Reset to defaults on the Options page if the profile JSON is corrupt

## macOS-specific

- Prefer this stack (extension + WS + getUserMedia). Avoid Windows-only native key senders for Justin’s tests.
- Grant Chrome camera / mic in **System Settings → Privacy & Security**
- If AirPlay / multiple displays confuse focus, keep LibreCorsa on the primary display while testing

## Still stuck?

Capture: OS, Node version, Chrome version, exact URL of the game, extension badge text, bridge terminal output, and a screenshot. Post in WhatsApp and file a GitHub issue with the component template.
