/**
 * Shared action IDs and LibreCorsa default key codes (KeyboardEvent.code).
 * Keep in sync with game/src/lib/input/bindings.ts DEFAULT_KEY_BINDINGS.
 */

/** @typedef {'steerLeft'|'steerRight'|'throttle'|'brake'|'boost'|'pause'|'shiftUp'|'shiftDown'|'aero'|'restart'} GameAction */

/** @type {readonly GameAction[]} */
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

/** Human labels for settings UI */
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

/**
 * Default KeyboardEvent.code for each game action (LibreCorsa defaults).
 * @type {Readonly<Record<GameAction, string>>}
 */
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

/** Readable key for UI */
export function keyCodeLabel(code) {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code === 'Space') return 'Space';
  if (code === 'Escape') return 'Esc';
  if (code === 'Backspace') return '⌫';
  return code;
}

/** Hold vs pulse semantics */
export const HOLD_ACTIONS = new Set([
  'steerLeft',
  'steerRight',
  'throttle',
  'brake',
  'boost',
]);
