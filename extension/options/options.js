import {
  DEFAULT_REMAP,
  DEFAULT_BRIDGE_WS,
  DEFAULT_BRIDGE_HTTP,
  LOGICAL_INPUTS,
} from '../lib/protocol.js';
import {
  GAME_ACTIONS,
  ACTION_LABELS,
  DEFAULT_KEY_CODES,
  keyCodeLabel,
} from '../lib/actions.js';
import {
  METHOD_META,
  SOURCE_GROUP_LABELS,
  describeConnection,
  describeGame,
  describeMethodReady,
  GAME_OPEN_URL,
} from '../lib/status.js';

const STORAGE = {
  remap: 'remap',
  keyCodes: 'keyCodes',
  bridgeUrl: 'bridgeUrl',
  onboardingComplete: 'onboardingComplete',
  preferredMethod: 'preferredMethod',
  presets: 'presets',
  activePreset: 'activePreset',
};

const METHOD_ICONS = {
  demo: '▣',
  phone: '📱',
  camera: '◎',
  voice: '♫',
  custom: '⇄',
};

const VIEWS = ['welcome', 'choose', 'setup', 'customize', 'ready', 'advanced'];

/** @type {string} */
let preferredMethod = 'demo';
/** @type {Record<string, { remap: object, keyCodes: object }>} */
let presets = {};
/** @type {string} */
let activePreset = '';

async function load() {
  const data = await chrome.storage.local.get([
    STORAGE.remap,
    STORAGE.keyCodes,
    STORAGE.bridgeUrl,
    STORAGE.onboardingComplete,
    STORAGE.preferredMethod,
    STORAGE.presets,
    STORAGE.activePreset,
  ]);
  preferredMethod = data[STORAGE.preferredMethod] || 'demo';
  presets = data[STORAGE.presets] || {};
  activePreset = data[STORAGE.activePreset] || '';
  return {
    remap: data[STORAGE.remap] || { ...DEFAULT_REMAP },
    keyCodes: data[STORAGE.keyCodes] || { ...DEFAULT_KEY_CODES },
    bridgeUrl: data[STORAGE.bridgeUrl] || DEFAULT_BRIDGE_WS,
    onboardingComplete: !!data[STORAGE.onboardingComplete],
  };
}

function showSave(message, isError = false) {
  const msg = document.getElementById('save-msg');
  msg.textContent = message;
  msg.classList.toggle('is-error', isError);
  if (!isError) {
    setTimeout(() => {
      if (msg.textContent === message) msg.textContent = '';
    }, 1800);
  }
}

async function save(partial) {
  await chrome.storage.local.set(partial);
  showSave('Saved');
}

