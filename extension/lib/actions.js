/**
 * Vendored from packages/shared/actions.js — rebuild by copying after shared edits.
 */

export const GAME_ACTIONS = Object.freeze([
  'steerLeft',
  'steerRight',
  'throttle',
  'brake',
  'boost',
  'pause',
  'shiftUp',
  'shiftDown',
  'aero',
  'restart',
]);

export const ACTION_LABELS = Object.freeze({
  steerLeft: 'Steer left',
  steerRight: 'Steer right',
  throttle: 'Throttle',
  brake: 'Brake',
  boost: 'Boost (hold)',
  pause: 'Pause menu',
  shiftUp: 'Gear up',
  shiftDown: 'Gear down',
  aero: 'Active aero / DRS',
  restart: 'Restart',
});

export const DEFAULT_KEY_CODES = Object.freeze({
  steerLeft: 'KeyA',
  steerRight: 'KeyD',
  throttle: 'KeyW',
  brake: 'KeyS',
  boost: 'Space',
  pause: 'Escape',
  shiftUp: 'KeyE',
  shiftDown: 'KeyQ',
  aero: 'KeyX',
  restart: 'Backspace',
});

export function keyCodeLabel(code) {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code === 'Space') return 'Space';
  if (code === 'Escape') return 'Esc';
  if (code === 'Backspace') return '⌫';
  return code;
}

export const HOLD_ACTIONS = new Set([
  'steerLeft',
  'steerRight',
  'throttle',
  'brake',
  'boost',
]);
