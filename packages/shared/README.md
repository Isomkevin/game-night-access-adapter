# `@game-night/shared`

Shared **action IDs** and **WebSocket protocol** helpers for the Game Night Access Adapter.

## Files

| File | Contents |
| --- | --- |
| `actions.js` | Game actions, labels, default LibreCorsa `KeyboardEvent.code` values, hold-action set |
| `protocol.js` | Port constants, `createInputEvent`, remap defaults, logical input catalog, `resolveRemap` |

Human-readable contract: [`../../docs/protocol.md`](../../docs/protocol.md).

## Usage

Bridge and tooling can import from here (ESM):

```js
import { createInputEvent, DEFAULT_BRIDGE_PORT } from '../packages/shared/protocol.js';
import { DEFAULT_KEY_CODES } from '../packages/shared/actions.js';
```

## Chrome extension vendoring

The extension **must not** import this folder directly (extension root isolation).

After any edit here, copy into:

- `extension/lib/actions.js`
- `extension/lib/protocol.js`

Keep comments that say “vendored from packages/shared” so reviewers notice drift.

## Changing the protocol

1. Edit this package
2. Mirror into `extension/lib/`
3. Update senders: `phone-controller/`, `camera/`, `voice/`, `bridge/` if needed
4. Update [`docs/protocol.md`](../../docs/protocol.md) in the same PR
5. Bump mental `PROTOCOL_VERSION` if you break wire compatibility (field already exists as `v`)
