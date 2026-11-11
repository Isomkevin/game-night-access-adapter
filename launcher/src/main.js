/**
 * Game Night launcher — tray app that starts the access bridge and coaches first-run.
 * Does not open any specific game; users open their own browser game and Use this tab.
 */

const path = require('node:path');
const {
  app,
  Tray,
  Menu,
  nativeImage,
  BrowserWindow,
  dialog,
  Notification,
  ipcMain,
} = require('electron');

const { BridgeManager } = require('./bridge-manager');
const { loadConfig, saveConfig } = require('./config');
const { openInBrowser } = require('./browser');
const {
  prepareExtensionInstall,
  getInstallSteps,
  getExtensionInstallDir,
} = require('./extension-setup');
const {
  getLandingUrl,
  getHubUrl,
  DEFAULT_PORT,
} = require('./paths');

/** @type {import('electron').Tray | null} */
let tray = null;
/** @type {BrowserWindow | null} */
let firstRunWindow = null;
/** @type {BrowserWindow | null} */
let connectGameWindow = null;

const bridge = new BridgeManager();
let config = loadConfig();
let bridgeStatus = 'stopped';
let lastDetail = '';

function iconPath() {
  return path.join(__dirname, '..', 'assets', 'icon.png');
}

function applyLoginItem() {
  try {
    app.setLoginItemSettings({
      openAtLogin: !!config.openAtLogin,
      openAsHidden: true,
      path: process.execPath,
      args: app.isPackaged ? [] : [path.join(__dirname, '..')],
    });
  } catch {
    /* unsupported on some Linux DEs */
  }
}

function notify(title, body) {
  try {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show();
    }
  } catch {
    /* ignore */
  }
}

