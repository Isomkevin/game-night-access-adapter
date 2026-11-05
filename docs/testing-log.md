# Co-designer testing log

Primary tester: **Justin Machogu** (macOS MacBook, limited finger mobility).

Record each session before claiming a feature works.

## Template

| Field | Value |
| --- | --- |
| Date | |
| Adapter / commit | |
| Game | LibreCorsa (local / Pages) |
| Browser / OS | Chrome / macOS or Windows |
| Input method | demo / camera / voice / phone |
| Mapping used | |
| What was attempted | |
| Result | worked / unreliable / failed |
| Justin's feedback | |
| Toolkit issues filed | |

## Sessions

### 2026-11-04 — Camera #11 automated development checks

| Field | Value |
| --- | --- |
| Adapter / commit | Local uncommitted `feat/camera-head-yaw`, based on `92795d5` |
| Browser / OS | Windows; Node.js 22.13.1. Browser APIs/MediaPipe simulated; real Chrome webcam test pending |
| Input method | Camera geometry/sender, actual extension background with mocked Chrome APIs, real local HTTP/WebSocket bridge |
| Mapping used | Defaults and swapped left/right; remap changed during a hold |
| What was attempted | 20 automated tests: yaw geometry, calibration, smoothing, partial key holds, release/reconnect, permission/model errors, startup cancellation, CPU fallback, routing, real camera-only bridge relay |
| Result | 20 passed. No phone or voice client used in bridge test. Source formatting check passed |
| Real-player testing | User subsequently reported the initial camera setup working; see manual result below. Detailed tuning/release checks and Chrome/macOS with Justin remain unverified |
| Known limits | CDN assets require network; camera window must remain visible; camera supplies steering, with throttle supplied separately |
| Justin's feedback | Not collected in this automated run |

#### 2026-11-04 — Initial manual camera result (user report)

| Field | Value |
| --- | --- |
| Date / tester | 2026-11-04 / user, after following local extension setup |
| Chrome version / OS | Not explicitly reported; workspace environment is Windows |
| Camera / lighting / distance | Pending |
| Dead zone / full steering / reversed | Pending |
| Neutral, left/right, partial steering | Initial setup reported working; individual checks not described |
| Phone and voice closed | Pending |
| Remap changed and response checked | Pending |
| Face loss / Stop / hidden page / closed tab | Pending |
| Bridge restart and camera retry | Pending |
| Result and comfort feedback | User reported "it is working". Comfort and selected sensitivity values not yet reported; this does not verify all issue #11 acceptance criteria |

### 2026-11-04 — Developer smoke (Kevin)

| Field | Value |
| --- | --- |
| Date | 2026-11-04 |
| Adapter / commit | initial monorepo scaffold |
| Game | LibreCorsa submodule |
| Browser / OS | Chrome / Windows (dev machine) |
| Input method | demo (extension popup) — pending live verify after load |
| Mapping used | defaults |
| What was attempted | Scaffold + synthetic key path reviewed against game source |
| Result | Source review: no `isTrusted` gate; live drive test pending |
| Justin's feedback | — |
| Toolkit issues filed | — |

### Justin session 1 — _pending_

_Fill in after first macOS smoke test (target: Thu/Fri check-in)._
