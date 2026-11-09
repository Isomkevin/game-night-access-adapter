# Scripts

## `extension-smoke.mjs`

Optional Playwright smoke that loads the unpacked extension in Chrome and opens Options + popup.

```bash
# from repo root (dev dependency only — do not commit a root package.json for this)
npm install playwright-core --no-save
node scripts/extension-smoke.mjs
```

Requires LibreCorsa on `http://localhost:3000`. Prefer manual Load unpacked for judging demos.  
How to run the full stack: [docs/DEPLOY.md](../docs/DEPLOY.md).
