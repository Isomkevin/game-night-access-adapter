/**
 * AI-for-Accessibility Toolkit VoiceCommands → bridge input events.
 * Uses the toolkit adapter as-is and registers driving phrases with addCommand().
 */
import { VoiceCommands } from '/toolkit/tools/adapters/voice-commands.js';

const STEER_PULSE_MS = 300;

const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
const btn = document.getElementById('listen');

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

const DRIVING_COMMANDS = {
  accelerate: () => { release('stop'); hold('go'); },
  brake: () => { release('go'); hold('stop'); },
  coast: () => { release('go'); release('stop'); },
  left: () => steer('turnLeft'),
  right: () => steer('turnRight'),
  'gear up': () => send('gearUp', 'pulse'),
  'gear down': () => send('gearDown', 'pulse'),
  boost: () => send('boost', 'pulse'),
  pause: () => { releaseAll(); send('pause', 'pulse'); },
};

for (const [phrase, action] of Object.entries(DRIVING_COMMANDS)) VoiceCommands.addCommand(phrase, action);

const toolkitDisable = VoiceCommands.disable.bind(VoiceCommands);
VoiceCommands.disable = () => {
  releaseAll();
  toolkitDisable();
  btn.textContent = 'Start listening';
  statusEl.textContent = 'Stopped';
};

function connect() {
  socket = new WebSocket(wsUrl);
  socket.addEventListener('open', () => {
    statusEl.textContent = 'Bridge connected';
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
  VoiceCommands.enable({ interimResults: false });
  if (VoiceCommands.enabled) {
    btn.textContent = 'Stop listening';
    statusEl.textContent = 'Listening (toolkit)…';
  }
});

window.addEventListener('pagehide', releaseAll);
connect();
