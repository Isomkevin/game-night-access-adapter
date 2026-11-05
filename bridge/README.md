# Local bridge (Omar)

Node.js **HTTP + WebSocket** hub on port **18765**.

- Fans `input` events from phone / camera / voice → extension clients
- Serves static UIs for those inputs over LAN

Kevin owns the stub; Omar owns hardening, reconnect UX, and any optional OS-level key simulation (prefer extension injection for macOS).

## Why WebSocket (not ADB)

| Concern | Approach |
| --- | --- |
| No extra hardware rule | Phone is a web page |
| Justin on macOS | No ADB / Windows-only helpers required |
| Latency | Localhost / LAN only — not cloud |

## Prerequisites

- Node.js 18+
- Free TCP port 18765 (or set `GNAA_PORT`)

## Run

```bash
cd bridge
npm install
npm start
```

Dev auto-reload (optional):

```bash
npm run dev
```

### Expected console output

```text
Game Night bridge on http://127.0.0.1:18765
  Landing    http://127.0.0.1:18765/
  Hub        http://127.0.0.1:18765/hub/
  WebSocket  ws://127.0.0.1:18765
  Phone UI   http://127.0.0.1:18765/phone/
  Camera UI  http://127.0.0.1:18765/camera/
  Voice UI   http://127.0.0.1:18765/voice/
  Phone LAN  http://<your-lan-ip>:18765/phone/
```

### Health check

```bash
curl http://127.0.0.1:18765/health
```

```json
{ "ok": true, "clients": { "extension": 1, "phone": 0 } }
```

## HTTP routes

| Path | Serves |
| --- | --- |
| `/` | Product landing ([`landing/`](landing/)) |
| `/hub/` | Control-method hub ([`hub/`](hub/)) |
| `/landing/*` | Landing assets (CSS, mark, favicon) |
| `/health` | JSON status |
| `/phone/`, `/phone/*` | [`../phone-controller/`](../phone-controller/) |
| `/camera/`, `/camera/*` | [`../camera/`](../camera/) |
| `/voice/`, `/voice/*` | [`../voice/`](../voice/) |
| `/ui/*` | [`../packages/ui/`](../packages/ui/) design tokens |
| `/shared/*` | [`../packages/shared/`](../packages/shared/) (optional debug) |

## WebSocket behaviour

1. Client connects and sends `{ "type":"hello", "role":"extension"|"phone"|"camera"|"voice", "v":1 }`
2. Client may send `{ "type":"input", ... }` (see [docs/protocol.md](../docs/protocol.md))
3. Bridge broadcasts `input` frames **only to** clients with `role === "extension"`
4. `status` frames go to all connected clients

## Files

| File | Role |
| --- | --- |
| `server.js` | HTTP static + `ws` hub |
| `landing/` | Public product landing at `/` |
| `hub/` | Control-method chooser at `/hub/` |
| `package.json` | `ws` dependency, `npm start` |

## Configuration

| Env | Default | Meaning |
| --- | --- | --- |
| `PORT` | — | Listen port when set (Render / most PaaS inject this) |
| `GNAA_PORT` | `18765` | Local override when `PORT` is unset |

Bind address is `0.0.0.0` so phones on LAN (or a hosted demo) can connect. Prefer trusted Wi‑Fi for live co-designer tests; cloud hosting adds latency.

If you change the port locally, the extension must use the matching `ws://127.0.0.1:<port>` (Setup → connection address, or `DEFAULT_BRIDGE_PORT` in shared protocol).

## Omar backlog (suggested)

- [ ] Heartbeats / clearer disconnect reasons
- [ ] Rate-limit abusive input spam
- [ ] Optional TLS for hostile networks (not required for Saturday LAN demo)
- [ ] Only if extension injection fails on a platform: OS key simulation — document OS matrix first

## Related

- [docs/ONBOARDING.md](../docs/ONBOARDING.md)
- [docs/TROUBLESHOOTING.md](../docs/TROUBLESHOOTING.md)
- [phone-controller/README.md](../phone-controller/README.md)
