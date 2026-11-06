/**
 * Service worker: bridge WebSocket client + remap + fan-out to the pinned game tab
 * (or LibreCorsa demo hosts when nothing is pinned).
 */

import {
  DEFAULT_BRIDGE_WS,
  DEFAULT_BRIDGE_HTTP,
  DEFAULT_REMAP,
  isInputEvent,
  isSetRemapEvent,
  createHello,
  resolveRemap,
} from './lib/protocol.js';
import { DEFAULT_KEY_CODES, HOLD_ACTIONS } from './lib/actions.js';
import { CameraKeys } from './lib/camera-keys.js';
import { badgeForBridge, GAME_TAB_URLS, GAME_OPEN_URL } from './lib/status.js';

const STORAGE_KEYS = {
  remap: 'remap',
  keyCodes: 'keyCodes',
  bridgeUrl: 'bridgeUrl',
};

const SESSION_KEYS = {
  targetTabId: 'targetTabId',
  targetTabTitle: 'targetTabTitle',
  targetTabUrl: 'targetTabUrl',
  targetTabHost: 'targetTabHost',
  cameraDockOpen: 'cameraDockOpen',
};

/**
 * @param {string} [wsUrl]
 */
function httpFromBridge(wsUrl) {
  try {
    const u = new URL(String(wsUrl || DEFAULT_BRIDGE_WS).replace(/^ws/i, 'http'));
    return `${u.protocol}//${u.host}`;
  } catch {
    return DEFAULT_BRIDGE_HTTP;
  }
}

function cameraEmbedUrl(wsUrl) {
  return `${httpFromBridge(wsUrl)}/camera/?embed=1`;
}

/** @type {WebSocket|null} */
let socket = null;
let reconnectTimer = null;
let bridgeUrl = DEFAULT_BRIDGE_WS;
let bridgeStatus = 'disconnected';
let bridgeGeneration = 0;
let cameraInputQueue = Promise.resolve();
const cameraKeys = new CameraKeys((code, state) => sendToGameTabs({ type: 'gnaa-apply', code, state }));

async function loadSettings() {
  const data = await chrome.storage.local.get([
    STORAGE_KEYS.remap,
    STORAGE_KEYS.keyCodes,
    STORAGE_KEYS.bridgeUrl,
  ]);
  return {
    remap: data[STORAGE_KEYS.remap] || { ...DEFAULT_REMAP },
    keyCodes: data[STORAGE_KEYS.keyCodes] || { ...DEFAULT_KEY_CODES },
    bridgeUrl: data[STORAGE_KEYS.bridgeUrl] || DEFAULT_BRIDGE_WS,
  };
}

async function ensureDefaults() {
  const data = await chrome.storage.local.get([
    STORAGE_KEYS.remap,
    STORAGE_KEYS.keyCodes,
  ]);
  const patch = {};
  if (!data[STORAGE_KEYS.remap]) patch[STORAGE_KEYS.remap] = { ...DEFAULT_REMAP };
  if (!data[STORAGE_KEYS.keyCodes]) patch[STORAGE_KEYS.keyCodes] = { ...DEFAULT_KEY_CODES };
  if (Object.keys(patch).length) await chrome.storage.local.set(patch);
}

function setBadge(text, color) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}

function updateBadge() {
  const b = badgeForBridge(bridgeStatus);
  setBadge(b.text, b.color);
}

/**
 * @param {string} [url]
 */
function hostFromUrl(url) {
  if (!url) return '';
  try {
    return new URL(url).host || '';
  } catch {
    return '';
  }
}

