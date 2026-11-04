const statusEl = document.getElementById('status');
const steerBar = document.getElementById('steer-bar');
const steerLabel = document.getElementById('steer-label');

const proto = location.protocol === 'https:' ? 'wss' : 'ws';
const wsUrl = `${proto}://${location.host}`;

/** @type {WebSocket|null} */
let socket = null;
let lastSteer = 'none'; // left | right | none
const DEADZONE = 8; // degrees gamma

function send(msg) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(msg));
  }
}

function input(action, state, strength = 1) {
  send({
    type: 'input',
    source: 'phone',
    action,
    state,
    strength,
    ts: Date.now(),
    v: 1,
  });
}

function connect() {
  socket = new WebSocket(wsUrl);
  socket.addEventListener('open', () => {
    statusEl.textContent = 'Connected to bridge';
    send({ type: 'hello', role: 'phone', v: 1, ts: Date.now() });
  });
  socket.addEventListener('close', () => {
    statusEl.textContent = 'Disconnected — retrying…';
    setTimeout(connect, 2000);
  });
  socket.addEventListener('error', () => {
    try {
      socket.close();
    } catch {
      /* ignore */
    }
  });
}

function bindHold(el, action) {
  const down = (e) => {
    e.preventDefault();
    el.classList.add('active');
    input(action, 'down');
  };
  const up = (e) => {
    e.preventDefault();
    el.classList.remove('active');
    input(action, 'up');
  };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointerleave', up);
  el.addEventListener('pointercancel', up);
}

bindHold(document.getElementById('throttle'), 'throttle');
bindHold(document.getElementById('brake'), 'brake');
bindHold(document.getElementById('boost'), 'boost');

function onOrientation(event) {
  // gamma: left/right tilt while portrait (−90..90)
  const gamma = event.gamma ?? 0;
  const pct = Math.max(-45, Math.min(45, gamma));
  const leftPct = ((pct + 45) / 90) * 100;
  steerBar.style.left = `${leftPct}%`;
  steerLabel.textContent = `${Math.round(gamma)}°`;

  let next = 'none';
  if (gamma <= -DEADZONE) next = 'left';
  else if (gamma >= DEADZONE) next = 'right';

  if (next !== lastSteer) {
    if (lastSteer === 'left') input('tiltLeft', 'up');
    if (lastSteer === 'right') input('tiltRight', 'up');
    if (next === 'left') input('tiltLeft', 'down', Math.min(1, Math.abs(gamma) / 45));
    if (next === 'right') input('tiltRight', 'down', Math.min(1, Math.abs(gamma) / 45));
    lastSteer = next;
  }
}

async function enableMotion() {
  try {
    if (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function'
    ) {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res !== 'granted') {
        statusEl.textContent = 'Motion permission denied';
        return;
      }
    }
    window.addEventListener('deviceorientation', onOrientation);
    statusEl.textContent = 'Motion enabled';
  } catch (err) {
    statusEl.textContent = `Motion error: ${err.message || err}`;
  }
}

document.getElementById('enable').addEventListener('click', enableMotion);

connect();
// Android often allows orientation without a gesture
window.addEventListener('deviceorientation', onOrientation, { once: false });
