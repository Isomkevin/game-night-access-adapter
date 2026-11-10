import {
  describeConnection,
  describeGame,
  describePinnedTab,
  GAME_OPEN_URL,
} from '../lib/status.js';

/** @type {'hold'|'latch'} */
let buttonMode = 'hold';
/** @type {Set<string>} */
const latched = new Set();

function sendDemo(action, state) {
  return chrome.runtime.sendMessage({
    type: 'gnaa-demo-input',
    action,
    state,
  });
}

function setMode(mode) {
  buttonMode = mode;
  document.getElementById('mode-hold').setAttribute('aria-pressed', mode === 'hold' ? 'true' : 'false');
  document.getElementById('mode-latch').setAttribute('aria-pressed', mode === 'latch' ? 'true' : 'false');
  document.getElementById('pad-hint').textContent =
    mode === 'latch'
      ? 'Latch mode: tap once to press, tap again to release. Game must be focused.'
      : 'Hold mode: press and hold while the game is focused.';
}

async function releaseAllLatched() {
  for (const action of [...latched]) {
    latched.delete(action);
    const btn = document.querySelector(`button.hold[data-action="${action}"]`);
    if (btn) {
      btn.classList.remove('active');
      btn.setAttribute('aria-pressed', 'false');
    }
    await sendDemo(action, 'up');
  }
  try {
    await chrome.runtime.sendMessage({ type: 'gnaa-release-all' });
  } catch {
    /* ignore */
  }
}

function bindHold(btn) {
  const action = btn.dataset.action;

  const activate = () => {
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
    sendDemo(action, 'down');
  };
  const deactivate = () => {
    btn.classList.remove('active');
    btn.setAttribute('aria-pressed', 'false');
    sendDemo(action, 'up');
  };

  btn.addEventListener('pointerdown', (e) => {
    if (buttonMode === 'latch') return;
    e.preventDefault();
    activate();
  });
  btn.addEventListener('pointerup', (e) => {
    if (buttonMode === 'latch') return;
    e.preventDefault();
    deactivate();
  });
  btn.addEventListener('pointerleave', (e) => {
    if (buttonMode === 'latch') return;
    e.preventDefault();
    deactivate();
  });
  btn.addEventListener('pointercancel', (e) => {
    if (buttonMode === 'latch') return;
    e.preventDefault();
    deactivate();
  });

  btn.addEventListener('click', (e) => {
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

  // Keyboard: Space/Enter hold or latch
  btn.addEventListener('keydown', (e) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    if (buttonMode === 'latch') {
      btn.click();
      return;
    }
    if (e.repeat) return;
    activate();
  });
  btn.addEventListener('keyup', (e) => {
    if (buttonMode === 'latch') return;
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    deactivate();
  });
}

function bindPulse(btn) {
  btn.addEventListener('click', () => {
    sendDemo(btn.dataset.action, 'pulse');
  });
}

/** Keep the result of a button press readable instead of letting the status poll replace it. */
let hintHeldUntil = 0;

function showHint(text) {
  document.getElementById('pin-hint').textContent = text;
  hintHeldUntil = Date.now() + 8000;
}

function updatePinHint(s) {
  const hint = document.getElementById('pin-hint');
  const btn = document.getElementById('camera-overlay');
  const pin = describePinnedTab(s);
  if (btn) {
    btn.textContent = s?.cameraDockOpen ? 'Hide camera overlay' : 'Camera overlay';
  }
  const voiceBtn = document.getElementById('voice-toggle');
  voiceBtn.textContent = s?.voiceOn ? 'Stop voice control' : 'Voice control';
  voiceBtn.setAttribute('aria-pressed', s?.voiceOn ? 'true' : 'false');
  if (Date.now() < hintHeldUntil) return;
  if (s?.adapterConnected) {
    hint.textContent = s?.voiceOn
      ? 'Adapter keys → focused game. Voice is listening.'
      : 'Adapter keys → focused game. Click into your game, then use the pad or Voice control.';
    return;
  }
  if (s?.targetTabId && pin) {
    hint.textContent = s?.cameraDockOpen
      ? `Browser keys go to ${pin}. Camera preview is on that tab.`
      : `Browser keys go to ${pin}. Start the desktop adapter for any game.`;
    return;
  }
  if (s?.gameTabOpen) {
    hint.textContent = 'Browser fallback: LibreCorsa tab. Start the desktop adapter to play any game.';
    return;
  }
  hint.textContent = 'Start the desktop adapter (0.2.7+) for any game, or pin a browser tab.';
}

async function refreshStatus() {
  const el = document.getElementById('status');
  const detail = document.getElementById('status-detail');
  try {
    const s = await chrome.runtime.sendMessage({ type: 'gnaa-get-status' });
    const conn = describeConnection(s);
    const game = describeGame(s);
    // Prefer the more urgent signal in the title
    const primary =
      s.workerOk === false ? conn : !s.gameTabOpen ? game : conn;
    if (s.adapterConnected && s.workerOk !== false) {
      el.textContent = 'Desktop adapter connected';
      el.className = 'status ok';
      detail.textContent = s.voiceOn
        ? 'Voice and on-screen buttons press the adapter’s keys in whatever game is focused.'
        : 'Pad, voice, and other inputs press the adapter’s keys in any focused game — not only LibreCorsa.';
    } else {
      el.textContent = primary.title;
      el.className = `status ${primary.tone}`;
      detail.textContent = `${game.title}. ${conn.detail}`;
    }
    updatePinHint(s);
  } catch {
    el.textContent = 'Extension stopped';
    el.className = 'status danger';
    detail.textContent = 'Open chrome://extensions and click Reload on Game Night Access Adapter.';
    document.getElementById('pin-hint').textContent = '';
  }
}

document.querySelectorAll('button.hold').forEach(bindHold);
document.querySelectorAll('button.pulse').forEach(bindPulse);

document.getElementById('mode-hold').addEventListener('click', async () => {
  await releaseAllLatched();
  setMode('hold');
});
document.getElementById('mode-latch').addEventListener('click', () => setMode('latch'));

document.getElementById('release-all').addEventListener('click', async () => {
  await releaseAllLatched();
});

document.getElementById('use-this-tab').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const res = await chrome.runtime.sendMessage({
      type: 'gnaa-use-this-tab',
      tabId: tab?.id,
    });
    if (!res?.ok) {
      showHint(res?.error || 'Could not pin this tab.');
      return;
    }
    showHint(`Pinned ${res.targetTabHost || res.targetTabTitle || 'tab'}.`);
  } catch (err) {
    showHint(String(err?.message || err || 'Could not pin this tab.'));
  }
  setTimeout(refreshStatus, 200);
});

