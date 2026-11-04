function sendDemo(action, state) {
  return chrome.runtime.sendMessage({
    type: 'gnaa-demo-input',
    action,
    state,
  });
}

function bindHold(btn) {
  const action = btn.dataset.action;
  const down = (e) => {
    e.preventDefault();
    btn.classList.add('active');
    sendDemo(action, 'down');
  };
  const up = (e) => {
    e.preventDefault();
    btn.classList.remove('active');
    sendDemo(action, 'up');
  };
  btn.addEventListener('pointerdown', down);
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointerleave', up);
  btn.addEventListener('pointercancel', up);
}

function bindPulse(btn) {
  btn.addEventListener('click', () => {
    sendDemo(btn.dataset.action, 'pulse');
  });
}

async function refreshStatus() {
  const el = document.getElementById('status');
  try {
    const s = await chrome.runtime.sendMessage({ type: 'gnaa-get-status' });
    if (s.bridgeStatus === 'connected') {
      el.textContent = `Bridge connected (${s.bridgeUrl})`;
      el.className = 'status ok';
    } else {
      el.textContent = 'Demo mode — bridge offline (controls still work)';
      el.className = 'status warn';
    }
  } catch {
    el.textContent = 'Extension worker unavailable — reload the extension';
    el.className = 'status warn';
  }
}

document.querySelectorAll('button.hold').forEach(bindHold);
document.querySelectorAll('button.pulse').forEach(bindPulse);

document.getElementById('reconnect').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'gnaa-reconnect' });
  setTimeout(refreshStatus, 400);
});

document.getElementById('open-options').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

refreshStatus();
setInterval(refreshStatus, 2000);
