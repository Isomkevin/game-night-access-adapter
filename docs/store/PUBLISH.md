# Publish Game Night Access Adapter to the Chrome Web Store

Only the **Chrome Web Store developer account owner** can complete payment and final submit. This file is the exact checklist with copy-paste text.

## Prerequisites

1. Google account with [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) access  
2. One-time **US$5** developer registration paid  
3. Store package built (see below)  
4. Privacy policy URL live: **https://game-night-bridge.onrender.com/privacy/**  
   (also served locally at `http://127.0.0.1:18765/privacy/` when the bridge runs)

## 1. Build the upload zip

From the repo root (Git Bash / WSL / macOS / Linux):

```bash
# Store zip only (no Chrome signing key required for the zip itself)
mkdir -p dist/extension releases/extension
rm -rf /tmp/gnaa-ext-store && mkdir -p /tmp/gnaa-ext-store
rsync -a --exclude 'tests' --exclude 'README.md' extension/ /tmp/gnaa-ext-store/
# Ensure no private key field in manifest
(cd /tmp/gnaa-ext-store && zip -qrX "$(pwd)/../../dist/extension/game-night-extension-store.zip" .)
```

On Windows PowerShell (from repo root):

```powershell
$ver = (Get-Content extension/manifest.json -Raw | ConvertFrom-Json).version
$stage = Join-Path $env:TEMP "gnaa-ext-store"
Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $stage | Out-Null
Copy-Item extension\* $stage -Recurse -Force
Remove-Item (Join-Path $stage "tests") -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $stage "README.md") -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path dist\extension, releases\extension | Out-Null
$zip = "dist\extension\game-night-extension-$ver-store.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip
Copy-Item $zip "releases\extension\" -Force
Write-Host "Built $zip"
```

Upload file: `dist/extension/game-night-extension-<version>-store.zip`  
(Current manifest version is in `extension/manifest.json`.)

## 2. Create the item in the dashboard

1. Open https://chrome.google.com/webstore/devconsole  
2. **New item** → upload the store zip  
3. Fill **Store listing** using [listing-draft.md](listing-draft.md)  
4. **Category:** Accessibility  
5. **Language:** English  
6. Icon: `extension/icons/icon128.png`  
7. Screenshots: at least one **1280×800** (see `docs/store/screenshots/`)  
8. **Privacy practices:**
   - Privacy policy URL: `https://game-night-bridge.onrender.com/privacy/`
   - Single purpose: *Remaps accessibility inputs to keyboard controls in browser games.*
   - Justify permissions as in [extension-install.md](../extension-install.md) § Chrome Web Store  
9. **Distribution:** Public (or Unlisted for a private test link first)  
10. **Submit for review**

Review with broad host permissions often takes **several days to a few weeks**.

## 3. After approval

1. Copy the public Store URL into:
   - [USER_GUIDE.md](../USER_GUIDE.md)
   - [launcher.md](../launcher.md)
   - `bridge/landing/guide.html` (`#store-link`)
   - Launcher first-run “Install extension” button (prefer Store over Load unpacked)
2. Announce in the team WhatsApp / README

## 4. What this repo cannot do for you

- Pay the developer fee  
- Pass Google’s human review  
- Use your Google login without you present  

Everything else (zip, privacy page, listing copy, screenshots folder, tutorial) is prepared in-repo.
