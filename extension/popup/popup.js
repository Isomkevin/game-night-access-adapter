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

function updatePinHint(s) {
  const hint = document.getElementById('pin-hint');
  const pin = describePinnedTab(s);
  if (s?.targetTabId && pin) {
    hint.textContent = `Inputs go to ${pin}.`;
    return;
  }
  if (s?.gameTabOpen) {
    hint.textContent = 'Using LibreCorsa demo tab. Pin any game with Use this tab.';
    return;
  }
  hint.textContent = 'No game tab pinned — Open game (LibreCorsa) or Use this tab.';
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
    el.textContent = primary.title;
    el.className = `status ${primary.tone}`;
    detail.textContent = `${game.title}. ${conn.detail}`;
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
  const hint = document.getElementById('pin-hint');
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const res = await chrome.runtime.sendMessage({
      type: 'gnaa-use-this-tab',
      tabId: tab?.id,
    });
    if (!res?.ok) {
      hint.textContent = res?.error || 'Could not pin this tab.';
      return;
    }
    hint.textContent = `Pinned ${res.targetTabHost || res.targetTabTitle || 'tab'}.`;
  } catch (err) {
    hint.textContent = String(err?.message || err || 'Could not pin this tab.');
  }
  setTimeout(refreshStatus, 200);
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
