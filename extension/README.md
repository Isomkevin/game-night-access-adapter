# Game Night Access Adapter — Chrome extension

MV3 extension that remaps demo / camera / voice / phone inputs onto LibreCorsa keyboard codes.

## Install (Chrome)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select this `extension/` folder
4. Open LibreCorsa (`http://localhost:3000` or the GitHub Pages build)
5. Use the toolbar popup demo pad, or connect the local bridge

## Remap

Toolbar → **Remap controls**, or right-click the extension → Options.

- Map any logical input to any game action
- Export / import JSON profiles
- Large click targets for limited finger mobility

## Bridge

Optional. Default `ws://127.0.0.1:18765`. Without it, **demo mode** still works (badge shows `demo`).

```bash
cd bridge
npm install
npm start
```

## Tested

| Item | Status |
| --- | --- |
| Chrome (Chromium MV3) | Target |
| Windows | Dev machine |
| macOS | Needs Justin smoke test |
| Synthetic `KeyboardEvent` | LibreCorsa has no `isTrusted` check; DOM + MAIN-world postMessage fallback |

## Permissions

- `storage` — remap profiles
- `tabs` — find LibreCorsa tabs
- Host access — localhost:3000 and khazp.github.io/librecorsa
