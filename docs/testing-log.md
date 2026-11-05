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

### 2026-11-05 — Local camera conflict resolution against main

| Field | Value |
| --- | --- |
| Adapter / commit | `feat/tim-camera-head-yaw` (`3d2ea7f`) combined locally with main `f6418ff` |
| Browser / OS | Windows / Node.js 22.13.1; runtime browser APIs simulated |
| Changes preserved | Main's vision/profile UI, control hub, extension status and Stop all, `setRemap`, and existing session records; calibrated head-only controller available at `/camera/head-steering.html` |
| What was attempted | 23 tests: earlier camera checks plus camera pulses, merged status/Stop all/remapping routes, disabled-binding release, and fresh-frame toggle refresh; real HTTP/WebSocket bridge serves both camera pages |
| Result | 23 passed; no live webcam or macOS test performed during conflict resolution |
| Next manual check | Reload extension and game tab; check vision setup at `/camera/` and the original head-only controls at `/camera/head-steering.html` |
| Publishing | Local resolution only; no push or GitHub PR merge performed |

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

### 2026-11-04 — Developer smoke (Kevin) — scaffold review

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

### 2026-11-04 — Developer smoke (Kevin) — bridge + game boot

| Field | Value |
| --- | --- |
| Date | 2026-11-04 |
| Adapter / commit | main (extension Options bridge URL + icons + presentation) |
| Game | LibreCorsa local `npm run dev` → http://localhost:3000 |
| Browser / OS | Chromium (Cursor browser) + Node WS client / Windows |
| Input method | bridge protocol (synthetic phone → extension role) |
| Mapping used | n/a (pre-extension fan-out) |
| What was attempted | Health `/health`; static `/phone/` `/camera/` `/voice/` = 200; WS hello+input fan-out to `role=extension`; LibreCorsa title/loading boots; phone UI “Connected to bridge”; camera “Bridge connected — tracking…”; Chrome launched with `--load-extension=extension` |
| Result | **worked** for bridge + input pages + game boot. **Manual step left:** enter driving phase and hold extension demo pad (or phone/camera) while game tab focused — confirm car moves, then tick issue #8 |
| Justin's feedback | — |
| Toolkit issues filed | — |

### 2026-11-05 — Vision controller foundation (developer)

| Field | Value |
| --- | --- |
| Date | 2026-11-05 |
| Adapter / commit | vision input system (camera modular engine) |
| Game | LibreCorsa (manual drive test still required) |
| Browser / OS | Chrome target / Windows + macOS |
| Input method | camera (vision controller) |
| Mapping used | defaults: `tiltLeft`/`tiltRight` → steer; other gestures unmapped until assigned |
| What was attempted | Modular detection layers; face blendshapes + head pose; lazy hand Gesture Recognizer; calibration/profiles/setRemap; Options grouped by source; protocol docs |
| Result | **code complete** — live webcam gesture reliability and LibreCorsa drive confirmation pending on device |
| Justin's feedback | — |
| Toolkit issues filed | — |

### 2026-11-05 — Developer smoke (UX transformation) — not Justin-verified

| Field | Value |
| --- | --- |
| Date | 2026-11-05 |
| Adapter / commit | product UX transformation (options shell, popup latch/stop-all, bridge hub, phone latch, voice restart) |
| Game | LibreCorsa local (manual verify recommended) |
| Browser / OS | Chrome / Windows (dev machine) |
| Input method | demo / phone / camera / voice (developer pass) |
| Mapping used | defaults + Customize UI |
| What was attempted | Guided options journey; human remap + presets + hardened import; popup Hold/Latch + Stop all inputs; bridge `/` hub; phone latch + release on hide; voice auto-restart + experimental copy; camera plain-language status (existing release-on-lost retained) |
| Result | **Developer implementation landed.** Live drive + Justin macOS session still required before calling features co-designer-supported. |
| Justin's feedback | — |
| Toolkit issues filed | — |

### Justin session 1 — _pending_

_Fill in after first macOS smoke test (target: Thu/Fri check-in). Developer smoke ≠ Justin verification._
