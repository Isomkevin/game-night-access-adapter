const statusEl = document.getElementById('status');
const steerBar = document.getElementById('steer-bar');
const steerLabel = document.getElementById('steer-label');
const modeHint = document.getElementById('mode-hint');

const proto = location.protocol === 'https:' ? 'wss' : 'ws';
const wsUrl = `${proto}://${location.host}`;

/** @type {WebSocket|null} */
let socket = null;
let lastSteer = 'none'; // left | right | none
const DEADZONE = 8; // degrees gamma

/** @type {'hold'|'latch'} */
let buttonMode = 'hold';
/** @type {Set<string>} */
const latched = new Set();

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

function setStatus(text, ok) {
  statusEl.textContent = text;
  statusEl.dataset.ok = ok ? '1' : '0';
}

function connect() {
  socket = new WebSocket(wsUrl);
  socket.addEventListener('open', () => {
    setStatus('Connected — ready to play', true);
    send({ type: 'hello', role: 'phone', v: 1, ts: Date.now() });
  });
  socket.addEventListener('close', () => {
    releaseSteering();
    releaseAllButtons();
    setStatus('Connection lost — retrying…', false);
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

function setMode(mode) {
  buttonMode = mode;
  document.getElementById('mode-hold').setAttribute('aria-pressed', mode === 'hold' ? 'true' : 'false');
  document.getElementById('mode-latch').setAttribute('aria-pressed', mode === 'latch' ? 'true' : 'false');
  modeHint.textContent =
    mode === 'latch'
      ? 'Latch mode: tap once to press, tap again to release.'
      : 'Hold mode: press and hold a button.';
}

function bindButton(el, action) {
  const activate = () => {
    el.classList.add('active');
    el.setAttribute('aria-pressed', 'true');
    input(action, 'down');
  };
  const deactivate = () => {
    el.classList.remove('active');
    el.setAttribute('aria-pressed', 'false');
    input(action, 'up');
  };

  el.addEventListener('pointerdown', (e) => {
    if (buttonMode === 'latch') return;
    e.preventDefault();
    activate();
  });
  el.addEventListener('pointerup', (e) => {
    if (buttonMode === 'latch') return;
    e.preventDefault();
    deactivate();
  });
  el.addEventListener('pointerleave', (e) => {
    if (buttonMode === 'latch') return;
    e.preventDefault();
    deactivate();
  });
  el.addEventListener('pointercancel', (e) => {
    if (buttonMode === 'latch') return;
    e.preventDefault();
    deactivate();
  });

  el.addEventListener('click', (e) => {
    if (buttonMode !== 'latch') return;
    e.preventDefault();
    if (latched.has(action)) {
      latched.delete(action);
      deactivate();
    } else {
      latched.add(action);
      activate();
    }
  });
}

function releaseAllButtons() {
  for (const action of [...latched]) {
    latched.delete(action);
    const el = document.getElementById(action);
    if (el) {
      el.classList.remove('active');
      el.setAttribute('aria-pressed', 'false');
    }
    input(action, 'up');
  }
  // Also release any hold that may still be down visually
  for (const id of ['throttle', 'brake', 'boost']) {
    const el = document.getElementById(id);
    if (el?.classList.contains('active') && !latched.has(id)) {
      el.classList.remove('active');
      el.setAttribute('aria-pressed', 'false');
      input(id, 'up');
    }
  }
}

function releaseSteering() {
  if (lastSteer === 'left') input('tiltLeft', 'up');
  if (lastSteer === 'right') input('tiltRight', 'up');
  lastSteer = 'none';
}

bindButton(document.getElementById('throttle'), 'throttle');
bindButton(document.getElementById('brake'), 'brake');
bindButton(document.getElementById('boost'), 'boost');

document.getElementById('mode-hold').addEventListener('click', () => {
  releaseAllButtons();
  setMode('hold');
});
document.getElementById('mode-latch').addEventListener('click', () => setMode('latch'));
document.getElementById('release-all').addEventListener('click', () => {
  releaseAllButtons();
  releaseSteering();
  setStatus('All inputs released', true);
});

function onOrientation(event) {
  const gamma = event.gamma ?? 0;
  const pct = Math.max(-45, Math.min(45, gamma));
  const leftPct = ((pct + 45) / 90) * 100;
  steerBar.style.left = `${leftPct}%`;

  if (Math.abs(gamma) < DEADZONE) {
    steerLabel.textContent = 'Centered';
  } else if (gamma < 0) {
    steerLabel.textContent = 'Steering left';
  } else {
    steerLabel.textContent = 'Steering right';
  }

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
        setStatus('Motion permission needed — tap Enable motion sensors', false);
        return;
      }
    }
    window.addEventListener('deviceorientation', onOrientation);
    setStatus('Motion enabled — tilt to steer', true);
  } catch (err) {
    setStatus(`Motion permission needed: ${err.message || err}`, false);
  }
}

document.getElementById('enable').addEventListener('click', enableMotion);

window.addEventListener('pagehide', () => {
  releaseAllButtons();
  releaseSteering();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    releaseAllButtons();
    releaseSteering();
  }
});

setMode('hold');
connect();
// Android often allows orientation without a gesture
window.addEventListener('deviceorientation', onOrientation, { once: false });
