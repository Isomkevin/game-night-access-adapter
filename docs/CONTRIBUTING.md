# Contributing

Judging rewards **working code + documentation**. Treat docs as part of the feature, not a follow-up.

## Before you write code

1. Read [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) so the product intent is clear.
2. Complete [ONBOARDING.md](ONBOARDING.md) once on your machine.
3. Read [protocol.md](protocol.md) if you touch inputs, remap, or the bridge.
4. Confirm ownership (do not silently rewrite someone else’s component):

| Area | Primary | Backup |
| --- | --- | --- |
| Monorepo / extension / coordination | Kevin | Bunny (merges) |
| Bridge / phone | Omar | Kevin |
| Voice + toolkit PR | Bunny | Kevin |
| Camera / MediaPipe | Tim | Kevin |
| Co-designer testing log | Whoever ran the session | Kevin |

If ownership is unclear, say so in WhatsApp before large changes.

## Branching

```bash
git checkout main
git pull
git submodule update --init --recursive
git checkout -b feat/<your-name>-<short-topic>
```

Examples: `feat/omar-bridge-reconnect`, `feat/tim-yaw-tuning`, `docs/bunny-voice-phrases`.

Keep PRs / pushes focused: one component or one doc theme per branch when possible.

## Docs-before-push (mandatory)

In the **same** commit or immediately before push, update:

1. The component `README.md` if run steps, ports, or ownership changed
2. [protocol.md](protocol.md) if message shapes or action ids changed
3. [architecture.md](architecture.md) if the data flow or injection strategy changed
4. [testing-log.md](testing-log.md) if you verified with Justin (or a stand-in) — record OS, browser, result
5. Root [README.md](../README.md) only for user-visible quick-start changes

PR / WhatsApp message template:

```text
What: …
How to test: …
OS/browser tested: …
Docs updated: …
Known limits: …
```

## Shared package + extension vendoring

`packages/shared/` is the design source of truth.  
`extension/lib/` is a **copy** (Chrome cannot load files outside the extension root).

When you change shared code:

```text
packages/shared/actions.js   →  extension/lib/actions.js
packages/shared/protocol.js  →  extension/lib/protocol.js
```

Diff both sides in review. Do not leave them drifting.

## Submodules

- `game/` → upstream LibreCorsa. Prefer **not** forking gameplay for the PoC; inject via the extension.
- `toolkit/` → [Isomkevin/AI-for-Accessibility-Toolkit](https://github.com/Isomkevin/AI-for-Accessibility-Toolkit). Toolkit PRs are opened **from that fork**, not by editing random copies. See [toolkit-contribution/](toolkit-contribution/).

Updating a submodule pointer in this monorepo:

```bash
cd toolkit   # or game
git fetch
git checkout <commit-or-branch>
cd ..
git add toolkit
git commit -m "chore: point toolkit submodule at <sha>"
```

## Merges

- **Bunny** handles day-to-day merges
- **Kevin** is backup if Bunny is blocked
- Prefer merge commits or clean rebases your team agrees on — never force-push `main` without explicit team agreement

## What not to do

- Do not require USB/ADB for the Saturday demo path
- Do not claim a feature “works” without an entry in [testing-log.md](testing-log.md) (at least a developer smoke test)
- Do not commit `node_modules/`, `.env` secrets, or huge binary dumps
- Do not change LibreCorsa controls as the primary accessibility path — remap in the **extension**

## Need help?

1. [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
2. WhatsApp group + next 20:30 check-in
3. Open a GitHub issue with the [component template](../.github/ISSUE_TEMPLATE/component.yml)
