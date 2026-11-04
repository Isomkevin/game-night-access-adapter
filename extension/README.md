# Chrome extension (Kevin)

Manifest V3 extension that:

1. Connects to the local bridge (optional)
2. Remaps logical inputs → LibreCorsa game actions
3. Injects `KeyboardEvent`s (`keydown` / `keyup`) into the game tab
4. Provides a **demo pad** so you can test without Omar’s bridge

New developers: finish [docs/ONBOARDING.md](../docs/ONBOARDING.md) first.

## Install (Load unpacked)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select **this** directory (`…/game-night-access-adapter/extension`)
4. Confirm the service worker starts (no errors on the extension card)
5. Open LibreCorsa at `http://localhost:3000` (or the GitHub Pages build) and enter a **driving** session

After every `git pull` that touches `extension/`, click **Reload** on the extension card.

## Using it

| Surface | What it does |
| --- | --- |
| Toolbar popup | Hold demo controls; reconnect bridge; open remap |
| Options page | Bridge WebSocket URL; full remap table; key-code overrides; export/import JSON |
| Badge `demo` | Bridge down — demo pad still works |
| Badge `ON` | WebSocket to bridge is up |

**Focus:** click the game canvas before holding popup buttons. The game must be in the driving phase.

## File map

```text
extension/
  manifest.json          MV3 manifest (hosts, permissions, content scripts)
  background.js          Service worker: WS client, remap, tab messaging
  content/
    inject.js            Receives gnaa-apply; dispatches keys + postMessage
    page-hook.js         MAIN-world fallback listener (web_accessible)
  popup/                 Demo pad UI
  options/               Remap + profile import/export
  lib/
    actions.js           Vendored from packages/shared/actions.js
    protocol.js          Vendored from packages/shared/protocol.js
    keys.js              code ↔ KeyboardEvent helpers
  icons/                 Toolbar icons
```

## Permissions (why)

| Permission | Why |
| --- | --- |
| `storage` | Persist remap + key code profiles |
| `tabs` | Find LibreCorsa tabs to message |
| Host access | Inject only on localhost:3000 and khazp.github.io/librecorsa |

## Message types (internal)

| Direction | `type` | Purpose |
| --- | --- | --- |
| popup → background | `gnaa-demo-input` | `{ action, state }` demo events |
| background → content | `gnaa-apply` | `{ code, state }` after remap |
| popup → background | `gnaa-get-status` / `gnaa-reconnect` | Bridge status |
| content → background | `gnaa-content-ready` | Tab ready ping |

Bridge wire format is documented in [docs/protocol.md](../docs/protocol.md).

## Editing shared protocol

Change `packages/shared/*` first, then **copy** into `extension/lib/`. See [packages/shared/README.md](../packages/shared/README.md).

## Adding a host URL

1. `manifest.json` → `host_permissions`, `content_scripts.matches`, `web_accessible_resources.matches`
2. `background.js` → `chrome.tabs.query({ url: [...] })`
3. Reload the extension

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