async function getPinnedTarget() {
  const data = await chrome.storage.session.get([
    SESSION_KEYS.targetTabId,
    SESSION_KEYS.targetTabTitle,
    SESSION_KEYS.targetTabUrl,
    SESSION_KEYS.targetTabHost,
  ]);
  const id = data[SESSION_KEYS.targetTabId];
  if (typeof id !== 'number') {
    return {
      targetTabId: null,
      targetTabTitle: '',
      targetTabUrl: '',
      targetTabHost: '',
      tab: null,
    };
  }
  try {
    const tab = await chrome.tabs.get(id);
    if (!tab || tab.id == null) {
      await clearPinnedTarget();
      return {
        targetTabId: null,
        targetTabTitle: '',
        targetTabUrl: '',
        targetTabHost: '',
        tab: null,
      };
    }
    return {
      targetTabId: tab.id,
      targetTabTitle: tab.title || data[SESSION_KEYS.targetTabTitle] || '',
      targetTabUrl: tab.url || data[SESSION_KEYS.targetTabUrl] || '',
      targetTabHost: hostFromUrl(tab.url) || data[SESSION_KEYS.targetTabHost] || '',
      tab,
    };
  } catch {
    await clearPinnedTarget();
    return {
      targetTabId: null,
      targetTabTitle: '',
      targetTabUrl: '',
      targetTabHost: '',
      tab: null,
    };
  }
}

async function clearPinnedTarget() {
  await chrome.storage.session.remove([
    SESSION_KEYS.targetTabId,
    SESSION_KEYS.targetTabTitle,
    SESSION_KEYS.targetTabUrl,
    SESSION_KEYS.targetTabHost,
  ]);
}

/**
 * @param {chrome.tabs.Tab} tab
 */
async function setPinnedTarget(tab) {
  if (!tab || tab.id == null) {
    throw new Error('No tab to pin');
  }
  const url = tab.url || '';
  if (!/^https?:/i.test(url)) {
    throw new Error('Pin an http(s) game page (not chrome:// or the extension UI).');
  }
  await chrome.storage.session.set({
    [SESSION_KEYS.targetTabId]: tab.id,
    [SESSION_KEYS.targetTabTitle]: tab.title || '',
    [SESSION_KEYS.targetTabUrl]: url,
    [SESSION_KEYS.targetTabHost]: hostFromUrl(url),
  });
  return {
    targetTabId: tab.id,
    targetTabTitle: tab.title || '',
    targetTabUrl: url,
    targetTabHost: hostFromUrl(url),
  };
}

async function queryFallbackGameTabs() {
  return chrome.tabs.query({ url: GAME_TAB_URLS });
}

/**
 * Prefer the pinned tab; otherwise LibreCorsa demo hosts.
 * @returns {Promise<chrome.tabs.Tab[]>}
 */
async function resolveGameTabs() {
  const pinned = await getPinnedTarget();
  if (pinned.tab) return [pinned.tab];
  return queryFallbackGameTabs();
}

async function sendToGameTabs(payload) {
  const tabs = await resolveGameTabs();
  await Promise.all(
    tabs.map((tab) =>
      chrome.tabs.sendMessage(tab.id, payload).catch(() => {})
    )
  );
  return tabs.length;
}

async function buildStatusPayload() {
  const pinned = await getPinnedTarget();
  const fallback = pinned.tab ? [] : await queryFallbackGameTabs();
  const gameTabOpen = Boolean(pinned.tab) || fallback.length > 0;
  const session = await chrome.storage.session.get(SESSION_KEYS.cameraDockOpen);
  return {
    bridgeStatus,
    bridgeUrl,
    gameTabOpen,
    gameTabCount: pinned.tab ? 1 : fallback.length,
    targetTabId: pinned.targetTabId,
    targetTabTitle: pinned.targetTabTitle,
    targetTabUrl: pinned.targetTabUrl,
    targetTabHost: pinned.targetTabHost,
    cameraDockOpen: !!session[SESSION_KEYS.cameraDockOpen],
    workerOk: true,
  };
}

/**
 * Show/hide/toggle the in-game camera dock on resolved game tabs.
 * @param {'show'|'hide'|'toggle'} action
 */
