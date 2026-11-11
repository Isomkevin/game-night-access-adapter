const fs = require('node:fs');
const { getConfigPath, DEFAULT_PORT } = require('./paths');

const defaults = {
  port: DEFAULT_PORT,
  openAtLogin: true,
  firstRunComplete: false,
  extensionInstalledHint: false,
  lastBridgeOk: false,
};

function loadConfig() {
  try {
    const raw = fs.readFileSync(getConfigPath(), 'utf8');
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return { ...defaults };
  }
}

function saveConfig(patch) {
  const next = { ...loadConfig(), ...patch };
  fs.mkdirSync(require('node:path').dirname(getConfigPath()), { recursive: true });
  fs.writeFileSync(getConfigPath(), JSON.stringify(next, null, 2), 'utf8');
  return next;
}

module.exports = { loadConfig, saveConfig, defaults };
