/**
 * Web Speech → bridge input events (experimental short taps).
 */

const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
const btn = document.getElementById('listen');
const stopBtn = document.getElementById('stop');

const proto = location.protocol === 'https:' ? 'wss' : 'ws';
const wsUrl =
  location.port && location.protocol.startsWith('http')
    ? `${proto}://${location.host}`
    : `${proto}://127.0.0.1:18765`;

/** @type {WebSocket|null} */
let socket = null;
/** @type {SpeechRecognition|null} */
let recognition = null;
let wantListening = false;

const PHRASES = [
  { re: /\b(turn left|left)\b/i, action: 'turnLeft', label: 'turn left' },
  { re: /\b(turn right|right)\b/i, action: 'turnRight', label: 'turn right' },
  { re: /\b(go|accelerate|throttle)\b/i, action: 'go', label: 'go' },
  { re: /\b(stop|brake)\b/i, action: 'stop', label: 'stop' },
  { re: /\bboost\b/i, action: 'boost', label: 'boost' },
  { re: /\bpause\b/i, action: 'pause', label: 'pause' },
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
    if (!wantListening) statusEl.textContent = 'Connected — press Start listening';
    send({ type: 'hello', role: 'voice', v: 1, ts: Date.now() });
  });
  socket.addEventListener('close', () => {
    statusEl.textContent = 'Connection lost — retrying…';
    setTimeout(connect, 2000);
  });
}

function emit(action, label) {
  send({
    type: 'input',
    source: 'voice',
    action,
    state: 'pulse',
    strength: 1,
    ts: Date.now(),
    v: 1,
  });
  log(`Heard “${label}” → short tap sent`);
}

function handleTranscript(text) {
  log(`Heard: ${text}`);
  for (const p of PHRASES) {
    if (p.re.test(text)) {
      emit(p.action, p.label);
      return;
    }
  }
}

function setListeningUi(on) {
  btn.disabled = on;
  stopBtn.disabled = !on;
  btn.textContent = on ? 'Listening…' : 'Start listening';
}

function stopListening() {
  wantListening = false;
  setListeningUi(false);
  if (recognition) {
    try {
      recognition.onend = null;
      recognition.stop();
    } catch {
      /* ignore */
    }
    recognition = null;
  }
  statusEl.textContent = 'Stopped listening';
}

function startListening() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    statusEl.textContent = 'Voice recognition is not available in this browser. Try Chrome.';
    return;
  }

  wantListening = true;
  const rec = new SR();
  recognition = rec;
  rec.continuous = true;
  rec.interimResults = false;
  rec.lang = 'en-US';

  rec.onresult = (ev) => {
    const result = ev.results[ev.results.length - 1];
    if (result && result[0]) handleTranscript(result[0].transcript.trim());
  };

  rec.onerror = (e) => {
    if (e.error === 'not-allowed') {
      statusEl.textContent = 'Microphone permission needed — allow access and try again.';
      stopListening();
      return;
    }
    if (e.error === 'aborted') return;
    statusEl.textContent = `Speech issue: ${e.error}. Listening will retry.`;
  };

  rec.onend = () => {
    if (!wantListening) return;
    statusEl.textContent = 'Still listening…';
    try {
      rec.start();
    } catch {
      setTimeout(() => {
        if (wantListening) startListening();
      }, 400);
    }
  };

  try {
    rec.start();
    setListeningUi(true);
    statusEl.textContent = 'Listening — say a command (each is a short tap)';
  } catch (err) {
    statusEl.textContent = `Could not start microphone: ${err.message || err}`;
    stopListening();
  }
}

btn.addEventListener('click', startListening);
stopBtn.addEventListener('click', stopListening);
connect();