function currentView() {
  const hash = (location.hash || '').replace(/^#/, '');
  return VIEWS.includes(hash) ? hash : '';
}

function showView(name) {
  const view = VIEWS.includes(name) ? name : 'welcome';
  for (const panel of document.querySelectorAll('[data-view-panel]')) {
    panel.hidden = panel.getAttribute('data-view-panel') !== view;
  }
  for (const btn of document.querySelectorAll('.nav-btn')) {
    const active = btn.dataset.view === view;
    btn.setAttribute('aria-current', active ? 'page' : 'false');
  }
  if (location.hash !== `#${view}`) {
    location.hash = view;
  }
  if (view === 'ready') refreshReady();
  if (view === 'advanced') refreshDiagnostics();
  if (view === 'setup') renderSetup();
  if (view === 'customize') {
    /* already rendered on load; refresh presets select */
    renderPresetSelect();
  }
  if (view === 'choose') renderMethodCards();
}

async function confirmDialog(title, body) {
  const dialog = document.getElementById('confirm-dialog');
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-body').textContent = body;
  dialog.showModal();
  return new Promise((resolve) => {
    const ok = document.getElementById('confirm-ok');
    const cancel = document.getElementById('confirm-cancel');
    const done = (value) => {
      ok.removeEventListener('click', onOk);
      cancel.removeEventListener('click', onCancel);
      dialog.removeEventListener('cancel', onCancel);
      dialog.close();
      resolve(value);
    };
    const onOk = () => done(true);
    const onCancel = () => done(false);
    ok.addEventListener('click', onOk);
    cancel.addEventListener('click', onCancel);
    dialog.addEventListener('cancel', onCancel);
  });
}

function actionOptions(selected) {
  const unmapped = `<option value="" ${!selected ? 'selected' : ''}>(not mapped)</option>`;
  const actions = GAME_ACTIONS.map(
    (id) =>
      `<option value="${id}" ${id === selected ? 'selected' : ''}>${ACTION_LABELS[id]}</option>`
  ).join('');
  return unmapped + actions;
}

function uniqueCodes(preferred) {
  return [...new Set([...Object.values(DEFAULT_KEY_CODES), preferred].filter(Boolean))];
}

function resolveCurrent(remap, logicalId) {
  if (remap && Object.prototype.hasOwnProperty.call(remap, logicalId)) {
    return remap[logicalId] || '';
  }
  return DEFAULT_REMAP[logicalId] || '';
}

async function testLogical(logicalId) {
  const state = await load();
  const gameAction = resolveCurrent(state.remap, logicalId);
  if (!gameAction) {
    showSave('This input is not mapped', true);
    return;
  }
  // Test via demo path using the mapped game action so injection works without the source device
  try {
    await chrome.runtime.sendMessage({
      type: 'gnaa-demo-input',
      action: gameAction,
      state: 'pulse',
    });
    showSave('Test pulse sent — focus the game while driving');
  } catch {
    showSave('Could not send test — reload the extension', true);
  }
}

function renderRemap(remap) {
  /** @type {any} */ (window).__gnaaRemap = remap;
  const root = document.getElementById('remap-table');
  root.innerHTML = '';

  /** @type {Record<string, typeof LOGICAL_INPUTS>} */
  const bySource = {};
  for (const input of LOGICAL_INPUTS) {
    const src = input.source || 'other';
    if (!bySource[src]) bySource[src] = [];
    bySource[src].push(input);
  }

  const order = ['demo', 'phone', 'camera', 'voice'];
  const sources = [
    ...order.filter((s) => bySource[s]),
    ...Object.keys(bySource).filter((s) => !order.includes(s)),
  ];

  for (const src of sources) {
    const section = document.createElement('section');
    section.className = 'remap-group';
    const h = document.createElement('h3');
    h.textContent = SOURCE_GROUP_LABELS[src] || src;
    section.append(h);

    if (src === 'camera') {
      const hint = document.createElement('p');
      hint.className = 'gnaa-hint';
      hint.textContent =
        'Enable and calibrate gestures on the vision page, then map them here.';
      section.append(hint);
    }
    if (src === 'voice') {
      const hint = document.createElement('p');
      hint.className = 'gnaa-hint';
      hint.textContent =
        'Voice sends a short tap for each phrase — not a continuous hold.';
      section.append(hint);
    }

    const table = document.createElement('div');
    table.className = 'table';
    table.setAttribute('role', 'table');
    table.setAttribute('aria-label', `${SOURCE_GROUP_LABELS[src] || src} mappings`);

    for (const input of bySource[src]) {
      const current = resolveCurrent(remap, input.id);
      const row = document.createElement('div');
      row.className = 'row';
      row.setAttribute('role', 'row');

      const labelId = `label-${input.id.replace(/[:]/g, '-')}`;
      const label = document.createElement('label');
      label.id = labelId;
      label.textContent = input.label.replace(/^(On-screen|Head|Face|Hand|Finger|Say|Phone) — /, (m) => m);
      // Prefer shorter label without redundant group prefix when grouped
      label.textContent = input.label
        .replace(/^On-screen — /, '')
        .replace(/^Head — /, '')
        .replace(/^Face — /, '')
        .replace(/^Hand — /, '')
        .replace(/^Finger — /, '')
        .replace(/^Say /, 'Say ')
        .replace(/^Phone — /, '');

      const sel = document.createElement('select');
      const selId = `sel-${input.id.replace(/[:]/g, '-')}`;
      sel.id = selId;
      label.htmlFor = selId;
      sel.innerHTML = actionOptions(current);
      sel.dataset.logical = input.id;
      sel.setAttribute('aria-labelledby', labelId);

      sel.addEventListener('change', async () => {
        const state = await load();
        state.remap[sel.dataset.logical] = sel.value;
        await save({ [STORAGE.remap]: state.remap });
        /** @type {any} */ (window).__gnaaRemap = state.remap;
      });

      const testBtn = document.createElement('button');
      testBtn.type = 'button';
      testBtn.className = 'gnaa-btn gnaa-btn--ghost test-btn';
      testBtn.textContent = 'Test';
      testBtn.setAttribute('aria-label', `Test ${label.textContent}`);
      testBtn.addEventListener('click', () => testLogical(input.id));

      const labelCell = document.createElement('div');
      labelCell.setAttribute('role', 'cell');
      labelCell.append(label);
      const selCell = document.createElement('div');
      selCell.setAttribute('role', 'cell');
      selCell.append(sel);
      const testCell = document.createElement('div');
      testCell.setAttribute('role', 'cell');
      testCell.append(testBtn);

      row.append(labelCell, selCell, testCell);
      table.append(row);
    }
    section.append(table);
    root.append(section);
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
    const selId = `key-${id}`;
    label.htmlFor = selId;
    label.textContent = ACTION_LABELS[id];

    const sel = document.createElement('select');
    sel.id = selId;
    sel.dataset.action = id;
    sel.setAttribute('aria-label', `${ACTION_LABELS[id]} key`);
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

    const spacer = document.createElement('div');
    row.append(label, sel, spacer);
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
    throw new Error('Connection address must start with ws:// or wss://');
  }
  new URL(value.replace(/^ws/i, 'http'));
  return value;
}

function renderMethodCards() {
  const grid = document.getElementById('method-grid');
  grid.innerHTML = '';
  const order = ['demo', 'phone', 'camera', 'voice', 'custom'];
  for (const id of order) {
    const meta = METHOD_META[id];
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'method-card';
    card.setAttribute('role', 'listitem');
    card.setAttribute('aria-pressed', preferredMethod === id ? 'true' : 'false');
    card.dataset.method = id;

    const readinessClass =
      meta.readiness === 'available'
        ? 'gnaa-chip--ok'
        : meta.readiness === 'experimental'
          ? 'gnaa-chip--warn'
          : 'gnaa-chip--info';

    card.innerHTML = `
      <span class="icon" aria-hidden="true">${METHOD_ICONS[id] || '•'}</span>
      <h3>${meta.title}</h3>
      <p>${meta.blurb}</p>
      <span class="needs"><strong>Needs:</strong> ${meta.needs}</span>
      <span class="gnaa-chip ${readinessClass}">${meta.readinessLabel}</span>
    `;

    card.addEventListener('click', async () => {
      preferredMethod = id;
      await chrome.storage.local.set({ [STORAGE.preferredMethod]: id });
      renderMethodCards();
      document.getElementById('btn-choose-continue').disabled = false;
    });

    grid.append(card);
  }
  document.getElementById('btn-choose-continue').disabled = !preferredMethod;
}

function httpFromBridge(wsUrl) {
  try {
    const u = new URL(String(wsUrl || DEFAULT_BRIDGE_WS).replace(/^ws/i, 'http'));
    return `${u.protocol}//${u.host}`;
  } catch {
    return DEFAULT_BRIDGE_HTTP;
  }
}

function renderSetup() {
  const method = preferredMethod || 'demo';
  const meta = METHOD_META[method] || METHOD_META.demo;
  document.getElementById('setup-title').textContent = `Set up: ${meta.title}`;
  document.getElementById('setup-lede').textContent = meta.blurb;

  const steps = document.getElementById('setup-steps');
  const actions = document.getElementById('setup-actions');
  steps.innerHTML = '';
  actions.innerHTML = '';

  const addStep = (text) => {
    const li = document.createElement('li');
    li.textContent = text;
    steps.append(li);
  };

  const stack = document.createElement('div');
  stack.className = 'action-stack';

  const addAction = (label, onClick, variant = '') => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `gnaa-btn ${variant}`.trim();
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    stack.append(btn);
  };

  if (method === 'demo') {
    addStep('Pin the Game Night extension in Chrome.');
    addStep('Open LibreCorsa and start a race (menus ignore these controls).');
    addStep('Click the race so the game can hear keys.');
    addStep('Open the extension popup and try Throttle, Left, and Right.');
    addStep('Optional: turn on Latch mode so you do not need to hold buttons.');
    addAction('Open game', () => chrome.runtime.sendMessage({ type: 'gnaa-open-game' }), 'gnaa-btn--amber');
    addAction('Test throttle pulse', async () => {
      await chrome.runtime.sendMessage({ type: 'gnaa-demo-input', action: 'throttle', state: 'pulse' });
      showSave('Throttle pulse sent');
    });
  } else if (method === 'phone') {
    addStep('Start the access bridge on this computer (if it is not already running).');
    addStep('Connect your phone to the same Wi‑Fi network as this computer.');
    addStep('On your phone, open the phone controller page from the bridge hub.');
    addStep('Tap Enable motion sensors if your phone asks.');
    addStep('Open the game, start driving, and test tilt + large buttons.');
    addAction(
      'Open bridge hub',
      async () => {
        const state = await load();
        const base = httpFromBridge(state.bridgeUrl);
        window.open(`${base}/`, '_blank', 'noopener');
      },
      'gnaa-btn--amber'
    );
    addAction('Open phone page', async () => {
      const state = await load();
      const base = httpFromBridge(state.bridgeUrl);
      window.open(`${base}/phone/`, '_blank', 'noopener');
    });
    addAction('Reconnect access inputs', () =>
      chrome.runtime.sendMessage({ type: 'gnaa-reconnect' })
    );
  } else if (method === 'camera') {
    addStep('Start the access bridge on this computer.');
    addStep('Open the vision controller and allow camera access.');
    addStep('Sit comfortably and run calibration in a neutral pose.');
    addStep('Test left and right movement, then adjust sensitivity if needed.');
    addStep('This method is experimental — use Pause control if something goes wrong.');
    addAction(
      'Open vision controller',
      async () => {
        const state = await load();
        const base = httpFromBridge(state.bridgeUrl);
        window.open(`${base}/camera/`, '_blank', 'noopener');
      },
      'gnaa-btn--amber'
    );
    addAction('Reconnect access inputs', () =>
      chrome.runtime.sendMessage({ type: 'gnaa-reconnect' })
    );
  } else if (method === 'voice') {
    addStep('Start the access bridge on this computer.');
    addStep('Open the voice page and allow microphone access.');
    addStep('Click Start listening, then try saying “go” or “boost”.');
    addStep('Remember: each phrase is a short tap, not a continuous hold.');
    addStep('This method is experimental.');
    addAction(
      'Open voice commands',
      async () => {
        const state = await load();
        const base = httpFromBridge(state.bridgeUrl);
        window.open(`${base}/voice/`, '_blank', 'noopener');
      },
      'gnaa-btn--amber'
    );
  } else {
    addStep('Open Customize to assign each input to a game action.');
    addStep('Use Test on a row while the game is focused and driving.');
    addStep('Save a preset if you want to switch layouts later.');
    addAction('Go to Customize', () => showView('customize'), 'gnaa-btn--amber');
  }

  actions.append(stack);
}