async function setCameraDock(action) {
  const tabs = await resolveGameTabs();
  if (!tabs.length) {
    return { ok: false, error: 'No game tab open. Pin a tab with Use this tab, or Open game.' };
  }
  const url = cameraEmbedUrl(bridgeUrl);
  let last = { ok: false, open: false };
  for (const tab of tabs) {
    try {
      last = await chrome.tabs.sendMessage(tab.id, {
        type: 'gnaa-camera-dock',
        action,
        url,
      });
    } catch {
      last = {
        ok: false,
        error: 'Reload the game tab so the extension content script can inject the camera dock.',
      };
    }
  }
  if (last?.ok) {
    await chrome.storage.session.set({
      [SESSION_KEYS.cameraDockOpen]: !!last.open,
    });
  }
  return last?.ok
    ? { ok: true, open: !!last.open }
    : { ok: false, error: last?.error || 'Could not update camera overlay.' };
}

/**
 * Merge or replace remap entries pushed from the camera setup page.
 * @param {{ entries: Record<string, string>, merge?: boolean }} msg
 */
async function handleSetRemap(msg) {
  const settings = await loadSettings();
  const entries = msg.entries || {};
  const next =
    msg.merge === false
      ? { ...DEFAULT_REMAP, ...entries }
      : { ...settings.remap, ...entries };
  for (const [k, v] of Object.entries(entries)) {
    if (!v) delete next[k];
  }
  await chrome.storage.local.set({ [STORAGE_KEYS.remap]: next });
}

/**
 * Apply a logical input event through remap → key code → game tab.
 * @param {{ source: string, action: string, state: string }} evt
 */
async function handleInputEvent(evt) {
  const generation = bridgeGeneration;
  if (evt.source === 'camera' && evt.state === 'up') return cameraKeys.release(evt.action);
  const settings = await loadSettings();
  if (evt.source === 'camera' && (generation !== bridgeGeneration || bridgeStatus !== 'connected')) return;
  const logicalId = `${evt.source}:${evt.action}`;
  let gameAction = resolveRemap(settings.remap, logicalId);

  if (!gameAction && settings.keyCodes[evt.action]) {
    gameAction = evt.action;
  }
  if (!gameAction) return;

  const code = settings.keyCodes[gameAction] || DEFAULT_KEY_CODES[gameAction];
  if (!code) return;

  if (evt.source === 'camera') {
    // Ups use the code held at keydown, even if the user remapped meanwhile.
    return cameraKeys.apply(evt.action, code, evt.state);
  }

  let state = evt.state;
  if (state === 'pulse' && HOLD_ACTIONS.has(gameAction)) {
    // content script handles pulse
  }
  await sendToGameTabs({ type: 'gnaa-apply', code, state });
}

async function releaseAllInputs() {
  await cameraInputQueue;
  await cameraKeys.releaseAll();
  await sendToGameTabs({ type: 'gnaa-release-all' });
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectBridge();
  }, 3000);
}

function connectBridge() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }
  bridgeStatus = 'connecting';
  updateBadge();
  try {
    socket = new WebSocket(bridgeUrl);
  } catch {
    bridgeStatus = 'disconnected';
    updateBadge();
    scheduleReconnect();
    return;
  }

  socket.addEventListener('open', () => {
    bridgeStatus = 'connected';
    updateBadge();
    socket.send(JSON.stringify(createHello('extension')));
  });

  socket.addEventListener('message', (ev) => {
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    if (isInputEvent(msg)) {
      if (msg.source === 'camera') {
        const generation = bridgeGeneration;
        cameraInputQueue = cameraInputQueue.then(() => {
          if (generation !== bridgeGeneration || bridgeStatus !== 'connected') return;
          return handleInputEvent(msg);
        }).catch((error) => console.error('[Camera] Input handling failed', error));
      } else {
        handleInputEvent(msg);
      }
      return;
    }
    if (isSetRemapEvent(msg)) {
      handleSetRemap(msg);
    }
  });

  socket.addEventListener('close', () => {
    bridgeGeneration++;
    cameraKeys.releaseAll();
    bridgeStatus = 'disconnected';
    updateBadge();
    socket = null;
    scheduleReconnect();
  });

  socket.addEventListener('error', () => {
    try {
      socket.close();
    } catch {
      /* ignore */
    }
  });
}

