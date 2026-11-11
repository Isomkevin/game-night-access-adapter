# Packaging the Game Night launcher

Produces **Game Night** installers (Electron). These are separate from the
**Game Night Access Adapter** ADB phone-tilt packages under `packaging/windows`
and `packaging/linux`.

## Build

```bash
bash packaging/launcher/build.sh          # current OS
bash packaging/launcher/build.sh win
bash packaging/launcher/build.sh mac
bash packaging/launcher/build.sh linux
```

Output: `dist/launcher/` (gitignored). Optionally copy release builds into
`releases/launcher/` for downloads from the branch.

## What gets bundled

- Electron tray app (`launcher/`)
- `bridge/` + `bridge/node_modules` (must run `npm ci` in bridge first)
- `phone-controller/`, `camera/`, `voice/`, `packages/ui`, `packages/shared`
- `extension/` (copied again at runtime into userData for Load unpacked)
- `docs/presentation.html` for `/presentation/` on the local bridge

## Naming

| Product | Artifact example |
| --- | --- |
| Game Night (this launcher) | `GameNight-Setup-0.1.0.exe`, `GameNight-0.1.0.dmg` |
| ADB desktop adapter | `game-night-access-adapter-0.2.7.msi` |
| Extension-only | `game-night-extension-*-windows-setup.exe` |
