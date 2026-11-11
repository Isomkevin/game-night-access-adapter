# Game Night launcher

Desktop tray app that starts the **access bridge** and guides a one-time Chrome extension install. It does **not** open any specific game — open your own browser game and use **Use this tab** in the extension.

## Who this is for

Non-technical players who should not need Git, Node, or terminals.

Contributors can keep using `cd bridge && npm start` — see [docs/DEPLOY.md](../docs/DEPLOY.md).

## Develop

```bash
# From repo root — bridge deps required
cd bridge && npm install && cd ..

cd launcher
npm install
npm start
```

`npm start` uses the repo’s `bridge/`, controllers, and `extension/` folders.

Smoke the bundled bridge without Electron:

```bash
npm run smoke:bridge
```

## Build installers

```bash
# Ensure bridge/node_modules exists (bundled into the app)
cd bridge && npm ci && cd ../launcher
npm install
npm run dist        # current platform
npm run dist:win    # Windows NSIS
npm run dist:mac    # macOS DMG
npm run dist:linux  # AppImage + deb
```

Artifacts land in `dist/launcher/` (gitignored). Helper: [packaging/launcher/build.sh](../packaging/launcher/build.sh).

## Tray menu

| Item | Action |
| --- | --- |
| Open Game Night | Landing page on the local bridge |
| Control hub | Phone / camera / voice chooser |
| Extension setup | Copy Load unpacked path + open Extensions |
| How to connect a game | Coach for **Use this tab** |
| Restart bridge | Relaunch `bridge/server.js` |
| Start at login | Autostart preference |
| Quit | Stop bridge and exit |

## Related

- [docs/launcher.md](../docs/launcher.md) — end-user install & recovery
- [docs/extension-install.md](../docs/extension-install.md) — extension packages / Web Store
