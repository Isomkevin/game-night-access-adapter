# Game Night Access Adapter

A proof-of-concept accessibility adapter for an open-source browser racing game. The goal is to let players map controls that work for them—such as head movement, voice commands, or phone input—to the keyboard actions a game expects.

> **Project status:** In development. One phone-tilt input path is implemented under `adapters/phone_tilt/` and has been exercised on Linux + a Samsung Galaxy A25. Camera, voice, browser-extension bridge, and cross-platform co-designer testing are still pending.

## The problem

Browser games often assume players can see the screen, use a mouse or standard keyboard, react quickly, and play continuously without pauses. Those assumptions can prevent people with different access needs from playing alongside friends and family.

Our co-designer described a specific motor-access barrier: limited finger mobility makes multi-key combinations and some gamepad buttons difficult to use. He already adapts how he uses his laptop through remapped controls, extensions, and voice commands. This project explores whether the same principle—**make the input fit the player**—can make a browser game easier to play.

Our challenge is:

> How might we adapt one open-source browser game so people with different access needs can play together using the controls, pace, and feedback that work for them?

## Proposed solution

Game Night Access Adapter is designed as a configurable layer between the player and a browser game:

```text
Player input → configurable action mapping → game keyboard input
```

Instead of requiring the player to use the game's default controls, the adapter would translate an accessible input into an action the game already understands. For example, a player might map a head movement to steering left.

The immediate goal is **one playable racing-game proof of concept**, tested with our co-designer. A reusable adapter for other games is a longer-term direction, not a claim about the current build.

### Input methods under exploration

| Method | Status | Notes |
|--------|--------|-------|
| **Phone tilt** (accelerometer → WASD) | **Implemented (PoC)** | See [`adapters/phone_tilt/`](adapters/phone_tilt/) and [`docs/phone-tilt-adapter.md`](docs/phone-tilt-adapter.md) |
| **Camera** (head movement) | Planned | Steering via camera; needs fallback |
| **Voice** | Planned | Through the accessibility toolkit |
| **Combined controls** | Planned | Mix methods per player preference |

All mappings should be configurable rather than fixed to a particular gesture, command, or disability profile. An input method should also have a fallback where possible—for example, the camera should not be the only way to steer.

## Architecture

```text
Camera / voice / phone
          ↓
   Input adapters   ←  adapters/phone_tilt is the first concrete adapter
          ↓
 Configurable action mapping
          ↓
 Browser extension and/or local bridge
          ↓
 Open-source browser racing game
```

**Current phone path (local bridge):** Wireless ADB reads motion sensors on the phone; a small Python service maps tilt to OS keystrokes aimed at the focused game window. A browser extension is still planned for tighter in-page integration; the keystroke bridge is enough to prove the accessibility idea end-to-end.

```text
Phone sensors ──ADB──► sensor_reader ──► tilt mapping ──► keystrokes ──► racing game
```

## Scope

### Proof of concept

1. Select and document the open-source browser racing game used for testing.
2. Identify its essential actions and default controls.
3. Implement at least one accessible alternative input.
4. Let the player map that input to a game action.
5. Test the complete flow with the co-designer.
6. Record usability findings, limitations, and toolkit issues.

### Future direction

- Additional input methods and combinations
- Profiles that players can save and reuse
- Support for more browser games
- More complete coverage of the challenge's pace and feedback needs

**Out of scope for the initial proof of concept:** claiming that the adapter supports every game, access need, or operating system.

## Accessibility and co-design

This project is being developed with a co-designer who has limited finger mobility and plays games with others. His experience informs the choice of controls and the usability tests; it should not be treated as a substitute for testing with people who have other access needs.

We will evaluate questions such as:

- Can the player set up controls without difficult multi-key actions?
- Can they steer and perform other essential actions reliably?
- Can they change a mapping when an input is uncomfortable?
- What happens if camera tracking or phone input becomes unreliable?
- Does the adapter work on the device and operating system used for testing?

Findings should be recorded as observations, not assumed from a successful technical demo.

## Constraints

- The challenge calls for adapting an **existing open-source browser game**, not building a new game.
- The solution is expected to run on laptops and phones **without extra hardware**.
- The provided accessibility toolkit must be used and extended.
- Phone-based input and any proposed connection method need to be checked against the hardware constraint.
- Cross-platform behavior, particularly macOS support for co-designer testing, needs verification.

