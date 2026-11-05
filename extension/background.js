/**
 * Service worker: bridge WebSocket client + remap + fan-out to LibreCorsa tabs.
 */

import {
  DEFAULT_BRIDGE_WS,
  DEFAULT_REMAP,
  isInputEvent,
  createHello,
  resolveRemap,
} from './lib/protocol.js';
import { DEFAULT_KEY_CODES, HOLD_ACTIONS } from './lib/actions.js';
import { CameraKeys } from './lib/camera-keys.js';

const STORAGE_KEYS = {
  remap: 'remap',
  keyCodes: 'keyCodes',
  bridgeUrl: 'bridgeUrl',
};

/** @type {WebSocket|null} */
let socket = null;
let reconnectTimer = null;
let bridgeUrl = DEFAULT_BRIDGE_WS;
let bridgeStatus = 'disconnected';
let bridgeGeneration = 0;
const cameraKeys = new CameraKeys(sendToGameTabs);

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
  if (bridgeStatus === 'connected') setBadge('ON', '#0a7');
  else if (bridgeStatus === 'connecting') setBadge('…', '#a70');
  else setBadge('demo', '#555');
}

async function sendToGameTabs(code, state) {
  const tabs = await chrome.tabs.query({
    url: [
      'http://localhost:3000/*',
      'http://127.0.0.1:3000/*',
      'https://khazp.github.io/librecorsa/*',
    ],
  });
  await Promise.all(
    tabs.map((tab) =>
      chrome.tabs
        .sendMessage(tab.id, { type: 'gnaa-apply', code, state })
        .catch(() => {})
    )
  );
}

/**
 * Apply a logical input event through remap → key code → game tab.
 * @param {{ source: string, action: string, state: string }} evt
 */
async function handleInputEvent(evt) {
  const generation = bridgeGeneration;
  const settings = await loadSettings();
  if (evt.source === 'camera' && (generation !== bridgeGeneration || bridgeStatus !== 'connected')) return;
  const logicalId = `${evt.source}:${evt.action}`;
  let gameAction = resolveRemap(settings.remap, logicalId);

  // Allow already-resolved game action ids (e.g. demo sending steerLeft)
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
    // still fine — content script handles pulse
  }
  await sendToGameTabs(code, state);
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
      handleInputEvent(msg);
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
    sendResponse({ bridgeStatus, bridgeUrl });
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
