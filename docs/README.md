# Documentation index

Start here if you are new to the repo:

1. **[PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md)** — what this project is supposed to be and do (problem, inputs, remap, pieces, status)
2. **[ONBOARDING.md](ONBOARDING.md)** — clone, run game + extension + bridge, verify end-to-end
3. **[architecture.md](architecture.md)** — how pieces fit together
4. **[protocol.md](protocol.md)** — WebSocket / remap contract (required before changing inputs)
5. **[CONTRIBUTING.md](CONTRIBUTING.md)** — branches, docs-before-push, ownership
6. **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** — common failures

## Challenge / co-design

| Doc | Purpose |
| --- | --- |
| [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) | Full product intent — purpose, inputs, remap, ownership, status |
| [writeup.md](writeup.md) | Short project write-up for judging |
| [testing-log.md](testing-log.md) | Justin (and other) session notes — fill before claiming “works” |
| [presentation.html](presentation.html) | Saturday slide deck (←/→ keys) |
| [presentation-checklist.md](presentation-checklist.md) | Demo video + slides checklist |
| [demo-video.md](demo-video.md) | Shot list / upload placeholder |
| [toolkit-contribution/](toolkit-contribution/) | Upstream toolkit PR pack + issue template |

## Phone-tilt desktop adapter

| Doc | Description |
|-----|-------------|
| [phone-tilt-adapter.md](phone-tilt-adapter.md) | Android tilt → keyboard adapter: USB/wireless debugging setup, architecture, tuning, limitations |
| [desktop-app.md](desktop-app.md) | PySide desktop app: sensor mappings, devices, how to run |
| [local-api.md](local-api.md) | Loopback JSON API for mappings, settings, and ADB scan |
| [installers.md](installers.md) | Linux deb, Windows zip/MSI, and self-extracting setup.exe |
| [development-phases.md](development-phases.md) | Phase plan and the tests that close each phase |

Add a short doc for each new input adapter before opening a merge request, including: how to run it, what was tested (OS / browser / device), and known accessibility limitations.

## Component READMEs (in the tree)

| Component | README |
| --- | --- |
| Chrome extension | [`../extension/README.md`](../extension/README.md) |
| Local bridge | [`../bridge/README.md`](../bridge/README.md) |
| Phone controller | [`../phone-controller/README.md`](../phone-controller/README.md) |
| Camera / vision controller (MediaPipe) | [`../camera/README.md`](../camera/README.md) |
| Voice demo | [`../voice/README.md`](../voice/README.md) |
| Shared protocol package | [`../packages/shared/README.md`](../packages/shared/README.md) |
| Desktop phone-tilt app | [`desktop-app.md`](desktop-app.md) |

## Root

The repository overview and quick start live in [`../README.md`](../README.md). Prefer **ONBOARDING** for a first successful run.