function renderPresetSelect() {
  const sel = document.getElementById('preset-select');
  sel.innerHTML = '';
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = presets && Object.keys(presets).length ? 'Select a preset…' : 'No saved presets yet';
  sel.append(empty);
  for (const name of Object.keys(presets).sort()) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    if (name === activePreset) opt.selected = true;
    sel.append(opt);
  }
}

async function refreshReady() {
  const list = document.getElementById('ready-checklist');
  list.innerHTML = '';

  let status = {
    bridgeStatus: 'disconnected',
    gameTabOpen: false,
    workerOk: true,
  };
  try {
    status = await chrome.runtime.sendMessage({ type: 'gnaa-get-status' });
  } catch {
    status.workerOk = false;
  }

  const items = [
    describeGame(status),
    describeConnection(status),
    describeMethodReady(preferredMethod, status),
    {
      tone: 'ok',
      title: 'Controls configured',
      detail: 'Your mappings are saved on this device. Open Customize anytime to change them.',
    },
  ];

  for (const item of items) {
    const li = document.createElement('li');
    const chip = document.createElement('span');
    chip.className = `gnaa-chip gnaa-chip--${item.tone}`;
    chip.textContent =
      item.tone === 'ok' ? 'Ready' : item.tone === 'danger' ? 'Action needed' : 'Check this';
    const body = document.createElement('div');
    body.className = 'check-body';
    body.innerHTML = `<strong>${item.title}</strong><span>${item.detail}</span>`;
    li.append(chip, body);
    list.append(li);
  }
}

