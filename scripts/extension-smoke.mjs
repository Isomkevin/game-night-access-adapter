/**
 * Smoke: launch Chrome with the unpacked extension, open options + popup.
 */
import { chromium } from 'playwright-core';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const ext = path.join(root, 'extension');

const userData = path.join(os.tmpdir(), `gnaa-pw-${Date.now()}`);
fs.mkdirSync(userData, { recursive: true });

const context = await chromium.launchPersistentContext(userData, {
  channel: 'chrome',
  headless: false,
  ignoreDefaultArgs: ['--disable-extensions'],
  args: [
    `--disable-extensions-except=${ext}`,
    `--load-extension=${ext}`,
  ],
});

const page = await context.newPage();
await page.goto('http://localhost:3000', {
  waitUntil: 'domcontentloaded',
  timeout: 60000,
});

// Poll for extension id via chrome://extensions-internals or Preferences
async function findExtensionId() {
  for (let i = 0; i < 20; i++) {
    const workers = context.serviceWorkers();
    if (workers.length) {
      return new URL(workers[0].url()).host;
    }
    const prefsPath = path.join(userData, 'Default', 'Preferences');
    if (fs.existsSync(prefsPath)) {
      try {
        const prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
        const settings = prefs?.extensions?.settings || {};
        for (const [id, meta] of Object.entries(settings)) {
          const p = String(meta.path || meta.pathway || '');
          if (p.replace(/\\/g, '/').includes('extension') && !meta.was_installed_by_default) {
            return id;
          }
        }
      } catch {
        /* prefs may be mid-write */
      }
    }
    await page.waitForTimeout(500);
  }
  return null;
}

const extId = await findExtensionId();
if (!extId) {
  console.error('NO_EXTENSION_ID');
  const targets = context
    .pages()
    .map((p) => p.url())
    .concat(context.serviceWorkers().map((w) => w.url()));
  console.error('targets', targets);
  await context.close();
  process.exit(1);
}
console.log('EXT_ID', extId);

const options = await context.newPage();
await options.goto(`chrome-extension://${extId}/options/options.html`);
await options.waitForSelector('#bridge-url', { timeout: 10000 });
const bridgeVal = await options.locator('#bridge-url').inputValue();
console.log('BRIDGE_URL_FIELD', bridgeVal);
if (!bridgeVal.startsWith('ws://')) {
  throw new Error('bridge url missing');
}

const popup = await context.newPage();
await popup.goto(`chrome-extension://${extId}/popup/popup.html`);
await popup.waitForSelector('#status', { timeout: 10000 });
const status = await popup.locator('#status').innerText();
console.log('POPUP_STATUS', status);

const hold = popup.locator('button.hold').first();
await hold.dispatchEvent('pointerdown');
await popup.waitForTimeout(250);
await hold.dispatchEvent('pointerup');
console.log('DEMO_PAD_CLICKED');

await context.close();
console.log('EXTENSION_SMOKE_OK');
