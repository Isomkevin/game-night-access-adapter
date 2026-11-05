/**
 * Content script: receives mapped game actions from the service worker and
 * injects KeyboardEvents into the focused browser-game page.
 */

const PULSE_MS = 120;
const heldCodes = new Set();

const NAMED_CODE_TO_KEY = {
  Space: ' ',
  Escape: 'Escape',
  Backspace: 'Backspace',
  Tab: 'Tab',
  Enter: 'Enter',
  ShiftLeft: 'Shift',
  ShiftRight: 'Shift',
  ControlLeft: 'Control',
  ControlRight: 'Control',
  AltLeft: 'Alt',
  AltRight: 'Alt',
  MetaLeft: 'Meta',
  MetaRight: 'Meta',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
};

/** @param {string} code */
function codeToKey(code) {
  if (!code) return '';
  if (NAMED_CODE_TO_KEY[code]) return NAMED_CODE_TO_KEY[code];
  if (code.startsWith('Key') && code.length === 4) return code.slice(3).toLowerCase();
  if (code.startsWith('Digit') && code.length === 6) return code.slice(5);
  if (code.startsWith('Numpad') && code.length === 7) return code.slice(6);
  return code;
}

function injectPageHook() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('content/page-hook.js');
  script.onload = () => script.remove();
  (document.documentElement || document.head).appendChild(script);
}

function dispatchViaDom(code, keyType) {
  const key = codeToKey(code);
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
    { source: 'gnaa-extension', type: 'key', code, key, keyType },
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
