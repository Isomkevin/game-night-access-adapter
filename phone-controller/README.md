# Phone controller

**Owners:** Omar (primary), Kevin (stub)

Turns a phone into a **software** virtual controller: tilt to steer, large on-screen buttons for throttle / brake / boost. No USB, no ADB.

## Why this shape

- Challenge constraint: no extra hardware
- Justin’s MacBook: ADB is painful; LAN WebSocket is enough
- Elbow / arm tilt is often easier than finger chords

## Run

1. Start the bridge on the laptop:

   ```bash
   cd bridge
   npm install
   npm start
   ```

2. Open the hub at `http://127.0.0.1:18765/` or the **LAN** phone URL printed in the terminal, e.g. `http://192.168.1.12:18765/phone/`
3. On the phone (same Wi‑Fi), open that URL in mobile Chrome / Safari
4. Tap **Enable motion sensors** (iOS requires a gesture)
5. Use **Hold** or **Latch** for buttons; **Stop all inputs** releases stuck controls
6. Extension badge should be `ON`; LibreCorsa tab focused and driving

Desktop testing: open `http://127.0.0.1:18765/phone/` and use the buttons (tilt may be limited without a device orientation API).

## Protocol

Sends WebSocket JSON with `source: "phone"`:

| `action` | Typical `state` |
| --- | --- |
| `tiltLeft` / `tiltRight` | `down` / `up` from DeviceOrientation gamma |
| `throttle` / `brake` / `boost` | `down` / `up` from Hold or Latch buttons |

Remap keys in the extension: `phone:tiltLeft` → e.g. `steerLeft`. See [docs/protocol.md](../docs/protocol.md).

## Files

| File | Role |
| --- | --- |
| `index.html` | Layout, large targets |
| `style.css` | Touch-friendly styling |
| `phone.js` | WS client, orientation → input events, button holds |

## Tuning

- Dead zone for tilt: `DEADZONE` degrees in `phone.js` (default `8`)
- If steering feels inverted for a mount orientation, flip the gamma sign logic in `onOrientation`

## Security note

The bridge binds `0.0.0.0` so phones can connect on the LAN. Use on trusted networks only for the hackathon PoC.