document.getElementById('camera-overlay').addEventListener('click', async () => {
  try {
    const res = await chrome.runtime.sendMessage({
      type: 'gnaa-toggle-camera-dock',
      action: 'toggle',
    });
    if (!res?.ok) {
      showHint(res?.error || 'Could not toggle camera overlay.');
      return;
    }
    showHint(res.open
      ? 'Camera overlay on the game tab. Allow camera if asked, then expand for gestures.'
      : 'Camera overlay hidden.');
  } catch (err) {
    showHint(String(err?.message || err || 'Could not toggle camera overlay.'));
  }
  setTimeout(refreshStatus, 250);
});

document.getElementById('voice-toggle').addEventListener('click', async () => {
  try {
    const res = await chrome.runtime.sendMessage({ type: 'gnaa-voice', action: 'toggle' });
    if (!res?.ok) {
      showHint(res?.error || 'Could not start voice control.');
      return;
    }
    showHint(res.listening
      ? 'Listening on the game tab. Allow the microphone if Chrome asks. Say “stop listening” to end.'
      : 'Voice control off.');
  } catch (err) {
    showHint(String(err?.message || err || 'Could not start voice control.'));
  }
  setTimeout(refreshStatus, 250);
});

document.getElementById('reconnect').addEventListener('click', async () => {
  try {
    await chrome.runtime.sendMessage({ type: 'gnaa-reconnect' });
  } catch {
    /* ignore */
  }
  setTimeout(refreshStatus, 400);
});

document.getElementById('open-options').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById('open-game').addEventListener('click', async () => {
  try {
    await chrome.runtime.sendMessage({ type: 'gnaa-open-game', url: GAME_OPEN_URL });
  } catch {
    window.open(GAME_OPEN_URL, '_blank', 'noopener');
  }
  setTimeout(refreshStatus, 500);
});

setMode('hold');
refreshStatus();
setInterval(refreshStatus, 2000);
