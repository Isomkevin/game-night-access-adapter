# Phone tilt adapter

**Status:** Implemented locally and tested on Linux + Samsung SM-A256E (Android) over wireless ADB. Treat as an early proof of concept for the project’s phone-input path—not a finished accessibility profile.

This adapter lets a player tilt an Android phone to produce the keyboard actions a browser racing game already understands (default: `W` `A` `S` `D`).

```text
Android sensors  →  ADB (USB or wireless)  →  sensor_reader  →  tilt mapping  →  keystrokes  →  game
```

It matches the project pipeline:

```text
Player input → configurable action mapping → game keyboard input
```

## Why this exists

Limited finger mobility can make holding multi-key combinations difficult. Tilting a phone is a large motor action that can map onto steer / accelerate / brake without requiring fine keyboard chord work. The mapping is intentionally discrete (one direction at a time) so accidental diagonals do not press two keys together.

## Components

| File | Role |
|------|------|
| `pair_and_connect.py` | Interactive / CLI wireless ADB pair + connect |
| `connect_phone.sh` | Shell wrapper for the same flow |
| `sensor_reader.py` | Polls accelerometer + gyroscope via `adb shell dumpsys sensorservice` |
| `gyro_controller.py` | Pygame status window + `pynput` keystroke injection |
| `requirements.txt` | Python dependencies for this adapter only |

### Data flow

1. **Connect** the phone over USB debugging or Wireless debugging (`adb devices`, or `adb pair` then `adb connect`).
2. **`SensorReader`** starts a background thread that repeatedly runs `dumpsys sensorservice`, parses the newest accel/gyro samples, and exposes a thread-safe `SensorSample`.
3. **`tilt_to_dirs`** converts accel X/Y into a single digital direction using a deadzone and axis-dominance rule.
4. **`KeyInjector`** presses/releases only the keys that should currently be held, so the focused game receives normal keyboard events.
5. The pygame window shows live values and which key is active; it does not need to stay focused—**the game window should**.

### Optional high-rate path

