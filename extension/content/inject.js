/**
 * Content script: receives mapped game actions from the service worker and
 * injects KeyboardEvents into the LibreCorsa page.
 */

const PULSE_MS = 120;
const heldCodes = new Set();

function injectPageHook() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('content/page-hook.js');
  script.onload = () => script.remove();
  (document.documentElement || document.head).appendChild(script);
}

function dispatchViaDom(code, keyType) {
  const keyMap = {
    KeyA: 'a',
    KeyD: 'd',
    KeyW: 'w',
    KeyS: 's',
    KeyE: 'e',
    KeyQ: 'q',
    KeyX: 'x',
    Space: ' ',
    Escape: 'Escape',
    Backspace: 'Backspace',
  };
  const key = keyMap[code] ?? code;
  const event = new KeyboardEvent(keyType, {
    key,
    code,
    bubbles: true,
    cancelable: true,
    composed: true,
  });
  window.dispatchEvent(event);
  // MAIN-world fallback path
  window.postMessage(
    { source: 'gnaa-extension', type: 'key', code, keyType },
    '*'
  );
}

function applyKey(code, state) {
  if (!code) return;
  if (state === 'down') {
    if (heldCodes.has(code)) return;
    heldCodes.add(code);
    dispatchViaDom(code, 'keydown');
  } else if (state === 'up') {
    if (!heldCodes.has(code)) return;
    heldCodes.delete(code);
    dispatchViaDom(code, 'keyup');
  } else if (state === 'pulse') {
    dispatchViaDom(code, 'keydown');
    setTimeout(() => dispatchViaDom(code, 'keyup'), PULSE_MS);
  }
}

function releaseAll() {
  for (const code of [...heldCodes]) {
    heldCodes.delete(code);
    dispatchViaDom(code, 'keyup');
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || !msg.type) return;
  if (msg.type === 'gnaa-apply') {
    applyKey(msg.code, msg.state || 'pulse');
    sendResponse({ ok: true });
    return true;
  }
  if (msg.type === 'gnaa-release-all') {
    releaseAll();
    sendResponse({ ok: true });
    return true;
  }
});

injectPageHook();

chrome.runtime.sendMessage({ type: 'gnaa-content-ready', url: location.href }).catch(() => {});