chrome.runtime.onInstalled.addListener(() => {
  ensureDefaults().then(() => {
    updateBadge();
    connectBridge();
  });
});

chrome.runtime.onStartup.addListener(() => {
  ensureDefaults().then(() => {
    updateBadge();
    connectBridge();
  });
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const data = await chrome.storage.session.get(SESSION_KEYS.targetTabId);
  if (data[SESSION_KEYS.targetTabId] === tabId) {
    await clearPinnedTarget();
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes[STORAGE_KEYS.bridgeUrl]) {
    bridgeUrl = changes[STORAGE_KEYS.bridgeUrl].newValue || DEFAULT_BRIDGE_WS;
    if (socket) {
      try {
        socket.close();
      } catch {
        /* ignore */
      }
    }
    connectBridge();
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || !msg.type) return;

  if (msg.type === 'gnaa-demo-input') {
    handleInputEvent({
      source: 'demo',
      action: msg.action,
      state: msg.state || 'pulse',
    }).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg.type === 'gnaa-get-status') {
    buildStatusPayload()
      .then((payload) => sendResponse(payload))
      .catch(() => {
        sendResponse({
          bridgeStatus,
          bridgeUrl,
          gameTabOpen: false,
          gameTabCount: 0,
          targetTabId: null,
          targetTabTitle: '',
          targetTabUrl: '',
          targetTabHost: '',
          workerOk: true,
        });
      });
    return true;
  }

  if (msg.type === 'gnaa-use-this-tab') {
    (async () => {
      let tab = null;
      if (typeof msg.tabId === 'number') {
        tab = await chrome.tabs.get(msg.tabId);
      } else {
        const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
        tab = active || null;
      }
      // Popup may be the "active" context; prefer last focused window's selected tab.
      if (!tab || !tab.url || tab.url.startsWith('chrome-extension://')) {
        const [focused] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (focused) tab = focused;
      }
      if (!tab) throw new Error('Could not find an active tab.');
      const pinned = await setPinnedTarget(tab);
      sendResponse({ ok: true, ...pinned });
    })().catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
    return true;
  }

  if (msg.type === 'gnaa-clear-game-tab') {
    clearPinnedTarget()
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }

  if (msg.type === 'gnaa-reconnect') {
    if (socket) {
      try {
        socket.close();
      } catch {
        /* ignore */
      }
    }
    connectBridge();
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'gnaa-release-all') {
    releaseAllInputs().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg.type === 'gnaa-open-game') {
    const url = msg.url || GAME_OPEN_URL;
    (async () => {
      const pinned = await getPinnedTarget();
      if (pinned.tab) {
        await chrome.tabs.update(pinned.tab.id, { active: true });
        if (pinned.tab.windowId != null) {
          await chrome.windows.update(pinned.tab.windowId, { focused: true });
        }
        sendResponse({ ok: true, focused: true, pinned: true });
        return;
      }
      const tabs = await queryFallbackGameTabs();
      if (tabs[0]) {
        await chrome.tabs.update(tabs[0].id, { active: true });
        if (tabs[0].windowId != null) {
          await chrome.windows.update(tabs[0].windowId, { focused: true });
        }
        sendResponse({ ok: true, focused: true });
        return;
      }
      await chrome.tabs.create({ url });
      sendResponse({ ok: true, created: true });
    })().catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }

  if (msg.type === 'gnaa-toggle-camera-dock') {
    setCameraDock(msg.action || 'toggle')
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }

  if (msg.type === 'gnaa-camera-dock-closed') {
    chrome.storage.session
      .set({ [SESSION_KEYS.cameraDockOpen]: false })
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }

  if (msg.type === 'gnaa-content-ready') {
    sendResponse({ ok: true });
    return true;
  }
});

ensureDefaults().then(async () => {
  const s = await loadSettings();
  bridgeUrl = s.bridgeUrl;
  updateBadge();
  connectBridge();
});
