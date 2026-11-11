# Store listing draft (copy into Chrome Web Store console)

## Name

Game Night Access Adapter

## Short description (≤132 characters)

Remap phone, camera, voice, and on-screen controls onto keyboard actions for any browser game.

## Detailed description

Game Night Access Adapter helps players with different access needs control keyboard-driven browser games — without rewriting the game.

Use phone tilt, head or camera gestures, voice commands, or large on-screen buttons. A simple Setup screen remaps any input to the keys your game already understands. Pin any browser game tab with “Use this tab.”

How to use:
1. Install this extension from the Chrome Web Store.
2. Install the Game Night desktop app (starts the local access bridge — no terminal).
3. Open your game in Chrome and click Use this tab in the extension popup.
4. Open the control hub to choose phone, camera, voice, or use the on-screen pad.

Accessibility-first: high-contrast controls, remappable bindings, Stop all inputs when something sticks. Co-designed with players who need customizable controls.

Tutorial: https://game-night-bridge.onrender.com/guide/
Privacy: https://game-night-bridge.onrender.com/privacy/

## Category

Accessibility

## Official URL (optional)

https://game-night-bridge.onrender.com/

## Support / homepage

https://github.com/Isomkevin/game-night-access-adapter

## Privacy policy URL (required)

https://game-night-bridge.onrender.com/privacy/

## Single purpose

Remaps accessibility inputs to keyboard controls in browser games.

## Permission justifications

| Permission | Justification |
| --- | --- |
| `storage` | Save remap profiles and onboarding progress on the device |
| `tabs` / `activeTab` | Find and pin the game tab that should receive keyboard events |
| Host access `http://*/*` and `https://*/*` | Browser games run on many sites; key events must be injected only into the tab the player pinned |

## Assets

| Asset | Path |
| --- | --- |
| Icon 128×128 | `extension/icons/icon128.png` |
| Screenshot — Setup | `docs/store/screenshots/setup-1280x800.jpg` |
| Screenshot — Hub | `docs/store/screenshots/hub-1280x800.jpg` |
| Store zip | `dist/extension/game-night-extension-<version>-store.zip` |

## Checklist

- [ ] Developer account paid
- [ ] Zip uploaded
- [ ] Listing text pasted
- [ ] Icon + screenshots uploaded
- [ ] Privacy URL set
- [ ] Submitted for review
- [ ] After approval: paste Store URL into USER_GUIDE / guide.html / launcher