async function refreshDiagnostics() {
  const el = document.getElementById('diag-status');
  try {
    const s = await chrome.runtime.sendMessage({ type: 'gnaa-get-status' });
    el.textContent = `Status: ${s.bridgeStatus}; game tabs: ${s.gameTabCount || 0}; address: ${s.bridgeUrl}`;
  } catch {
    el.textContent = 'Extension stopped — reload it from chrome://extensions.';
  }
}

// --- Event wiring ---

document.getElementById('btn-get-started').addEventListener('click', () => showView('choose'));
document.getElementById('btn-choose-continue').addEventListener('click', () => {
  if (preferredMethod === 'custom') showView('customize');
  else showView('setup');
});

document.querySelectorAll('[data-goto]').forEach((el) => {
  el.addEventListener('click', () => showView(el.getAttribute('data-goto')));
});

document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => showView(btn.dataset.view));
});

document.getElementById('btn-open-game').addEventListener('click', async () => {
  try {
    await chrome.runtime.sendMessage({ type: 'gnaa-open-game', url: GAME_OPEN_URL });
  } catch {
    window.open(GAME_OPEN_URL, '_blank', 'noopener');
  }
  setTimeout(refreshReady, 500);
});

document.getElementById('btn-finish-onboarding').addEventListener('click', async () => {
  await chrome.storage.local.set({ [STORAGE.onboardingComplete]: true });
  showSave('Setup marked complete');
  showView('ready');
});

