# Documentation index

**New developer?** Follow this path — do not skim everything on day one.

| Order | Doc | Why |
| --- | ---: | --- |
| 1 | [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) | What we are building and why |
| 2 | [GLOSSARY.md](GLOSSARY.md) | Shared vocabulary |
| 3 | [ONBOARDING.md](ONBOARDING.md) | Clone → game → extension demo → optional bridge |
| 4 | [DEV_ENVIRONMENT.md](DEV_ENVIRONMENT.md) | Terminals, ports, env, shells |
| 5 | [architecture.md](architecture.md) | Data flow and injection |
| 6 | [protocol.md](protocol.md) | Wire contract before changing inputs |
| 7 | [CONTRIBUTING.md](CONTRIBUTING.md) | Branches, docs-before-push, first PR |
| 8 | [FAQ.md](FAQ.md) · [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | When something fails |

Root overview / quick start: [`../README.md`](../README.md).

## Challenge / co-design

| Doc | Purpose |
| --- | --- |
| [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) | Full product intent — purpose, inputs, remap, ownership, status |
| [writeup.md](writeup.md) | Short project write-up for judging |
| [testing-log.md](testing-log.md) | Justin (and other) session notes — fill before claiming “works” |
| [presentation.html](presentation.html) | Saturday slide deck — also served at `/presentation/` on the bridge |
| [presentation-checklist.md](presentation-checklist.md) | Demo video + slides checklist |
| [demo-video.md](demo-video.md) | Shot list / upload placeholder |
| [toolkit-contribution/](toolkit-contribution/) | Upstream toolkit PR pack + issue template |

## Phone-tilt desktop adapter (optional)

Separate from the **web** phone controller. Not required for day-one onboarding.

| Doc | Description |
|-----|-------------|
| [phone-tilt-adapter.md](phone-tilt-adapter.md) | Android tilt → keyboard via ADB |
| [desktop-app.md](desktop-app.md) | PySide desktop app |
| [local-api.md](local-api.md) | Loopback JSON API |
| [installers.md](installers.md) | Windows/Linux installers |
| [development-phases.md](development-phases.md) | Phase plan for that adapter |

Add a short doc for each new input adapter before merging: how to run it, what was tested (OS / browser / device), and known accessibility limitations.

## Component READMEs (in the tree)

| Component | README |
| --- | --- |
| Chrome extension | [`../extension/README.md`](../extension/README.md) |
| Local bridge | [`../bridge/README.md`](../bridge/README.md) |
| Phone controller (web) | [`../phone-controller/README.md`](../phone-controller/README.md) |
| Camera / vision (MediaPipe) | [`../camera/README.md`](../camera/README.md) |
| Voice | [`../voice/README.md`](../voice/README.md) |
| Shared protocol package | [`../packages/shared/README.md`](../packages/shared/README.md) |
| Shared UI tokens | [`../packages/ui/README.md`](../packages/ui/README.md) |
| Scripts | [`../scripts/README.md`](../scripts/README.md) |
| Desktop phone-tilt app | [desktop-app.md](desktop-app.md) |

## Reference

| Doc | Purpose |
| --- | --- |
| [GLOSSARY.md](GLOSSARY.md) | Terms |
| [FAQ.md](FAQ.md) | Common questions |
| [DEV_ENVIRONMENT.md](DEV_ENVIRONMENT.md) | Ports / terminals / shells |
| [architecture.md](architecture.md) | System design |
| [protocol.md](protocol.md) | WebSocket + remap contract |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Workflow |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Failure playbook |
