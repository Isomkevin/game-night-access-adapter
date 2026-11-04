# Toolkit contribution (Bunny + Kevin)

Upstream: [AI-for-Accessibility-Collective/AI-for-Accessibility-Toolkit](https://github.com/AI-for-Accessibility-Collective/AI-for-Accessibility-Toolkit)  
Fork: [Isomkevin/AI-for-Accessibility-Toolkit](https://github.com/Isomkevin/AI-for-Accessibility-Toolkit)

Saturday deliverable: **pull request to the toolkit** from the fork.

## What to PR

1. **Example / docs** — `examples/game-night-librecorsa/` (copy from this folder’s `example/`) showing:
   - Shared input protocol events
   - Mapping Controller phrases → `voice:*` logical actions
   - Link back to the Game Night monorepo
2. **Optional skill** — `SKILL.md` recipe for “motor-access racing controls” that documents remappable inputs (no model required).
3. **Issues** — file upstream issues for gaps Justin hits (voice latency, grammar coverage, macOS quirks). Template: `ISSUE_TEMPLATE.md`.

## Status (2026-11-04)

- Example committed on fork branch `feat/game-night-librecorsa-example`
- Push succeeded to [Isomkevin/AI-for-Accessibility-Toolkit](https://github.com/Isomkevin/AI-for-Accessibility-Toolkit/tree/feat/game-night-librecorsa-example)
- `gh pr create` against upstream failed (`must be a collaborator`). Open the PR in the browser once you have rights, or ask a Collective maintainer:

[Compare: upstream main ← Isomkevin feat branch](https://github.com/AI-for-Accessibility-Collective/AI-for-Accessibility-Toolkit/compare/main...Isomkevin:AI-for-Accessibility-Toolkit:feat/game-night-librecorsa-example)

## Steps (if redoing)

```bash
cd toolkit
git checkout feat/game-night-librecorsa-example
# files already under examples/game-night-librecorsa/
git push -u origin HEAD
# Open the compare link above, or:
gh pr create --repo AI-for-Accessibility-Collective/AI-for-Accessibility-Toolkit \
  --head Isomkevin:feat/game-night-librecorsa-example \
  --title "docs: LibreCorsa game-night accessibility bridge example"
```

## Bunny integration target

Prefer toolkit `controller/` (`createController` + grammar / voice mode) over the monorepo’s Web Speech demo (`voice/`). The demo proves the wire protocol; the toolkit path is what judges score for “use and extend the toolkit.”
