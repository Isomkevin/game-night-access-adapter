/**
 * AI-for-Accessibility Toolkit VoiceCommands → bridge input events.
 * Supported path: works with an unmodified LibreCorsa tab via bridge + extension.
 * Phrases for each action are chosen in Voice settings.
 */
import { VoiceCommands } from '/toolkit/tools/adapters/voice-commands.js';
import { applySettings, loadSettings } from './command-settings.js';
import { mountVoiceSettings } from './settings-panel.js';

const SETTINGS_ID = 'bridge';
const DEFAULT_LANGUAGE = 'en-US';
const STEER_PULSE_MS = 300;

const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
const btn = document.getElementById('listen');
const settingsBtn = document.getElementById('settings');
const phrasesEl = document.getElementById('phrases');

const proto = location.protocol === 'https:' ? 'wss' : 'ws';
const wsUrl =
  location.port && location.protocol.startsWith('http')
    ? `${proto}://${location.host}`
    : `${proto}://127.0.0.1:18765`;

/** @type {WebSocket|null} */
let socket = null;
const held = new Set();

function log(line) {
  logEl.textContent = `${line}\n${logEl.textContent}`.slice(0, 2000);
}

function send(action, state) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(
    JSON.stringify({ type: 'input', source: 'voice', action, state, strength: 1, ts: Date.now(), v: 1 })
  );
  log(`→ voice:${action} ${state}`);
}

function hold(action) {
  if (held.has(action)) return;
  held.add(action);
  send(action, 'down');
}

function release(action) {
  if (!held.delete(action)) return;
  send(action, 'up');
}

function releaseAll() {
  for (const action of [...held]) release(action);
}

function steer(action) {
  send(action, 'down');
  setTimeout(() => send(action, 'up'), STEER_PULSE_MS);
}

const ACTIONS = {
  go: {
    group: 'Driving',
    label: 'Accelerate (held until brake or coast)',
    phrases: ['go', 'drive', 'accelerate', 'throttle'],
    run: () => {
      release('stop');
      hold('go');
    },
  },
  stop: {
    group: 'Driving',
    label: 'Brake (held until accelerate or coast)',
    phrases: ['stop', 'brake'],
    run: () => {
      release('go');
      hold('stop');
    },
  },
  coast: {
    group: 'Driving',
    label: 'Coast (release throttle and brake)',
    phrases: ['coast', 'free', 'easy'],
    run: () => {
      release('go');
      release('stop');
    },
  },
  turnLeft: {
    group: 'Driving',
    label: 'Steer left (0.3 s)',
    phrases: ['left', 'turn left'],
    run: () => steer('turnLeft'),
  },
  turnRight: {
    group: 'Driving',
    label: 'Steer right (0.3 s)',
    phrases: ['right', 'turn right'],
    run: () => steer('turnRight'),
  },
  gearUp: {
    group: 'Driving',
    label: 'Gear up',
    phrases: ['gear up'],
    run: () => send('gearUp', 'pulse'),
  },
  gearDown: {
    group: 'Driving',
    label: 'Gear down',
    phrases: ['gear down'],
    run: () => send('gearDown', 'pulse'),
  },
  boost: {
    group: 'Driving',
    label: 'Boost',
    phrases: ['boost'],
    run: () => send('boost', 'pulse'),
  },
  aero: {
    group: 'Driving',
    label: 'Active aero / DRS',
    phrases: ['wing', 'aero'],
    run: () => send('aero', 'pulse'),
  },
  restart: {
    group: 'Driving',
    label: 'Restart race',
    phrases: ['restart', 'again'],
    run: () => {
      releaseAll();
      send('restart', 'pulse');
    },
  },
  pause: {
    group: 'Driving',
    label: 'Pause (releases everything)',
    phrases: ['pause'],
    run: () => {
      releaseAll();
      send('pause', 'pulse');
    },
  },
};

// The toolkit ships page commands ("go back", "go forward", "refresh",
// "scroll down", …). On this page "go forward" would press the browser's
// Forward button instead of accelerating, and "go back" navigates away and
// stops voice mid-race, so only the driving phrases stay registered.
for (const phrase of Object.keys(VoiceCommands.commands)) delete VoiceCommands.commands[phrase];

let settings = loadSettings(SETTINGS_ID, ACTIONS, DEFAULT_LANGUAGE);

function renderPhrases() {
  const items = Object.entries(ACTIONS).map(([id, action]) => {
    const list = settings.phrases[id] || [];
    const said = list.length ? list.map((p) => `“${p}”`).join(' / ') : '(off)';
    return Object.assign(document.createElement('li'), {
      textContent: `${said} — ${action.label}`,
    });
  });
  items.push(
    Object.assign(document.createElement('li'), {
      textContent: '“stop listening” — turn voice off',
    })
  );
  phrasesEl.replaceChildren(...items);
}

applySettings(VoiceCommands, settings, ACTIONS);
renderPhrases();

const toolkitDisable = VoiceCommands.disable.bind(VoiceCommands);
VoiceCommands.disable = () => {
  releaseAll();
  toolkitDisable();
  btn.textContent = 'Start listening';
  statusEl.textContent = 'Stopped';
};

function startListening() {
  VoiceCommands.enable({ interimResults: false, language: settings.language });
  if (VoiceCommands.enabled) {
    btn.textContent = 'Stop listening';
    statusEl.textContent = 'Listening…';
  }
}

let wasListening = false;
const panel = mountVoiceSettings({
  id: SETTINGS_ID,
  actions: ACTIONS,
  defaultLanguage: DEFAULT_LANGUAGE,
  getSettings: () => settings,
  onSave: (next) => {
    settings = next;
    applySettings(VoiceCommands, settings, ACTIONS);
    renderPhrases();
  },
  pause: () => {
    wasListening = VoiceCommands.enabled;
    if (wasListening) VoiceCommands.disable();
  },
  resume: () => {
    if (wasListening) startListening();
  },
});

function connect() {
  socket = new WebSocket(wsUrl);
  socket.addEventListener('open', () => {
    statusEl.textContent = 'Bridge connected — press Start listening';
    socket.send(JSON.stringify({ type: 'hello', role: 'voice', v: 1, ts: Date.now() }));
  });
  socket.addEventListener('close', () => {
    held.clear();
    statusEl.textContent = 'Bridge disconnected — retrying…';
    setTimeout(connect, 2000);
  });
}

btn.addEventListener('click', () => {
  if (VoiceCommands.enabled) {
    VoiceCommands.disable();
    return;
  }
  startListening();
});

settingsBtn.addEventListener('click', () => panel.open());

window.addEventListener('pagehide', releaseAll);
connect();
