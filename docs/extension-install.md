# Installing the Chrome extension

The browser extension in `extension/` ships separately from the desktop adapter.
Its packages are in `releases/extension/`:

| File | For |
| --- | --- |
| `game-night-extension-0.1.0-windows-setup.exe` | Windows (Chrome or Edge) |
| `game-night-extension_0.1.0_all.deb` | Ubuntu / Debian (Google Chrome and Chromium) |
| `game-night-extension-0.1.0-store.zip` | Upload to the Chrome Web Store |
| `game-night-extension-0.1.0.crx` | Signed package used by the `.deb` |

The signed extension ID is `mbjnboljlapcnpkoaocjcdophdpgnkem`.

## Linux (.deb)

```bash
sudo apt install ./game-night-extension_0.1.0_all.deb
```

Restart Chrome. It shows an "extension added" prompt; click **Enable extension**.
The `.deb` registers the extension in `/usr/share/google-chrome/extensions/` and
`/usr/share/chromium/extensions/`, so it applies to every profile on the machine.
Removing the package (`sudo apt remove game-night-extension`) removes it from Chrome
on the next restart.

## Windows (setup.exe)

Chrome on Windows refuses extensions installed from outside the Web Store unless the
PC is managed by an organisation, so the setup cannot add it silently. Instead it:

1. copies the extension to `%LOCALAPPDATA%\Game Night Access Adapter\extension`,
2. copies that folder path to the clipboard,
3. opens `chrome://extensions` (or `edge://extensions` if Chrome isn't installed),
4. shows the remaining steps: turn on **Developer mode**, click **Load unpacked**,
   paste the path with Ctrl+V, and click **Select Folder**.

It appears in **Apps & features** as "Game Night extension (Chrome)" for uninstalling.
Chrome may show a "Disable developer mode extensions" notice at start-up; choose
to keep it. Publishing to the Web Store removes all of these steps.

## Chrome Web Store

The store is the only way to get a one-click install on every platform, with
automatic updates. It needs things only the project owner can provide:

1. A Chrome Web Store developer account (one-time US$5 fee) at
   <https://chrome.google.com/webstore/devconsole>.
2. Upload `game-night-extension-0.1.0-store.zip`. It has no `key` field (the store
   rejects one); the store assigns its own extension ID, which differs from the `.deb`
   ID above.
3. Store listing: description, a 128×128 icon (`extension/icons/icon128.png`), at least
   one 1280×800 screenshot, and a category (Accessibility).
4. Privacy tab:
   - A privacy policy URL. Camera and phone input stay local and go only to the bridge on
     `localhost:18765`. Voice control uses Chrome's built-in speech recognition, which sends
     audio to Google while listening is on; say so, and that the extension stores no audio
     or transcripts. Microphone permission is asked by the game page, not the extension.
   - Single-purpose statement: remaps accessibility inputs to keyboard controls in browser games.
   - Justify each permission:
     - `host_permissions` / content scripts on `http://*/*` and `https://*/*`: games run
       on any site, and key events must be delivered into the game page.
     - `tabs`, `activeTab`: find the tab the player is gaming in.
     - `storage`: remember mappings and settings.
5. Submit for review. Broad host permissions usually mean an in-depth review,
   typically a few days to a few weeks.

After approval, the Windows setup and `.deb` can be replaced by a link to the store page.
The **Game Night** desktop launcher ([launcher.md](launcher.md)) should then prefer the Store link over Load unpacked.
Checklist: [store/README.md](store/README.md).

## Building the packages

```bash
packaging/extension/build.sh            # writes dist/extension/
python3 packaging/extension/test-load.py dist/extension/game-night-extension-*-store.zip
```

`build.sh` signs the `.crx` with `~/.config/game-night-access-adapter/extension-key.pem`
(override with `GNAA_EXTENSION_KEY`). Keep that key out of the repo and back it up:
a new key changes the extension ID for `.deb` users.
`test-load.py` loads the packaged extension in headless Chrome and checks that the
background service worker starts. `.github/workflows/extension-installers.yml`
installs the released `.deb` and `setup.exe` on GitHub runners.