## Development approach

The team plans to work in parallel on separate components, while keeping a playable end-to-end proof of concept as the priority.

Before requesting a merge:

1. Document what the component does and how to run it.
2. Test it locally.
3. State which operating system and browser were tested.
4. Describe required permissions, dependencies, and known limitations.
5. Ask another team member to pull and test it on their machine where possible.

Proposed work areas include the repository and integration, browser extension, local bridge and phone input, camera input, and toolkit voice integration. Component ownership and boundaries should be confirmed in project issues.

## Repository layout

```text
adapters/
  phone_tilt/          # Android tilt → keyboard adapter (working PoC)
access_adapter/        # PySide desktop app, mappings, local API
docs/
  phone-tilt-adapter.md
  desktop-app.md
  local-api.md
README.md
LICENSE
```

## Desktop application

Configurable phone-sensor mappings, an Add device scan for USB and wireless ADB, and a local API. Windows and Linux.

**Downloads (this branch, v0.2.0):**
- Linux: [game-night-access-adapter_0.2.0_all.deb](releases/game-night-access-adapter_0.2.0_all.deb)
- Windows: [setup.exe](releases/game-night-access-adapter-0.2.0-setup.exe) · [portable zip](releases/game-night-access-adapter-0.2.0-windows.zip)

Install Python 3 and `adb` first. On Linux: `sudo apt install ./game-night-access-adapter_0.2.0_all.deb`. On Windows: run `setup.exe` (or extract the zip and run `install.bat`).

```bash
python3 -m pip install -r requirements.txt
python3 -m access_adapter
```

The window opens on live phone tilt and the mapping table. Focus the game, then tilt the phone. Details: [docs/desktop-app.md](docs/desktop-app.md), [docs/local-api.md](docs/local-api.md), and [docs/installers.md](docs/installers.md).

```bash
python3 -m access_adapter --api-only
curl -s http://127.0.0.1:8765/api/v1/health
```

## Getting started (phone tilt PoC)

### Prerequisites

- Linux host with Python 3.10+ and `adb` (Android platform-tools)
- Android 11+ phone on the same network, **Wireless debugging** enabled
- Packages from `adapters/phone_tilt/requirements.txt` (`pygame`, `pynput`, optional `websocket-client`)

### Pair the phone

```bash
cd adapters/phone_tilt
python3 pair_and_connect.py <PAIR_IP:PORT> <6_DIGIT_CODE>
adb devices   # should show the phone as "device"
```

### Run the adapter

```bash
cd adapters/phone_tilt
python3 -m pip install -r requirements.txt
python3 gyro_controller.py
```

Focus the game window, then tilt the phone. **P** pauses injection; **Esc** quits.

### Configure controls

Edit the constants at the top of `adapters/phone_tilt/gyro_controller.py` (`ACCEL_DEADZONE`, `AXIS_DOMINANCE`, `USE_ARROWS`, invert flags). Full tuning notes: [`docs/phone-tilt-adapter.md`](docs/phone-tilt-adapter.md).

## Testing and known limitations

Maintain a record of:

- Game and adapter versions tested
- Browser and operating system
- Input method and control mapping
- What the player attempted
- Whether the action worked reliably
- Co-designer feedback
- Bugs, accessibility barriers, and toolkit issues

See the project issues for current results and limitations. A feature should only be marked supported after it has been tested.

## Challenge deliverables

- Working code in a public repository
- A pull request to the accessibility toolkit
- This README and a short project write-up
- A short demo video and presentation
- Toolkit issues identified through co-designer testing

## Contributing

Keep changes focused and documented. Open an issue or discuss a proposed input method before adding it, and describe the access need it addresses. Test accessibility behavior with users where possible rather than assuming a control is accessible because it works for a developer.

## Credits

Built by the Game Night team with input from co-designer Justin Machogu. The project uses an existing open-source browser game and a provided accessibility toolkit; their names, links, and licenses will be added here once the exact repositories are confirmed.

## License

_To be confirmed. Check the selected game's and toolkit's licenses before choosing a license for this repository._
