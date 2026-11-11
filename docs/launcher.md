# Game Night desktop app (end users)

Install **Game Night** once. It starts the access bridge in the background and helps you turn on the Chrome extension. You open **your own** browser game — Game Night does not launch a specific title.

**Full non-technical tutorial (install → everyday use):** [USER_GUIDE.md](USER_GUIDE.md) · in-app [/guide/](https://game-night-bridge.onrender.com/guide/)

Developers: [DEPLOY.md](DEPLOY.md) · [launcher/README.md](../launcher/README.md).

## Install

1. Download the installer for your system (from GitHub Releases or `dist/launcher/` after a build):
   - Windows: `GameNight-Setup-*.exe`
   - macOS: `GameNight-*.dmg`
   - Linux: `GameNight-*.AppImage` or `.deb`
2. Run the installer (or open the DMG / AppImage).
3. Launch **Game Night**. A tray / menu-bar icon appears.

This product is **not** the older “Game Night Access Adapter” phone-tilt (ADB) installer.

## First launch

1. The app starts the bridge and opens the Game Night home page in Chrome.
2. A **Get started** window appears:
   - Turns on Developer mode + **Load unpacked** (folder path is copied for you)
   - Explains **Use this tab** for any game
   - Links to the control hub
3. Open any keyboard-driven browser game → extension popup → **Use this tab**.
4. Open the control hub and pick phone, camera, voice, or on-screen pad.

## Every day after that

- Leave **Start at login** on (tray menu), or open Game Night from the Start Menu / Applications.
- Open your game, pin the tab if needed, use the hub.
- No reinstall, no terminal.

## Tray menu

| Item | What it does |
| --- | --- |
| Open Game Night | Home page on the local bridge |
| Control hub | Choose phone / camera / voice |
| Extension setup | Repeat Load unpacked coaching |
| How to connect a game | Short “Use this tab” coach |
| Restart bridge | If controllers stop responding |
| Start at login | Autostart preference |
| Quit Game Night | Stops the bridge |

## Recovery

| Problem | What to try |
| --- | --- |
| No Chrome / Edge | Install [Google Chrome](https://www.google.com/chrome/), then Extension setup again |
| “Port busy” | Tray → Restart bridge. If the app moved to port `18766`, set extension Setup → Advanced to `ws://127.0.0.1:18766` |
| Badge stays OFF | Extension setup → Load unpacked again → reload the extension on `chrome://extensions` |
| Chrome says “Disable developer mode extensions” | Choose to keep the extension, or wait for Chrome Web Store publish ([extension-install.md](extension-install.md)) |
| Controllers 404 | Restart bridge; confirm home page is `http://127.0.0.1:18765/` |
| After reboot nothing runs | Open Game Night once; enable Start at login |

## Privacy (short)

- Phone / camera processing stays on your devices and talks to the local bridge.
- Voice may use Chrome’s speech service while listening is on — see extension privacy notes for Web Store.
- Remap profiles stay in Chrome storage on your computer.

## Chrome Web Store (coming)

Publishing the extension to the Web Store removes the Load unpacked step. Tracking: [docs/store/README.md](store/README.md).
