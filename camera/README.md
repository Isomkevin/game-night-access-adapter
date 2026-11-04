# Camera head tracking (Milestone 1)

**Owner: Tim** (Kevin backup)

In-browser **MediaPipe Face Landmarker** estimates head yaw and emits:

- `source: "camera"`
- `action: "tiltLeft"` / `"tiltRight"`
- `state: "down"` / `"up"` (plus strength)

No Python, no OpenCV install, no native modules — suitable for Justin’s MacBook.

## Run

1. Start LibreCorsa + load the extension (see [docs/ONBOARDING.md](../docs/ONBOARDING.md))
2. Start the bridge:

   ```bash
   cd bridge && npm start
   ```

3. Open **http://127.0.0.1:18765/camera/** in Chrome
4. Allow camera access; wait for MediaPipe WASM/model download (needs network once)
5. Keep this tab open; focus LibreCorsa; tilt head left/right to steer

Camera-only must work **without** the phone (redundancy).

## Files

| File | Role |
| --- | --- |
| `index.html` | Video + overlay + status |
| `style.css` | Layout |
| `camera.js` | MediaPipe setup, yaw heuristic, WS sender |

## How yaw is estimated

Uses Face Mesh-style landmarks (nose tip vs cheek midpoint) as a lightweight yaw proxy. This is a PoC heuristic, not a calibrated IMU.

Tune in `camera.js`:

| Constant | Effect |
| --- | --- |
| `YAW_DEADZONE` | Ignore small motions (default `0.08`) |
| `YAW_FULL` | Normalize strength toward full steer (default `0.28`) |

If left/right feels inverted, negate the value returned by `estimateYaw`.

## Dependencies (CDN)

Loaded from jsDelivr / Google storage at runtime:

- `@mediapipe/tasks-vision`
- Face Landmarker float16 model

Offline demos need those assets cached or vendored (future work).

## Failure modes

See [docs/TROUBLESHOOTING.md](../docs/TROUBLESHOOTING.md)#camera-page-errors--no-face

## Acceptance for Tim’s milestone

- [ ] Head tilt left/right steers in LibreCorsa with extension remap defaults
- [ ] Works on at least one Windows **and** one macOS machine (or document blocker)
- [ ] Dead zone documented; Justin can sit at a comfortable distance
- [ ] Entry added to [docs/testing-log.md](../docs/testing-log.md)