document.getElementById('save-bridge').addEventListener('click', async () => {
  const input = document.getElementById('bridge-url');
  try {
    const bridgeUrl = normalizeBridgeUrl(input.value);
    input.value = bridgeUrl;
    await save({ [STORAGE.bridgeUrl]: bridgeUrl });
    try {
      await chrome.runtime.sendMessage({ type: 'gnaa-reconnect' });
    } catch {
      /* storage change still applies */
    }
    refreshDiagnostics();
  } catch (err) {
    showSave(err.message || 'Invalid connection address', true);
  }
});

document.getElementById('reset').addEventListener('click', async () => {
  const ok = await confirmDialog(
    'Reset all controls?',
    'This restores default mappings, key codes, and the connection address. Saved presets are kept.'
  );
  if (!ok) return;
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
  const payload = {
    remap: state.remap,
    keyCodes: state.keyCodes,
    bridgeUrl: state.bridgeUrl,
    preferredMethod,
    presets,
    activePreset,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'game-night-settings.json';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('import').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      showSave('Could not read that file — use a Game Night settings JSON export.', true);
      return;
    }
    if (!parsed || typeof parsed !== 'object') {
      showSave('That file does not look like Game Night settings.', true);
      return;
    }
    const remap = parsed.remap && typeof parsed.remap === 'object' ? parsed.remap : DEFAULT_REMAP;
    const keyCodes =
      parsed.keyCodes && typeof parsed.keyCodes === 'object' ? parsed.keyCodes : DEFAULT_KEY_CODES;
    const bridgeUrl = parsed.bridgeUrl || DEFAULT_BRIDGE_WS;
    const patch = {
      [STORAGE.remap]: remap,
      [STORAGE.keyCodes]: keyCodes,
      [STORAGE.bridgeUrl]: bridgeUrl,
    };
    if (parsed.presets && typeof parsed.presets === 'object') {
      presets = parsed.presets;
      patch[STORAGE.presets] = presets;
    }
    if (typeof parsed.preferredMethod === 'string') {
      preferredMethod = parsed.preferredMethod;
      patch[STORAGE.preferredMethod] = preferredMethod;
    }
    if (typeof parsed.activePreset === 'string') {
      activePreset = parsed.activePreset;
      patch[STORAGE.activePreset] = activePreset;
    }
    await save(patch);
    const state = await load();
    renderBridge(state.bridgeUrl);
    renderRemap(state.remap);
    renderKeys(state.keyCodes);
    renderPresetSelect();
    try {
      await chrome.runtime.sendMessage({ type: 'gnaa-reconnect' });
    } catch {
      /* ignore */
    }
  } finally {
    e.target.value = '';
  }
});

