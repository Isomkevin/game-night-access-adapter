# Vision controller (camera accessibility input)

**Owner: Tim** (Kevin backup)

In-browser **MediaPipe** vision pipeline that detects configurable head, face, hand, and finger movements and emits standardized bridge events:

- `source: "camera"`
- `action: "<logical gesture id>"` (e.g. `tiltLeft`, `mouthOpen`, `pinch`)
- `state: "down" | "up" | "pulse"`
- optional `strength` `0..1`

Processing is **local** (WASM in the camera tab). Camera frames are not uploaded or stored.

Legacy Milestone 1 steering still works: `tiltLeft` / `tiltRight` are yaw aliases (nose vs cheeks) and default-remap to steer.

For the calibrated, proportional head-only controller from issue #11, open
**http://127.0.0.1:18765/camera/head-steering.html** or follow **Use head-only
steering** on this page. It retains Start, Stop, Recenter, direction reversal,
and live dead-zone/full-steering controls. Setup, permissions, tuning, and
the manual test checklist are in [head-steering.md](head-steering.md).
Use one camera controller at a time, in a separate visible window beside the game.

## Run

1. Start LibreCorsa + load the extension (see [docs/ONBOARDING.md](../docs/ONBOARDING.md))
2. Start the bridge:

   ```bash
   cd bridge && npm start
   ```

3. Open **http://127.0.0.1:18765/camera/** in Chrome
4. Allow camera access; wait for MediaPipe WASM/model download (needs network once)
5. **Calibrate** a neutral pose, enable only gestures you can perform, map them to game actions, **Apply mappings to extension**
6. Keep this tab open; focus LibreCorsa

Camera-only must work **without** the phone (redundancy).

## Files

| Path | Role |
| --- | --- |
| `index.html` / `style.css` | Setup UI shell |
| `camera.js` | Orchestrator (capture → detect → interpret → emit) |
| `head-steering.html` / `head-steering.js` | Independent head-only steering with explicit camera lifecycle |
| `steering.js` | Head-only yaw geometry, calibration, smoothing, and proportional key timing |
| `lib/catalog.js` | Supported gesture definitions |
| `lib/capture.js` | getUserMedia, pause, lost-tracking timeout |
| `lib/detectors/face.js` | Face Landmarker (blendshapes + matrix) |
| `lib/detectors/hands.js` | Gesture Recognizer (lazy-loaded) |
| `lib/signals.js` | Continuous signal extraction |
| `lib/calibration.js` | Neutral baseline capture |
| `lib/interpreter.js` | Thresholds, hysteresis, hold/pulse/toggle |
| `lib/emitter.js` | WebSocket input + `setRemap` |
| `lib/profiles.js` | Named profiles in `localStorage` |
| `ui/setup.js` | Categories, meters, mapping, profiles |

## Setup flow

1. Open the camera page and allow permission
2. See available categories (Head / Face / Hands / Fingers)
3. Watch live signal meters and the **Recognized** list while testing movements
4. Enable only comfortable gestures; tune activation / release sliders and mode
5. Calibrate neutral pose
6. Assign game actions per gesture → **Apply mappings to extension**
7. Uncheck **Emit to game** to practice without injecting keys; use **Pause control** anytime

Profiles (enablement, thresholds, bindings, calibration) save in `localStorage` and can be exported/imported as JSON.

## Supported gestures (implemented)

| Category | Logical `action` ids |
| --- | --- |
| Head | `tiltLeft`, `tiltRight` (legacy yaw), `headYawLeft/Right`, `headPitchUp/Down`, `headRollLeft/Right`, `headCloser`, `headFarther` (experimental scale) |
| Face | `mouthOpen`, `smile`, `browRaise`, `frown`, `blinkLeft`, `blinkRight`, `blinkBoth`, `squint` |
| Hands | `handRaise`, `handLeft`, `handRight`, `palmOpen`, `fist`, `thumbUp`, `thumbDown`, `pointUp` |
| Fingers | `pinch`, `indexPoint` |

Defaults enable **only** `tiltLeft` / `tiltRight` so existing demos keep working without surprise inputs.

### Known limitations (not claimed as reliable)

- True head translation toward/away from camera is a **monocular face-scale proxy** (`headCloser` / `headFarther`) — off by default
- Fine per-finger flexion beyond pinch / index extension is approximate
- Custom signs beyond MediaPipe Gesture Recognizer’s fixed set are not supported
- `Victory` / `ILoveYou` are not exposed until validated
- First load needs network for CDN WASM + models; offline demos need vendoring later

## Reliability

- Per-gesture activate / release hysteresis, EMA smoothing, cooldown
- Held inputs released on face/hand loss, Pause, tab hide timeout, or bridge disconnect
- Category toggles skip unused models (hands load only when Hands/Fingers enabled)
- Held and toggle gestures refresh the extension's 800 ms camera lease only
  after valid detection frames; a stalled page cannot keep refreshing a hold
- Camera pulse events retain a bounded 120 ms press. Extension Stop all
  clears pending camera leases as well as releasing game keys
- The vision setup, gesture profiles, `setRemap`, and the separate head-only
  controller all use the existing bridge and extension remap table

## Automated checks

After installing the bridge dependency, run from the repository root with Node 22:

```powershell
node --experimental-vm-modules --test camera/tests/steering.test.mjs camera/tests/runtime.test.mjs camera/tests/bridge.test.mjs extension/tests/camera-keys.test.mjs
```

The 23 checks include head-only lifecycle/steering, real bridge serving and relay,
the merged extension's status/Stop all/`setRemap` paths, camera pulse handling,
and frame-driven refresh of vision toggle gestures. Browser APIs are simulated
in runtime tests. Real webcam driving and Chrome/macOS testing remain manual.

## Dependencies (CDN)

- `@mediapipe/tasks-vision@0.10.14`
- Face Landmarker float16 model
- Gesture Recognizer float16 model (when hands enabled)

## Failure modes

See [docs/TROUBLESHOOTING.md](../docs/TROUBLESHOOTING.md)#camera-page-errors--no-face

## Acceptance

- [ ] Head yaw left/right steers in LibreCorsa with extension remap defaults
- [ ] Pause / face-loss releases stuck steer
- [ ] Face and hand categories can be enabled independently; mappings apply via Options or `setRemap`
- [ ] Entry added to [docs/testing-log.md](../docs/testing-log.md)
