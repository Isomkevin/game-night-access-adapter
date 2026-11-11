/* global gameNight */

const hint = document.getElementById('ext-hint');
const statusEl = document.getElementById('status');

function setStatus(text, cls) {
  statusEl.textContent = text;
  statusEl.className = 'status' + (cls ? ` ${cls}` : '');
}

async function refreshStatus() {
  try {
    const s = await gameNight.checkExtension();
    if (s.connected) {
      setStatus('Extension connected to the bridge. You can open your game and Use this tab.', 'ok');
    } else if (s.status === 'running') {
      setStatus(
        'Bridge is running. Finish Load unpacked, then reload the extension if needed.',
        'warn'
      );
    } else {
      setStatus(`Bridge status: ${s.status}. ${s.detail || ''}`, 'warn');
    }
  } catch {
    setStatus('Could not check bridge status.', 'warn');
  }
}

gameNight.onExtensionInfo((info) => {
  const steps = (info.steps || []).join('\n\n');
  hint.textContent = steps || `Folder: ${info.path || ''}`;
  if (info.port) window.__gnaaPort = info.port;
});

document.getElementById('btn-ext').addEventListener('click', () => {
  gameNight.rerunExtensionSetup();
});

document.getElementById('btn-hub').addEventListener('click', () => {
  gameNight.openHub();
});

document.getElementById('btn-landing').addEventListener('click', () => {
  gameNight.openLanding();
});

document.getElementById('btn-guide')?.addEventListener('click', () => {
  gameNight.openUrl(`http://127.0.0.1:${window.__gnaaPort || 18765}/guide/`);
});

document.getElementById('btn-done').addEventListener('click', async () => {
  await gameNight.markFirstRunDone();
  await gameNight.openHub();
  window.close();
});

refreshStatus();
setInterval(refreshStatus, 3000);
