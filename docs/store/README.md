# Chrome Web Store — Phase B

Phase A of the desktop launcher still uses **Load unpacked** (guided). The Web Store is the only way to make extension install one-click on unmanaged Windows/macOS machines.

## Owner checklist

1. Chrome Web Store developer account (one-time fee) — https://chrome.google.com/webstore/devconsole
2. Build store zip: `bash packaging/extension/build.sh` → `game-night-extension-*-store.zip`
3. Listing assets:
   - 128×128 icon: [`extension/icons/icon128.png`](../../extension/icons/icon128.png)
   - At least one 1280×800 screenshot (hub, remap Setup, phone UI)
   - Category: **Accessibility**
4. Privacy policy URL (host on the landing site or docs site). Must state:
   - Camera/phone stay local to the bridge
   - Voice uses Chrome speech (audio to Google while listening)
   - No audio/transcript storage by the extension
   - `storage` for remap profiles; broad host access to inject keys into the active game tab
5. Single-purpose: remaps accessibility inputs to keyboard controls in browser games
6. Submit for review (broad host permissions → deeper review, days–weeks)

## After approval

- Replace launcher “Extension setup” primary path with the Store link
- Update [extension-install.md](../extension-install.md) and [launcher.md](../launcher.md)
- Windows/Linux sideload packages become optional fallbacks

## Do not block

Desktop launcher, bridge packaging, and Load unpacked coaching ship **without** waiting for Store approval.
