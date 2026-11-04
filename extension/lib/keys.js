/**
 * Map game actions → KeyboardEvent fields for LibreCorsa.
 */

import { DEFAULT_KEY_CODES } from './actions.js';

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
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
};

/**
 * @param {string} action game action id
 * @param {Record<string, string>} [keyOverrides] optional action→code map from storage
 */
export function codeForAction(action, keyOverrides) {
  if (keyOverrides && keyOverrides[action]) return keyOverrides[action];
  return DEFAULT_KEY_CODES[action] || null;
}

export function keyboardEventInit(code, type) {
  const key = CODE_TO_KEY[code] ?? code;
  return {
    key,
    code,
    bubbles: true,
    cancelable: true,
    composed: true,
  };
}

export function dispatchKey(target, code, type) {
  const init = keyboardEventInit(code, type);
  const event = new KeyboardEvent(type, init);
  target.dispatchEvent(event);
  return event;
}
