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

### Justin session 1 — _pending_

_Fill in after first macOS smoke test (target: Thu/Fri check-in)._
