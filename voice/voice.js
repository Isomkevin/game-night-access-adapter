/**
 * Web Speech → bridge input events.
 * Bunny: replace / wrap with AI-for-Accessibility Toolkit Controller
 * (see docs/toolkit-contribution/).
 */

const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
const btn = document.getElementById('listen');

const proto = location.protocol === 'https:' ? 'wss' : 'ws';
// Prefer same host as the bridge page; fall back if opened as a static file.
const wsUrl =
  location.port && location.protocol.startsWith('http')
    ? `${proto}://${location.host}`
    : `${proto}://127.0.0.1:18765`;

/** @type {WebSocket|null} */
let socket = null;

const PHRASES = [
  { re: /\b(turn left|left)\b/i, action: 'turnLeft' },
  { re: /\b(turn right|right)\b/i, action: 'turnRight' },
  { re: /\b(go|accelerate|throttle)\b/i, action: 'go' },
  { re: /\b(stop|brake)\b/i, action: 'stop' },
  { re: /\bboost\b/i, action: 'boost' },
  { re: /\bpause\b/i, action: 'pause' },
];

function log(line) {
  logEl.textContent = `${line}\n${logEl.textContent}`.slice(0, 2000);
}

function send(msg) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(msg));
  }
}

function connect() {
  socket = new WebSocket(wsUrl);
  socket.addEventListener('open', () => {
    statusEl.textContent = 'Bridge connected';
    send({ type: 'hello', role: 'voice', v: 1, ts: Date.now() });
  });
  socket.addEventListener('close', () => {
    statusEl.textContent = 'Bridge disconnected — retrying…';
    setTimeout(connect, 2000);
  });
}

function emit(action) {
  send({
    type: 'input',
    source: 'voice',
    action,
    state: 'pulse',
    strength: 1,
    ts: Date.now(),
    v: 1,
  });
  log(`→ voice:${action}`);
}

function handleTranscript(text) {
  log(`heard: ${text}`);
  for (const p of PHRASES) {
    if (p.re.test(text)) {
      emit(p.action);
      return;
    }
  }
}

function startListening() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    statusEl.textContent = 'Web Speech API not available in this browser';
    return;
  }
  const rec = new SR();
  rec.continuous = true;
  rec.interimResults = false;
  rec.lang = 'en-US';
  rec.onresult = (ev) => {
    const result = ev.results[ev.results.length - 1];
    if (result && result[0]) handleTranscript(result[0].transcript.trim());
  };
  rec.onerror = (e) => {
    statusEl.textContent = `Speech error: ${e.error}`;
  };
  rec.onend = () => {
    statusEl.textContent = 'Recognition ended — click to restart';
  };
  rec.start();
  statusEl.textContent = 'Listening…';
}

btn.addEventListener('click', startListening);
connect();
