/**
 * Copy the bundled extension into a stable user folder and coach Load unpacked.
 */

const fs = require('node:fs');
const path = require('node:path');
const { clipboard } = require('electron');
const { getExtensionSourceDir, getExtensionInstallDir } = require('./paths');
const { openExtensionsPage, findBrowser } = require('./browser');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === 'tests' || entry.name === 'node_modules') continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function ensureExtensionInstalled() {
  const source = getExtensionSourceDir();
  const target = getExtensionInstallDir();
  const manifest = path.join(source, 'manifest.json');
  if (!fs.existsSync(manifest)) {
    throw new Error(`Extension missing at ${source}`);
  }
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
  copyDir(source, target);
  return target;
}

function prepareExtensionInstall() {
  const target = ensureExtensionInstalled();
  try {
    clipboard.writeText(target);
  } catch {
    /* clipboard may fail in some headless CI contexts */
  }
  const browser = findBrowser();
  const opened = openExtensionsPage();
  return {
    path: target,
    clipboard: true,
    browser: opened.browser || browser?.name || null,
    extensionsPage: opened.page || 'chrome://extensions',
    ok: opened.ok !== false,
  };
}

function getInstallSteps(info) {
  const name = info.browser || 'Chrome';
  return [
    `We copied the extension folder and opened the ${name} Extensions page.`,
    'Turn on Developer mode (top right).',
    'Click Load unpacked.',
    `Paste the folder path (Ctrl+V / ⌘V) and choose Select Folder.\n\nFolder:\n${info.path}`,
    'Pin Game Night Access Adapter to the toolbar, then open Setup.',
  ];
}

module.exports = {
  ensureExtensionInstalled,
  prepareExtensionInstall,
  getInstallSteps,
  getExtensionInstallDir,
};
