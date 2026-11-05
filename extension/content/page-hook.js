/**
 * MAIN-world fallback: listen for postMessage from the content script and
 * dispatch KeyboardEvents from the page context (if untrusted events are ever ignored).
 */
(function gnaaPageHook() {
  if (window.__gnaaHookInstalled) return;
  window.__gnaaHookInstalled = true;

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

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== 'gnaa-extension') return;
    if (data.type !== 'key') return;
    const code = data.code;
    const keyType = data.keyType === 'keyup' ? 'keyup' : 'keydown';
    if (!code) return;
    const key = typeof data.key === 'string' && data.key ? data.key : codeToKey(code);
    window.dispatchEvent(
      new KeyboardEvent(keyType, {
        key,
        code,
        bubbles: true,
        cancelable: true,
        composed: true,
      })
    );
  });
})();
