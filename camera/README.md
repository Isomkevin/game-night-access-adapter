# Camera head tracking (Milestone 1)

**Owner: Tim** (Kevin as backup)

In-browser MediaPipe Face Landmarker → head yaw → `camera:tiltLeft` / `camera:tiltRight` over the bridge.

## Run

1. Start the bridge: `cd bridge && npm start`
2. Open `http://127.0.0.1:18765/camera/`
3. Allow camera permission
4. Keep the page open while LibreCorsa + the extension run

## Notes

- No native OpenCV / Python deps — Justin’s MacBook stays simple
- Camera-only must work without the phone (redundancy)
- Tuning: `YAW_DEADZONE` / `YAW_FULL` in `camera.js`