If you install a sensor streaming app such as [SensorServer](https://github.com/UmerCodez/SensorServer), set:

```bash
export SENSOR_WS_ACCEL='ws://127.0.0.1:8081/sensor/connect?type=android.sensor.accelerometer'
export SENSOR_WS_GYRO='ws://127.0.0.1:8081/sensor/connect?type=android.sensor.gyroscope'
# after: adb forward tcp:8081 tcp:8081
```

The reader prefers WebSocket when those env vars are set, and falls back to dumpsys otherwise.

## Prerequisites

- PC with a display (tested: Linux; Windows desktop app also supported)
- [Android platform-tools](https://developer.android.com/tools/adb) (`adb` on `PATH`)
- Python 3.10+ with packages from `requirements.txt` (or the Windows/Linux desktop installer)
- Android phone (Android 11+ recommended for wireless ADB; USB works on older versions too)

```bash
cd adapters/phone_tilt
python3 -m pip install -r requirements.txt
```

## Enable USB debugging on the phone

Do this once per phone. Menu names vary slightly by manufacturer (Samsung, Pixel, Xiaomi, …).

### 1. Turn on Developer options

1. Open **Settings → About phone** (sometimes **About device** / **My phone**).
2. Find **Build number**.
3. Tap **Build number** seven times until you see a message that you are now a developer.
4. Go back. Open **Settings → System → Developer options**  
   (Samsung often uses **Settings → Developer options** near the bottom).

### 2. Turn on USB debugging

1. In **Developer options**, enable **USB debugging**.
2. Optional but useful: enable **Disable permission monitoring** / keep the phone awake while charging if your phone offers it (helps long tilt sessions).
3. Plug the phone into the PC with a **data-capable** USB cable (charge-only cables will not work).
4. On the phone, when **Allow USB debugging?** appears, check **Always allow from this computer** and tap **Allow**.
5. On the PC, confirm the phone is online:

```bash
adb devices
```

You want a line like `R58M123ABC    device`.  
If you see `unauthorized`, unlock the phone and accept the prompt again.  
If the list is empty, try another cable/port, install the OEM USB driver on Windows, and run `adb kill-server` then `adb devices` again.

USB is the simplest path for the desktop app: **Add device** should list the phone after it shows as `device`.

## Optional: Wireless debugging (no cable after pairing)

Use this when the phone and PC are on the same Wi‑Fi (or a reachable VPN such as Tailscale). Android 11+.

1. Keep **Developer options** enabled (same steps as above).
2. Open **Developer options → Wireless debugging** and turn it **On**.
3. Tap **Pair device with pairing code**. Note the **IP:port** and the **6-digit code**.
4. From `adapters/phone_tilt/`:

```bash
python3 pair_and_connect.py <PAIR_IP:PORT> <6_DIGIT_CODE>
# or
./connect_phone.sh
```

5. On the main Wireless debugging screen, note the separate **IP:port** used for everyday connect (it can differ from the pairing port).
6. Confirm:

```bash
adb devices
```

You should see something like `192.168.0.104:38667    device`.

Re-pairing is only needed once per PC until Wireless debugging is reset. The connect port can change when Wireless debugging is toggled; re-run `adb connect IP:PORT` or the pair script.

In the desktop app, use **Add device** → pair with the 6-digit code, then connect to the wireless debugging address, or select a phone that already shows as connected.

## Setup checklist

1. Install `adb` and enable **USB debugging** (or wireless debugging) as above.
2. Confirm `adb devices` shows `device`.
3. Run the pygame controller below, or open the desktop app, choose **Add device**, then **Start reading**.

## Run the controller

```bash
cd adapters/phone_tilt
python3 gyro_controller.py
```

Then:

1. Focus the browser game window.
2. Tilt the phone: left/right/forward/back → `A` / `D` / `W` / `S`.
3. Press **P** in the controller window to pause injection; **Esc** to quit.

### On-screen controls (controller window)

| Key | Action |
|-----|--------|
| `P` | Pause / resume keystroke injection |
| `Esc` | Quit and release all keys |

## Tuning

Constants live at the top of `gyro_controller.py`:

| Constant | Default | Meaning |
|----------|---------|---------|
| `ACCEL_DEADZONE` | `2.8` | Minimum \|tilt\| (m/s²) before a key fires |
| `AXIS_DOMINANCE` | `1.15` | Stronger axis must beat the other by this factor |
| `SINGLE_AXIS_ONLY` | `True` | Never hold two directions (prevents diagonal double keys) |
| `INVERT_X` / `INVERT_Y` | `False` | Flip axis polarity for grip/orientation |
| `USE_ARROWS` | `False` | Use arrow keys instead of WASD |
| `HOLD_SPACE_ON_UP` | `False` | Optional face-up → hold Space |

Raise `ACCEL_DEADZONE` if keys chatter while the phone is nearly flat. Keep `SINGLE_AXIS_ONLY=True` unless the target game needs deliberate diagonals.

## Tested environment (record)

| Item | Value |
|------|-------|
| Host OS | Linux |
| Phone | Samsung SM-A256E |
| Connection | Wireless ADB (`adb-tls-connect`) |
| Sensor path | `dumpsys sensorservice` (accelerometer live; gyro may be stale unless an app holds a listener) |
| Mapping | Tilt → WASD, single-axis |

Re-test after changing deadzone, game, browser, or OS before calling the flow “supported.”

## Known limitations

- **Latency:** dumpsys polling is slower than an on-device streaming app. Fine for coarse steering; not ideal for twitch aiming.
- **Gyro freshness:** recent gyro events only update while something on the phone registers a gyroscope listener. Tilt control currently relies mainly on the accelerometer.
- **Focus:** keystrokes go to the focused window. The adapter cannot inject into a sandboxed page that ignores OS key events.
- **Platform:** `pynput` key injection is validated on Linux X11/Wayland setups that allow it; macOS/Windows need separate verification (important for co-designer testing).
- **Permissions:** Wireless debugging must stay enabled; the PC must be authorized.
- **Rest pose:** the pygame proof of concept assumes a roughly flat phone. The desktop app under `access_adapter/` can subtract a rest-pose offset (**Calibrate rest pose**) so a stand or lap grip still maps as neutral.

## Security notes

- Prefer `adb pair` / `adb connect` without embedding personal access tokens in clone URLs.
- Do not commit pairing codes, device serials you consider private, or API tokens.
- Revoke any GitHub token that was pasted into a clone URL or chat log.

## Related project docs

- Root [README.md](../README.md) — challenge goals, architecture, co-design notes
- Future adapters (camera, voice) should follow the same “document how to run + tested environment + limitations” pattern before merge
