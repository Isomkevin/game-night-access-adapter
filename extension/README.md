# Chrome extension (Kevin)

Manifest V3 extension that:

1. Connects to the local bridge (optional)
2. Remaps logical inputs → game actions → `KeyboardEvent.code`
3. Injects `keydown` / `keyup` into a **pinned** game tab (any `http(s)` page)
4. Provides a **demo pad** so you can test without Omar’s bridge

LibreCorsa remains the default demo (Open game → `localhost:3000`). For any other keyboard-driven browser game: open the game, click **Use this tab**, and retune key codes in Setup if needed.

New developers: finish [docs/ONBOARDING.md](../docs/ONBOARDING.md) first.

## Install (Load unpacked)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select **this** directory (`…/game-night-access-adapter/extension`)
4. Confirm the service worker starts (no errors on the extension card)
5. Open a game tab (LibreCorsa at `http://localhost:3000` by default) and click **Use this tab** in the popup — or rely on the LibreCorsa URL fallback

After every `git pull` that touches `extension/`, click **Reload** on the extension card.

## Using it

| Surface | What it does |
| --- | --- |
| Toolbar popup | On-screen controls (Hold or Latch), **Use this tab**, **Camera overlay**, Stop all inputs, Open game, Reconnect, Setup |
| Options page | Guided Welcome → Choose → Setup → Customize → Ready; presets; Advanced connection |
| Badge `OFF` | Access bridge down — on-screen controls still work |
| Badge `ON` | Access bridge connected |

**Focus:** click the game canvas before using popup buttons. Inputs go only to the pinned tab (or LibreCorsa demo hosts when nothing is pinned).

## File map

```text
extension/
  manifest.json          MV3 manifest (hosts, permissions, content scripts)
  background.js          Service worker: WS client, remap, tab messaging
  content/
    inject.js            Receives gnaa-apply; dispatches keys + postMessage
    page-hook.js         MAIN-world fallback listener (web_accessible)
  popup/                 Play companion (controls + status)
  options/               Guided setup + remap + presets
  styles/tokens.css      Shared design tokens
  lib/
    actions.js           Vendored from packages/shared/actions.js
    protocol.js          Vendored from packages/shared/protocol.js
    status.js            Plain-language status copy
    keys.js              code ↔ KeyboardEvent helpers
    camera-keys.js       Camera hold expiry and original-code release
  icons/                 Toolbar icons
```

## Permissions (why)

| Permission | Why |
| --- | --- |
| `storage` | Persist remap + key code profiles |
| `tabs` | Find / focus game tabs |
| `activeTab` | Help **Use this tab** pin the page behind the popup |
| Host access (`http://*/*`, `https://*/*`) | Content script + page-hook on any browser game |

## Message types (internal)

| Direction | `type` | Purpose |
| --- | --- | --- |
| popup → background | `gnaa-demo-input` | `{ action, state }` on-screen events |
| background → content | `gnaa-apply` | `{ code, state }` after remap |
| background → content | `gnaa-release-all` | Release every held key |
| popup → background | `gnaa-use-this-tab` | Pin the active game tab (`chrome.storage.session`) |
| popup → background | `gnaa-toggle-camera-dock` | Show/hide in-game camera preview iframe (`/camera/?embed=1`); dock is draggable/resizable (size persisted) |
| popup → background | `gnaa-get-status` / `gnaa-reconnect` / `gnaa-release-all` / `gnaa-open-game` | Status & helpers |
| content → background | `gnaa-content-ready` | Tab ready ping |

Bridge wire format is documented in [docs/protocol.md](../docs/protocol.md).

Camera holds refresh every 100 ms and expire after 800 ms without refresh.
Bridge disconnect releases camera keys as well. Releases retain the key code
used at keydown even if the remap changes during a hold or is cleared.
Camera pulse gestures press for 120 ms; toggle gestures refresh on fresh
vision frames. Stop all also clears the camera leases. Partial steering is
pulsed by the head-only camera sender, so existing remapping continues to apply.
Reload the extension and game tab when testing these changes; keep the camera
page in a separate visible window. See [camera setup](../camera/README.md).

## Editing shared protocol

Change `packages/shared/*` first, then **copy** into `extension/lib/`. See [packages/shared/README.md](../packages/shared/README.md).

## Targeting a game tab

1. Open the game in Chrome (`http` or `https`)
2. Click the extension → **Use this tab**
3. Retune Setup → key codes if the game’s bindings differ from LibreCorsa defaults
4. Focus the game and use the pad / phone / camera / voice

With no pin, the extension falls back to LibreCorsa demo URL matches in `lib/status.js` (`GAME_TAB_URLS`). Closing a pinned tab clears the pin for that session.

## Test matrix

| Item | Status |
| --- | --- |
| Chrome / Chromium MV3 | Required target |
| Windows | Dev smoke |
| macOS | Justin smoke — record in docs/testing-log.md |
| Edge | Likely OK (Chromium); not primary |
| Firefox | Out of scope (different extension APIs) |

## Related

- Injection design: [docs/architecture.md](../docs/architecture.md)
- Failures: [docs/TROUBLESHOOTING.md](../docs/TROUBLESHOOTING.md)