function buildTrayMenu() {
  const port = config.port || DEFAULT_PORT;
  return Menu.buildFromTemplate([
    {
      label: bridgeStatus === 'running' ? `Bridge: on (:${port})` : `Bridge: ${bridgeStatus}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Open Game Night',
      click: () => openInBrowser(getLandingUrl(port)),
    },
    {
      label: 'Control hub',
      click: () => openInBrowser(getHubUrl(port)),
    },
    {
      label: 'Extension setup…',
      click: () => runExtensionSetup(true),
    },
    {
      label: 'How to connect a game…',
      click: () => showConnectGameCoach(),
    },
    { type: 'separator' },
    {
      label: 'Restart bridge',
      click: async () => {
        try {
          await bridge.restart(config.port);
          notify('Game Night', 'Access bridge restarted.');
        } catch (err) {
          dialog.showErrorBox('Game Night', String(err.message || err));
        }
      },
    },
    {
      label: config.openAtLogin ? 'Start at login: On' : 'Start at login: Off',
      click: () => {
        config = saveConfig({ openAtLogin: !config.openAtLogin });
        applyLoginItem();
        rebuildTray();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Game Night',
      click: async () => {
        await bridge.stop();
        app.quit();
      },
    },
  ]);
}

function rebuildTray() {
  if (!tray) return;
  tray.setContextMenu(buildTrayMenu());
  tray.setToolTip(
    bridgeStatus === 'running'
      ? `Game Night — bridge on :${config.port}`
      : `Game Night — ${bridgeStatus}`
  );
}

function runExtensionSetup(forceWindow) {
  let info;
  try {
    info = prepareExtensionInstall();
  } catch (err) {
    dialog.showErrorBox('Extension setup failed', String(err.message || err));
    return;
  }
  config = saveConfig({ extensionInstalledHint: true });
  showFirstRunWindow(info, forceWindow);
}

function showFirstRunWindow(info, force) {
  if (firstRunWindow && !firstRunWindow.isDestroyed()) {
    firstRunWindow.focus();
    firstRunWindow.webContents.send('extension-info', {
      ...info,
      steps: getInstallSteps(info),
      port: config.port,
    });
    return;
  }
  if (!force && config.firstRunComplete) return;

  firstRunWindow = new BrowserWindow({
    width: 560,
    height: 640,
    title: 'Game Night — Get started',
    show: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  firstRunWindow.loadFile(path.join(__dirname, '..', 'first-run', 'index.html'));
  firstRunWindow.webContents.on('did-finish-load', () => {
    firstRunWindow?.webContents.send('extension-info', {
      ...(info || {
        path: getExtensionInstallDir(),
        browser: null,
      }),
      steps: getInstallSteps(
        info || { path: getExtensionInstallDir(), browser: null }
      ),
      port: config.port,
      landingUrl: getLandingUrl(config.port),
      hubUrl: getHubUrl(config.port),
    });
  });
  firstRunWindow.on('closed', () => {
    firstRunWindow = null;
  });
}

function showConnectGameCoach() {
  if (connectGameWindow && !connectGameWindow.isDestroyed()) {
    connectGameWindow.focus();
    return;
  }
  connectGameWindow = new BrowserWindow({
    width: 520,
    height: 480,
    title: 'How to connect a game',
    show: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  connectGameWindow.loadFile(path.join(__dirname, '..', 'first-run', 'connect-game.html'));
  connectGameWindow.webContents.on('did-finish-load', () => {
    connectGameWindow?.webContents.send('coach-info', {
      hubUrl: getHubUrl(config.port),
      landingUrl: getLandingUrl(config.port),
      port: config.port,
    });
  });
  connectGameWindow.on('closed', () => {
    connectGameWindow = null;
  });
}

ipcMain.handle('open-url', (_e, url) => {
  openInBrowser(String(url || ''));
  return true;
});

ipcMain.handle('rerun-extension-setup', () => {
  runExtensionSetup(true);
  return true;
});

ipcMain.handle('mark-first-run-done', () => {
  config = saveConfig({ firstRunComplete: true });
  return true;
});

ipcMain.handle('check-extension', async () => {
  const connected = await bridge.extensionConnected();
  return { connected, status: bridgeStatus, detail: lastDetail, port: config.port };
});

ipcMain.handle('open-hub', () => {
  openInBrowser(getHubUrl(config.port));
  return true;
});

ipcMain.handle('open-landing', () => {
  openInBrowser(getLandingUrl(config.port));
  return true;
});

async function startBridgeOrExplain() {
  try {
    await bridge.start(config.port || DEFAULT_PORT);
    config = saveConfig({ lastBridgeOk: true });
    return true;
  } catch (err) {
    const message = String(err.message || err);
    // Try alternate port once if default is busy
    if (config.port === DEFAULT_PORT) {
      const alt = DEFAULT_PORT + 1;
      try {
        await bridge.start(alt);
        config = saveConfig({ port: alt, lastBridgeOk: true });
        dialog.showMessageBox({
          type: 'warning',
          title: 'Game Night',
          message: `Port ${DEFAULT_PORT} was busy, so the bridge is using ${alt}.`,
          detail:
            'In the Chrome extension, open Setup → Advanced and set the connection address to:\n' +
            `ws://127.0.0.1:${alt}`,
        });
        return true;
      } catch {
        /* fall through */
      }
    }
    dialog.showErrorBox(
      'Could not start Game Night',
      `${message}\n\nClose any other Game Night bridge, or free port ${config.port}, then use Restart bridge from the tray menu.`
    );
    return false;
  }
}

async function bootstrap() {
  config = loadConfig();
  applyLoginItem();

  const image = nativeImage.createFromPath(iconPath());
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image.resize({ width: 16, height: 16 }));
  tray.setToolTip('Game Night');
  rebuildTray();
  tray.on('click', () => {
    tray?.popUpContextMenu();
  });
  tray.on('double-click', () => {
    openInBrowser(getLandingUrl(config.port));
  });

  bridge.setStatusHandler(({ status, detail }) => {
    bridgeStatus = status;
    lastDetail = detail || '';
    rebuildTray();
  });

  const ok = await startBridgeOrExplain();
  if (ok) {
    openInBrowser(getLandingUrl(config.port));
    if (!config.firstRunComplete) {
      runExtensionSetup(true);
    } else {
      // Soft check: if extension not connected, offer setup once
      setTimeout(async () => {
        const connected = await bridge.extensionConnected();
        if (!connected && !config.extensionInstalledHint) {
          runExtensionSetup(false);
        }
      }, 4000);
    }
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    openInBrowser(getLandingUrl(config.port || DEFAULT_PORT));
  });

  app.whenReady().then(bootstrap);

  app.on('window-all-closed', () => {
    // Stay resident in the tray; first-run windows can close freely.
  });

  app.on('before-quit', async () => {
    await bridge.stop();
  });
}
