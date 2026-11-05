/**
 * Map game actions → KeyboardEvent fields for any browser game.
 */

import { DEFAULT_KEY_CODES } from './actions.js';

const NAMED_CODE_TO_KEY = Object.freeze({
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
});

/**
 * Convert a KeyboardEvent.code value into a KeyboardEvent.key value.
 * @param {string} code
 * @returns {string}
 */
export function codeToKey(code) {
  if (!code) return '';
  if (NAMED_CODE_TO_KEY[code]) return NAMED_CODE_TO_KEY[code];
  if (code.startsWith('Key') && code.length === 4) return code.slice(3).toLowerCase();
  if (code.startsWith('Digit') && code.length === 6) return code.slice(5);
  if (code.startsWith('Numpad') && code.length === 7) return code.slice(6);
  return code;
}

/**
 * @param {string} action game action id
 * @param {Record<string, string>} [keyOverrides] optional action→code map from storage
 */
export function codeForAction(action, keyOverrides) {
  if (keyOverrides && keyOverrides[action]) return keyOverrides[action];
  return DEFAULT_KEY_CODES[action] || null;
}

export function keyboardEventInit(code, type) {
  return {
    key: codeToKey(code),
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
