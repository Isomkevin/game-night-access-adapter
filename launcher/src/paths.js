/**
 * Resolve bundled app root (bridge + controllers + extension) and user data paths.
 */

const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

const DEFAULT_PORT = 18765;

function repoRootFromLauncher() {
  // launcher/ is at <repo>/launcher — go up one when running from source
  return path.resolve(__dirname, '..', '..');
}

/**
 * Directory that contains bridge/, phone-controller/, extension/, etc.
 * Packaged: process.resourcesPath/app
 * Dev: repository root
 */
function getAppRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app');
  }
  if (process.argv.includes('--dev') || process.env.GNAA_LAUNCHER_DEV === '1') {
    return repoRootFromLauncher();
  }
  // Prefer repo root when bridge/server.js exists next to launcher/
  const candidate = repoRootFromLauncher();
  if (fs.existsSync(path.join(candidate, 'bridge', 'server.js'))) {
    return candidate;
  }
  return path.join(process.resourcesPath || candidate, 'app');
}

function getBridgeDir() {
  return path.join(getAppRoot(), 'bridge');
}

function getBridgeEntry() {
  return path.join(getBridgeDir(), 'server.js');
}

function getExtensionSourceDir() {
  return path.join(getAppRoot(), 'extension');
}

/** Persistent copy of the extension for Load unpacked (survives app updates path changes). */
function getExtensionInstallDir() {
  const base = app.getPath('userData');
  return path.join(base, 'extension');
}

function getConfigPath() {
  return path.join(app.getPath('userData'), 'launcher-config.json');
}

function getLandingUrl(port = DEFAULT_PORT) {
  return `http://127.0.0.1:${port}/`;
}

function getHubUrl(port = DEFAULT_PORT) {
  return `http://127.0.0.1:${port}/hub/`;
}

function getHealthUrl(port = DEFAULT_PORT) {
  return `http://127.0.0.1:${port}/health`;
}

module.exports = {
  DEFAULT_PORT,
  getAppRoot,
  getBridgeDir,
  getBridgeEntry,
  getExtensionSourceDir,
  getExtensionInstallDir,
  getConfigPath,
  getLandingUrl,
  getHubUrl,
  getHealthUrl,
};
