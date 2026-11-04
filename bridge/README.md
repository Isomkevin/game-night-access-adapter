# Local bridge (Omar)

Node WebSocket hub that fans camera / voice / phone inputs to the Chrome extension.

## Why WebSocket (not ADB)

- Challenge rule: no extra hardware
- Justin uses macOS — ADB friction is high
- Phone is a **software controller**: open a LAN page, stream sensors

## Run

```bash
cd bridge
npm install
npm start
```

Default port **18765** (`GNAA_PORT` to override).

- Extension connects to `ws://127.0.0.1:18765`
- Phone: `http://<lan-ip>:18765/phone/`
- Camera: `http://127.0.0.1:18765/camera/`

## Protocol

See [`docs/protocol.md`](../docs/protocol.md).

## Ownership

- **Stub + HTTP/WS fan-out:** in this folder (Kevin)
- **Hardening, reconnect UX, optional OS key injection:** Omar
- Prefer extension keystroke injection so macOS stays first-class
