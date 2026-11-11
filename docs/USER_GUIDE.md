# Game Night — complete tutorial (non-technical)

This guide is for players and families. **No coding, no terminal.**  
It covers the **Game Night desktop app** + **Chrome extension**, from first install to everyday play with **any keyboard-driven browser game**.

Also available in the app as a web page: open Game Night → **Tutorial** (`/guide/`), or  
https://game-night-bridge.onrender.com/guide/ when using the hosted bridge.

---

## What you get

| Piece | What it is |
| --- | --- |
| **Chrome extension** | Pins your game tab and turns your chosen controls into keyboard keys |
| **Game Night desktop app** | Starts the access bridge in the background (tray icon) |
| **Control hub** | Menu to open phone, camera, or voice pages |

Game Night does **not** open a specific game for you. You open the game you want in Chrome, then click **Use this tab**.

---

## Before you start

- A Windows, Mac, or Linux computer
- [Google Chrome](https://www.google.com/chrome/) (recommended)
- Optional: a phone on the **same Wi‑Fi** for tilt controls; a webcam for head tracking; a mic for voice

---

## Part 1 — Install (one time)

### A. Install the Chrome extension

1. Open the [Chrome Web Store](https://chromewebstore.google.com/) and search **Game Night Access Adapter**.
2. Click **Add to Chrome** → **Add extension**.
3. Click the puzzle piece in Chrome → **pin** Game Night Access Adapter.

> **If the Store listing is not approved yet:** open the Game Night desktop app → tray → **Extension setup**, and follow the on-screen Load unpacked steps once.

### B. Install the Game Night desktop app

1. Download the installer for your system from the project’s **GitHub Releases** (or your team’s shared download link):
   - Windows: `GameNight-Setup-….exe`
   - Mac: `GameNight-….dmg`
   - Linux: `GameNight-….AppImage` or `.deb`
2. Run the installer (Mac: drag to Applications; Linux AppImage: make executable / run).
3. Launch **Game Night**. A tray / menu-bar icon appears.

This is **not** the older “phone-tilt ADB” installer named Game Night Access Adapter.

Privacy: https://game-night-bridge.onrender.com/privacy/ (also `/privacy/` on your local app).

---

## Part 2 — First-time setup (~5 minutes)

1. **Start Game Night** (Start Menu / Applications). Leave it running in the tray.
2. Chrome should open the Game Night home page. Status should show the bridge is up.
3. Open the extension → **Setup**:
   - Welcome → Choose how you want to play → Customize mappings if you like → Ready
4. Open **your browser game** in Chrome (any site that uses keyboard controls).
5. Click inside the game so that tab is focused.
6. Extension popup → **Use this tab**.
7. Open the **control hub** (tray → Control hub, or the hub link on the home page).
8. Pick a method:
   - **On-screen pad** in the popup (largest buttons; good first test)
   - **Phone** — open the phone link on your phone; allow motion
   - **Camera** — allow webcam; calibrate
   - **Voice** — allow mic; start listening

**Success check:** the car / character responds to the popup pad or your chosen method. Toolbar badge **ON** means phone/camera/voice can reach the extension.

---

## Part 3 — Day-to-day use

### Every session

1. Make sure the **Game Night** tray icon is present (enable **Start at login** in the tray menu).
2. Open Chrome → open your game.
3. If needed: click the game → **Use this tab**.
4. Use the hub or popup controls.
5. Use **Stop all inputs** if a key feels stuck.

### After you reboot the computer

1. If Start at login is on, wait for the tray icon.
2. Otherwise open **Game Night** once from the Start Menu / Applications.
3. Open your game and pin the tab again if Chrome forgot the pin (pins are per browser session).

### Changing how you play

- Extension → **Setup → Customize** to remap actions or key codes for a different game.
- Export / import settings JSON for backup.
- Tray → **How to connect a game** for a short reminder.

### Tray menu reference

| Menu item | Use it when… |
| --- | --- |
| Open Game Night | You want the home / status page |
| Control hub | Choosing phone / camera / voice |
| Extension setup | Chrome disabled the extension |
| How to connect a game | You forgot Use this tab |
| Restart bridge | Hub / phone / camera pages won’t load |
| Start at login | You want Game Night after reboot |
| Quit Game Night | You’re done for the day |

---

## Part 4 — Tips by control method

### On-screen pad

Best first test. Hold or Latch modes; no phone required.

### Phone

Same Wi‑Fi as the PC (avoid “guest” networks). Allow motion sensors on iPhone. Portrait tilt for steering; big buttons for throttle/brake/boost.

### Camera / head

Good lighting; one face. Prefer the **Camera overlay** in the popup so tracking continues while you look at the game. Calibrate neutral pose.

### Voice

Short phrases work best. Listening may use Chrome’s speech service (see Privacy). Stop listening when you finish.

---

## Part 5 — Common problems

| Symptom | Try this |
| --- | --- |
| Nothing happens in the game | Click the game page; Use this tab; try popup pad |
| Badge OFF | Tray → Restart bridge; popup → Reconnect |
| Phone page blank / won’t connect | Same Wi‑Fi; use LAN address from hub; allow motion |
| After Chrome update | Re-enable / reinstall extension; Extension setup |
| “Port busy” | Restart bridge; if port changed, Setup → Advanced → connection address |
| Developer mode nag (sideload only) | Keep the extension, or wait for Web Store install |

More detail: [launcher.md](launcher.md) · [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

---

## Part 6 — What “supported” means

Camera, voice, and phone should be treated as supported for a player only after a successful session is logged (especially on the player’s real computer). The on-screen pad is the quickest way to confirm the extension and tab pin work.

---

## Related links

| Link | Purpose |
| --- | --- |
| [/guide/](https://game-night-bridge.onrender.com/guide/) | This tutorial in the browser |
| [/privacy/](https://game-night-bridge.onrender.com/privacy/) | Privacy policy |
| [launcher.md](launcher.md) | Desktop app install & recovery |
| [store/PUBLISH.md](store/PUBLISH.md) | Chrome Web Store submit steps (maintainers) |
| [DEPLOY.md](DEPLOY.md) | Contributor / advanced deploy |
