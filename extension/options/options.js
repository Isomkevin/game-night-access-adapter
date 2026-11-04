import {
  DEFAULT_REMAP,
  DEFAULT_BRIDGE_WS,
  LOGICAL_INPUTS,
} from '../lib/protocol.js';
import {
  GAME_ACTIONS,
  ACTION_LABELS,
  DEFAULT_KEY_CODES,
  keyCodeLabel,
} from '../lib/actions.js';

const STORAGE = {
  remap: 'remap',
  keyCodes: 'keyCodes',
  bridgeUrl: 'bridgeUrl',
};

async function load() {
  const data = await chrome.storage.local.get([
    STORAGE.remap,
    STORAGE.keyCodes,
    STORAGE.bridgeUrl,
  ]);
  return {
    remap: data[STORAGE.remap] || { ...DEFAULT_REMAP },
    keyCodes: data[STORAGE.keyCodes] || { ...DEFAULT_KEY_CODES },
    bridgeUrl: data[STORAGE.bridgeUrl] || DEFAULT_BRIDGE_WS,
  };
}

async function save(partial) {
  await chrome.storage.local.set(partial);
  const msg = document.getElementById('save-msg');
  msg.textContent = 'Saved';
  setTimeout(() => {
    msg.textContent = '';
  }, 1500);
}

function actionOptions(selected) {
  return GAME_ACTIONS.map(
    (id) =>
      `<option value="${id}" ${id === selected ? 'selected' : ''}>${ACTION_LABELS[id]}</option>`
  ).join('');
}

function uniqueCodes(preferred) {
  const codes = [...new Set([...Object.values(DEFAULT_KEY_CODES), preferred].filter(Boolean))];
  return codes;
}

function renderRemap(remap) {
  const root = document.getElementById('remap-table');
  root.innerHTML = '';
  for (const input of LOGICAL_INPUTS) {
    const current = remap[input.id] || DEFAULT_REMAP[input.id] || 'steerLeft';
    const row = document.createElement('div');
    row.className = 'row';
    row.setAttribute('role', 'row');

    const label = document.createElement('label');
    label.textContent = input.label;

    const sel = document.createElement('select');
    sel.innerHTML = actionOptions(current);
    sel.dataset.logical = input.id;
    label.htmlFor = '';
    sel.setAttribute('aria-label', input.label);

    sel.addEventListener('change', async () => {
      const state = await load();
      state.remap[sel.dataset.logical] = sel.value;
      await save({ [STORAGE.remap]: state.remap });
    });

    row.append(label, sel);
    root.append(row);
  }
}

function renderKeys(keyCodes) {
  const root = document.getElementById('keys-table');
  root.innerHTML = '';
  for (const id of GAME_ACTIONS) {
    const code = keyCodes[id] || DEFAULT_KEY_CODES[id];
    const row = document.createElement('div');
    row.className = 'row';

    const label = document.createElement('label');
    label.textContent = ACTION_LABELS[id];

    const sel = document.createElement('select');
    sel.dataset.action = id;
    sel.setAttribute('aria-label', `${ACTION_LABELS[id]} key code`);
    for (const c of uniqueCodes(code)) {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = `${keyCodeLabel(c)} (${c})`;
      if (c === code) opt.selected = true;
      sel.append(opt);
    }

    sel.addEventListener('change', async () => {
      const state = await load();
      state.keyCodes[sel.dataset.action] = sel.value;
      await save({ [STORAGE.keyCodes]: state.keyCodes });
    });

    row.append(label, sel);
    root.append(row);
  }
}

function renderBridge(bridgeUrl) {
  const input = document.getElementById('bridge-url');
  input.value = bridgeUrl || DEFAULT_BRIDGE_WS;
}

function normalizeBridgeUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) return DEFAULT_BRIDGE_WS;
  if (!/^wss?:\/\//i.test(value)) {
    throw new Error('Bridge URL must start with ws:// or wss://');
  }
  // Basic sanity — reject accidental http(s) paste leftovers
  new URL(value.replace(/^ws/i, 'http'));
  return value;
}

document.getElementById('save-bridge').addEventListener('click', async () => {
  const input = document.getElementById('bridge-url');
  const msg = document.getElementById('save-msg');
  try {
    const bridgeUrl = normalizeBridgeUrl(input.value);
    input.value = bridgeUrl;
    await save({ [STORAGE.bridgeUrl]: bridgeUrl });
    try {
      await chrome.runtime.sendMessage({ type: 'gnaa-reconnect' });
    } catch {
      /* service worker will pick up storage change */
    }
  } catch (err) {
    msg.textContent = err.message || 'Invalid bridge URL';
    setTimeout(() => {
      msg.textContent = '';
    }, 2500);
  }
});

document.getElementById('reset').addEventListener('click', async () => {
  await save({
    [STORAGE.remap]: { ...DEFAULT_REMAP },
    [STORAGE.keyCodes]: { ...DEFAULT_KEY_CODES },
    [STORAGE.bridgeUrl]: DEFAULT_BRIDGE_WS,
  });
  const state = await load();
  renderBridge(state.bridgeUrl);
  renderRemap(state.remap);
  renderKeys(state.keyCodes);
  try {
    await chrome.runtime.sendMessage({ type: 'gnaa-reconnect' });
  } catch {
    /* ignore */
  }
});

document.getElementById('export').addEventListener('click', async () => {
  const state = await load();
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'game-night-remap.json';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('import').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  const parsed = JSON.parse(text);
  await save({
    [STORAGE.remap]: parsed.remap || DEFAULT_REMAP,
    [STORAGE.keyCodes]: parsed.keyCodes || DEFAULT_KEY_CODES,
    [STORAGE.bridgeUrl]: parsed.bridgeUrl || DEFAULT_BRIDGE_WS,
  });
  const state = await load();
  renderBridge(state.bridgeUrl);
  renderRemap(state.remap);
  renderKeys(state.keyCodes);
  try {
    await chrome.runtime.sendMessage({ type: 'gnaa-reconnect' });
  } catch {
    /* ignore */
  }
});

const initial = await load();
renderBridge(initial.bridgeUrl);
renderRemap(initial.remap);
renderKeys(initial.keyCodes);
