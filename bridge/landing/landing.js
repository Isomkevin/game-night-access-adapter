/**
 * Landing enhancements: hero signal cycle + bridge/extension status strip.
 */

const signals = [...document.querySelectorAll('.signal')];
if (signals.length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  let i = 0;
  setInterval(() => {
    signals.forEach((el, idx) => el.classList.toggle('is-live', idx === i));
    i = (i + 1) % signals.length;
  }, 2200);
}

const statusRoot = document.getElementById('launcher-status');
const statusTitle = statusRoot?.querySelector('.launcher-status-title');
const statusDetail = statusRoot?.querySelector('.launcher-status-detail');

async function refreshLauncherStatus() {
  if (!statusRoot || !statusTitle || !statusDetail) return;
  try {
    const res = await fetch('/health', { cache: 'no-store' });
    const data = await res.json();
    const ext = Number(data?.clients?.extension || 0);
    if (!data?.ok) {
      statusRoot.dataset.state = 'warn';
      statusTitle.textContent = 'Bridge responded unexpectedly';
      statusDetail.innerHTML =
        'Try restarting Game Night from the tray, or open the <a href="/hub/">control hub</a>.';
      return;
    }
    if (ext > 0) {
      statusRoot.dataset.state = 'ok';
      statusTitle.textContent = 'Extension connected';
      statusDetail.innerHTML =
        'Open <strong>any</strong> keyboard-driven browser game → extension popup → <strong>Use this tab</strong> → <a href="/hub/">choose controls</a>.';
    } else {
      statusRoot.dataset.state = 'warn';
      statusTitle.textContent = 'Bridge is up — install or reload the extension';
      statusDetail.innerHTML =
        'Use the Game Night tray → <strong>Extension setup</strong>, or Load unpacked from <code>extension/</code>. Then pin your game with <strong>Use this tab</strong>.';
    }
  } catch {
    statusRoot.dataset.state = 'warn';
    statusTitle.textContent = 'Cannot reach this bridge';
    statusDetail.innerHTML =
      'If you use the desktop app, pick <strong>Restart bridge</strong> in the tray. Contributors: <code>cd bridge && npm start</code>.';
  }
}

if (statusRoot) {
  refreshLauncherStatus();
  setInterval(refreshLauncherStatus, 4000);
}
