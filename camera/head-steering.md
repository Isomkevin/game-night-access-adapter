# Head-only steering (issue #11)

**Owner: Tim** (Kevin backup)

This page uses `head-steering.html` / `head-steering.js` and `steering.js`.
The broader [vision controller](README.md) stays at `/camera/`. A link on each
page switches between controllers; use one camera controller at a time.

MediaPipe Face Landmarker runs in the browser. Turning the head left/right
(yaw) emits `source: "camera"`, `action: "tiltLeft"` / `"tiltRight"`, and
`state: "down"` / `"up"` through the local bridge. The extension remaps those
logical inputs to game actions. There are no native modules, Python, OpenCV,
microphone, phone, or voice dependencies in this camera path.

## Run and test

1. From the repository root, install and start the bridge:

   ```powershell
   npm --prefix bridge ci --ignore-scripts
   npm --prefix bridge start
   ```

   Leave that terminal running.
2. In Chrome, open `chrome://extensions`, enable Developer mode, and load
   **this repository's `extension/` folder**. Reload it after code changes.
   Disable the older standalone Game Night extension during this test so two
   extensions do not send competing controls.
3. Open LibreCorsa at <https://khazp.github.io/librecorsa/> (or run the
   `game/` submodule at <http://localhost:3000>). Finish setup and enter a
   practice/race **driving session**. Menus do not consume steering keys.
4. Open <http://127.0.0.1:18765/camera/head-steering.html> in a **separate, visible Chrome
   window beside the game**. Keep both windows visible. Switching focus to
   the game is fine; hiding, minimizing, or switching away from the camera
   page releases steering. Returning to the camera page recalibrates it.
5. Check the camera page says the bridge **and extension** are connected.
   Click **Start camera**, allow camera access, then hold your head the way
   it comfortably rests for one second. Wait for **Steering ready**.
6. Turn your face toward your left/right to steer. Yaw means looking to the
   side, rather than bringing an ear toward a shoulder. If directions feel
   reversed, select **Reverse left and right** and recalibrate.
7. Close the phone and voice pages to verify the independent camera path.
   This component supplies steering; for the initial steering test, hold
   **W** in the game to accelerate (or have a helper do so). Automatic
   throttle/cruise is not part of the camera component.

The camera preview is mirrored. **Recenter** sets the resting position again.
**Stop camera** releases steering, closes tracking, and stops the webcam.

## Permissions, privacy, and startup errors

- Use `http://127.0.0.1:18765/camera/head-steering.html` or localhost on the same computer as
  Chrome. An ordinary `http://<LAN-IP>` camera URL does not provide a secure
  camera context. Phone LAN setup is a separate component.
- Camera frames are processed locally; the bridge receives logical input
  events, not camera images. No frames are saved by this component.
- Only camera permission is requested. Chrome may already remember a prior
  permission decision for this origin.
- If permission is blocked, allow Camera in Chrome's site settings for this
  origin, then press **Start camera** again. A missing/busy camera gets a
  separate message. Close video-call apps if needed.
- MediaPipe JS/WASM (`@mediapipe/tasks-vision@0.10.14`) and the float16 model
  load from jsDelivr/Google storage at runtime. Internet access is required
  unless the browser happens to have usable cached assets; offline operation
  is not guaranteed. Start failures remain visible and can be retried.
- Tracking first tries GPU, then CPU. Neither path needs native installs.
- If the extension is offline, load/reload `extension/`, check its service
  worker errors, and reload the game tab. See [onboarding](../docs/ONBOARDING.md).

## Calibration and sensitivity

`steering.js` projects the nose displacement onto the eye line, corrected
for video aspect ratio. This reduces head roll being mistaken for yaw.
It is a normalized geometric proxy, **not degrees or a clinical measurement**.
The first second of continuous face readings defines the resting position;
missing frames interrupt calibration.

| Setting | Starting value | Meaning |
| --- | --- | --- |
| `YAW_DEADZONE` | `0.08` | Ignore displacement this close to the resting position |
| `YAW_FULL` | `0.28` | Displacement at which steering stays fully held |
| `smoothingMs` | `120` | Smooth active turns; neutral releases immediately |
| `periodMs` | `150` | Cycle length for partial key holds |
| `faceLostMs` | `300` | Stop steering when camera frames stop arriving |

Change **Dead zone**, **Full steering**, and **Reverse left and right** on the
page. Changes apply after recalibration and last until page reload. Full
steering must be greater than the dead zone; invalid settings release inputs
until corrected. The defaults are starting values awaiting a real-player test.

If resting movements steer, increase the dead zone a little. If turning
requires too much movement, reduce full steering while keeping it above the
dead zone. Change one value at a time and record the comfortable values in
[testing-log.md](../docs/testing-log.md). Permanent defaults are in `steering.js`.

Partial steering sends a held key for part of each 150 ms cycle. For example,
strength `0.5` holds for about 75 ms and releases for about 75 ms; full strength
holds continuously. This makes `YAW_FULL` affect steering even though the
extension's key injector only understands digital key states. The wire format
and user remap table are unchanged.

## Release and recovery

- Neutral, a missing face, Recenter, Stop, a tracking error, or hiding the
  camera page releases inputs immediately when the page can execute.
- A video feed that stalls releases after 300 ms. No automatic Esc/pause is
  emitted; steering release does not brake a moving car.
- While a key stays held, camera `down` events refresh every 100 ms.
  `extension/lib/camera-keys.js` releases a camera key after 800 ms without
  refresh, and on bridge disconnect. The receiver stores the original mapped
  code so changing remaps while holding a key cannot strand the old code.
- The camera reconnects after two seconds, identifies itself again, sends
  both releases, and recalibrates before steering resumes.
- Timer deadlines are best effort while Chrome and the extension are running.
  Keeping the camera window visible avoids background tracking throttling.

## Automated checks

From the repository root after installing the bridge dependency, using Node 22:

```powershell
node --experimental-vm-modules --test camera/tests/steering.test.mjs camera/tests/runtime.test.mjs camera/tests/bridge.test.mjs extension/tests/camera-keys.test.mjs
```

The tests cover geometry, continuous calibration, smoothing and pulsed keys,
neutral/face-loss/stalled-frame release, remapping, receiver expiry, camera
startup cancellation, permission/model errors, GPU fallback, reconnect,
extension routing, and the real HTTP/WebSocket bridge without phone or voice.
Browser APIs and MediaPipe are simulated in runtime tests. A real webcam,
Chrome GPU/WASM setup, and driving comfort require the manual checks below.

## Manual acceptance checklist

- [ ] Chrome/Windows: real webcam starts and steering works in a driving session
- [ ] Chrome/macOS: Justin tests, or a concrete blocker is recorded
- [ ] No phone or voice page needed for camera steering
- [ ] Neutral is stable; comfortable left/right movement; tuned values recorded
- [ ] Swapping `camera:tiltLeft` / `camera:tiltRight` mappings swaps the game response
- [ ] Face loss, Stop, hidden page, and closed camera tab release steering
- [ ] Restarting the bridge reconnects and recalibrates without a stuck key
- [ ] Denied permissions show clear recovery instructions; retry works
- [ ] Actual OS/browser, results, and limits recorded in the testing log

The automated checks do not mark the real-player or macOS criteria complete.
