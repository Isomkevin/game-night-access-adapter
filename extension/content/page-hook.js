/**
 * MAIN-world fallback: listen for postMessage from the content script and
 * dispatch KeyboardEvents from the page context (if untrusted events are ever ignored).
 */
(function gnaaPageHook() {
  if (window.__gnaaHookInstalled) return;
  window.__gnaaHookInstalled = true;

  const CODE_TO_KEY = {
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

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== 'gnaa-extension') return;
    if (data.type !== 'key') return;
    const code = data.code;
    const keyType = data.keyType === 'keyup' ? 'keyup' : 'keydown';
    if (!code) return;
    const key = CODE_TO_KEY[code] ?? code;
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