document.getElementById('preset-save').addEventListener('click', async () => {
  const name = window.prompt('Name this preset');
  if (!name || !name.trim()) return;
  const key = name.trim();
  const state = await load();
  presets = { ...presets, [key]: { remap: state.remap, keyCodes: state.keyCodes } };
  activePreset = key;
  await chrome.storage.local.set({
    [STORAGE.presets]: presets,
    [STORAGE.activePreset]: activePreset,
  });
  renderPresetSelect();
  showSave(`Preset “${key}” saved`);
});

document.getElementById('preset-load').addEventListener('click', async () => {
  const name = document.getElementById('preset-select').value;
  if (!name || !presets[name]) {
    showSave('Choose a preset to load', true);
    return;
  }
  const p = presets[name];
  await save({
    [STORAGE.remap]: p.remap || { ...DEFAULT_REMAP },
    [STORAGE.keyCodes]: p.keyCodes || { ...DEFAULT_KEY_CODES },
    [STORAGE.activePreset]: name,
  });
  activePreset = name;
  const state = await load();
  renderRemap(state.remap);
  renderKeys(state.keyCodes);
  renderPresetSelect();
});

document.getElementById('preset-delete').addEventListener('click', async () => {
  const name = document.getElementById('preset-select').value;
  if (!name || !presets[name]) {
    showSave('Choose a preset to delete', true);
    return;
  }
  const ok = await confirmDialog('Delete preset?', `Remove “${name}” from this device?`);
  if (!ok) return;
  const next = { ...presets };
  delete next[name];
  presets = next;
  if (activePreset === name) activePreset = '';
  await chrome.storage.local.set({
    [STORAGE.presets]: presets,
    [STORAGE.activePreset]: activePreset,
  });
  renderPresetSelect();
  showSave('Preset deleted');
});

window.addEventListener('hashchange', () => {
  const v = currentView();
  if (v) showView(v);
});

const initial = await load();
renderBridge(initial.bridgeUrl);
renderRemap(initial.remap);
renderKeys(initial.keyCodes);
renderMethodCards();
renderPresetSelect();

const start = currentView() || (initial.onboardingComplete ? 'ready' : 'welcome');
showView(start);
