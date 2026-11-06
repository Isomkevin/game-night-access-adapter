/**
 * Floating in-game camera preview dock.
 * Embeds the bridge camera UI (gesture controller) so tracking stays alive
 * while the game tab is focused — no separate camera tab required.
 */

const DOCK_ID = 'gnaa-camera-dock';
const STYLE_ID = 'gnaa-camera-dock-style';

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${DOCK_ID} {
      position: fixed;
      z-index: 2147483646;
      right: 16px;
      bottom: 16px;
      width: 300px;
      height: 240px;
      min-width: 220px;
      min-height: 160px;
      max-width: min(92vw, 520px);
      max-height: min(88vh, 720px);
      display: flex;
      flex-direction: column;
      background: #0b3d3a;
      color: #f3ede3;
      border: 1px solid #1f5c57;
      border-radius: 12px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
      overflow: hidden;
      font-family: "Segoe UI", system-ui, sans-serif;
      resize: both;
    }
    #${DOCK_ID}.is-expanded {
      width: min(420px, 92vw);
      height: min(560px, 88vh);
    }
    #${DOCK_ID}.is-minimized {
      height: 40px !important;
      min-height: 40px;
      resize: none;
    }
    #${DOCK_ID}.is-minimized iframe {
      display: none;
    }
    #${DOCK_ID} .gnaa-dock-bar {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 8px;
      background: #072e2c;
      cursor: grab;
      user-select: none;
      flex: 0 0 auto;
    }
    #${DOCK_ID} .gnaa-dock-bar:active {
      cursor: grabbing;
    }
    #${DOCK_ID} .gnaa-dock-title {
      flex: 1;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.02em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #${DOCK_ID} .gnaa-dock-bar button {
      min-width: 28px;
      min-height: 28px;
      padding: 0 6px;
      border: 0;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.12);
      color: #f3ede3;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
    #${DOCK_ID} .gnaa-dock-bar button:hover {
      background: rgba(224, 138, 30, 0.85);
      color: #1a1208;
    }
    #${DOCK_ID} iframe {
      flex: 1 1 auto;
      width: 100%;
      border: 0;
      background: #000;
    }
  `;
  (document.documentElement || document.head).appendChild(style);
}

function removeDock() {
  document.getElementById(DOCK_ID)?.remove();
}

/**
 * @param {string} cameraUrl absolute URL to camera embed page
 */
function showDock(cameraUrl) {
  ensureStyles();
  removeDock();

  const dock = document.createElement('div');
  dock.id = DOCK_ID;
  dock.setAttribute('role', 'complementary');
  dock.setAttribute('aria-label', 'Game Night camera preview');

  const bar = document.createElement('div');
  bar.className = 'gnaa-dock-bar';

  const title = document.createElement('span');
  title.className = 'gnaa-dock-title';
  title.textContent = 'Camera preview';

  const btnMin = document.createElement('button');
  btnMin.type = 'button';
  btnMin.title = 'Minimize';
  btnMin.setAttribute('aria-label', 'Minimize camera preview');
  btnMin.textContent = '–';

  const btnExpand = document.createElement('button');
  btnExpand.type = 'button';
  btnExpand.title = 'Show gesture controls';
  btnExpand.setAttribute('aria-label', 'Expand camera for gesture setup');
  btnExpand.textContent = '▣';

  const btnClose = document.createElement('button');
  btnClose.type = 'button';
  btnClose.title = 'Close';
  btnClose.setAttribute('aria-label', 'Close camera preview');
  btnClose.textContent = '×';

  const frame = document.createElement('iframe');
  frame.src = cameraUrl;
  frame.title = 'Game Night camera';
  frame.allow = 'camera; microphone';
  frame.setAttribute('allowfullscreen', 'false');

  bar.append(title, btnMin, btnExpand, btnClose);
  dock.append(bar, frame);
  document.documentElement.appendChild(dock);

  let dragging = false;
  let startX = 0;
  let startY = 0;
  let origLeft = 0;
  let origTop = 0;

  bar.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    dragging = true;
    bar.setPointerCapture(e.pointerId);
    const rect = dock.getBoundingClientRect();
    dock.style.left = `${rect.left}px`;
    dock.style.top = `${rect.top}px`;
    dock.style.right = 'auto';
    dock.style.bottom = 'auto';
    startX = e.clientX;
    startY = e.clientY;
    origLeft = rect.left;
    origTop = rect.top;
  });
  bar.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    dock.style.left = `${Math.max(0, origLeft + dx)}px`;
    dock.style.top = `${Math.max(0, origTop + dy)}px`;
  });
  bar.addEventListener('pointerup', () => {
    dragging = false;
  });
  bar.addEventListener('pointercancel', () => {
    dragging = false;
  });

  btnMin.addEventListener('click', () => {
    dock.classList.toggle('is-minimized');
    if (dock.classList.contains('is-minimized')) {
      dock.classList.remove('is-expanded');
      btnMin.textContent = '+';
      btnMin.title = 'Restore';
    } else {
      btnMin.textContent = '–';
      btnMin.title = 'Minimize';
    }
  });

  btnExpand.addEventListener('click', () => {
    dock.classList.remove('is-minimized');
    btnMin.textContent = '–';
    btnMin.title = 'Minimize';
    dock.classList.toggle('is-expanded');
    title.textContent = dock.classList.contains('is-expanded')
      ? 'Camera + gestures'
      : 'Camera preview';
  });

  btnClose.addEventListener('click', () => {
    removeDock();
    chrome.runtime.sendMessage({ type: 'gnaa-camera-dock-closed' }).catch(() => {});
  });
}

function isDockOpen() {
  return !!document.getElementById(DOCK_ID);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || !msg.type) return;
  if (msg.type === 'gnaa-camera-dock') {
    try {
      if (msg.action === 'hide' || msg.action === 'toggle' && isDockOpen()) {
        removeDock();
        sendResponse({ ok: true, open: false });
        return true;
      }
      if (!msg.url) {
        sendResponse({ ok: false, error: 'Missing camera URL' });
        return true;
      }
      showDock(msg.url);
      sendResponse({ ok: true, open: true });
    } catch (err) {
      sendResponse({ ok: false, error: String(err?.message || err) });
    }
    return true;
  }
  if (msg.type === 'gnaa-camera-dock-status') {
    sendResponse({ ok: true, open: isDockOpen() });
    return true;
  }
});
