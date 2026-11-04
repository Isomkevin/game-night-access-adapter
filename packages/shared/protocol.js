/**
 * WebSocket / postMessage protocol for Game Night Access Adapter.
 *
 * Bridge ↔ extension ↔ input sources (camera, voice, phone, demo).
 */

export const PROTOCOL_VERSION = 1;

/** Default local bridge endpoints */
export const DEFAULT_BRIDGE_PORT = 18765;
export const DEFAULT_BRIDGE_WS = `ws://127.0.0.1:${DEFAULT_BRIDGE_PORT}`;
export const DEFAULT_BRIDGE_HTTP = `http://127.0.0.1:${DEFAULT_BRIDGE_PORT}`;

/** @typedef {'camera'|'voice'|'phone'|'demo'|'bridge'} InputSource */
/** @typedef {'down'|'up'|'pulse'} InputState */

/**
 * Canonical input event.
 * Hold actions: state down/up. Voice one-shots: state pulse (press + short release).
 *
 * @typedef {object} InputEvent
 * @property {'input'} type
 * @property {InputSource} source
 * @property {string} action  GameAction id
 * @property {InputState} state
 * @property {number} [strength] 0..1 for analog steer/throttle when supported
 * @property {number} ts       epoch ms
 * @property {number} [v]      protocol version
 */

/**
 * @param {object} partial
 * @returns {InputEvent}
 */
export function createInputEvent({
  source,
  action,
  state,
  strength = 1,
  ts = Date.now(),
}) {
  return {
    type: 'input',
    source,
    action,
    state,
    strength,
    ts,
    v: PROTOCOL_VERSION,
  };
}

/**
 * @param {unknown} msg
 * @returns {msg is InputEvent}
 */
export function isInputEvent(msg) {
  if (!msg || typeof msg !== 'object') return false;
  const m = /** @type {Record<string, unknown>} */ (msg);
  return (
    m.type === 'input' &&
    typeof m.source === 'string' &&
    typeof m.action === 'string' &&
    (m.state === 'down' || m.state === 'up' || m.state === 'pulse')
  );
}

/** Hello from a client connecting to the bridge */
export function createHello(role) {
  return {
    type: 'hello',
    role,
    v: PROTOCOL_VERSION,
    ts: Date.now(),
  };
}

/** Status broadcast from bridge */
export function createStatus(payload) {
  return {
    type: 'status',
    v: PROTOCOL_VERSION,
    ts: Date.now(),
    ...payload,
  };
}

/**
 * Default remap profile: logical input → game action.
 * Input keys are "source:logical" e.g. "camera:tiltLeft", "voice:turnLeft".
 */
export const DEFAULT_REMAP = Object.freeze({
  'demo:steerLeft': 'steerLeft',
  'demo:steerRight': 'steerRight',
  'demo:throttle': 'throttle',
  'demo:brake': 'brake',
  'demo:boost': 'boost',
  'demo:pause': 'pause',
  'camera:tiltLeft': 'steerLeft',
  'camera:tiltRight': 'steerRight',
  'voice:turnLeft': 'steerLeft',
  'voice:turnRight': 'steerRight',
  'voice:go': 'throttle',
  'voice:stop': 'brake',
  'voice:boost': 'boost',
  'voice:pause': 'pause',
  'voice:gearUp': 'shiftUp',
  'voice:gearDown': 'shiftDown',
  'phone:tiltLeft': 'steerLeft',
  'phone:tiltRight': 'steerRight',
  'phone:throttle': 'throttle',
  'phone:brake': 'brake',
  'phone:boost': 'boost',
});

/** Logical input ids offered in the remap UI */
export const LOGICAL_INPUTS = Object.freeze([
  { id: 'demo:steerLeft', label: 'Demo — Steer left', source: 'demo' },
  { id: 'demo:steerRight', label: 'Demo — Steer right', source: 'demo' },
  { id: 'demo:throttle', label: 'Demo — Throttle', source: 'demo' },
  { id: 'demo:brake', label: 'Demo — Brake', source: 'demo' },
  { id: 'demo:boost', label: 'Demo — Boost', source: 'demo' },
  { id: 'demo:pause', label: 'Demo — Pause', source: 'demo' },
  { id: 'camera:tiltLeft', label: 'Camera — Head tilt left', source: 'camera' },
  { id: 'camera:tiltRight', label: 'Camera — Head tilt right', source: 'camera' },
  { id: 'voice:turnLeft', label: 'Voice — “turn left”', source: 'voice' },
  { id: 'voice:turnRight', label: 'Voice — “turn right”', source: 'voice' },
  { id: 'voice:go', label: 'Voice — “go” / “accelerate”', source: 'voice' },
  { id: 'voice:stop', label: 'Voice — “stop” / “brake”', source: 'voice' },
  { id: 'voice:boost', label: 'Voice — “boost”', source: 'voice' },
  { id: 'voice:pause', label: 'Voice — “pause”', source: 'voice' },
  { id: 'voice:gearUp', label: 'Voice — “gear up”', source: 'voice' },
  { id: 'voice:gearDown', label: 'Voice — “gear down”', source: 'voice' },
  { id: 'phone:tiltLeft', label: 'Phone — Tilt left', source: 'phone' },
  { id: 'phone:tiltRight', label: 'Phone — Tilt right', source: 'phone' },
  { id: 'phone:throttle', label: 'Phone — Throttle button', source: 'phone' },
  { id: 'phone:brake', label: 'Phone — Brake button', source: 'phone' },
  { id: 'phone:boost', label: 'Phone — Boost button', source: 'phone' },
]);

/**
 * Resolve a raw logical input through the player's remap table.
 * @param {Record<string, string>} remap
 * @param {string} logicalId  e.g. camera:tiltLeft
 * @returns {string|null} game action id
 */
export function resolveRemap(remap, logicalId) {
  if (remap && remap[logicalId]) return remap[logicalId];
  if (DEFAULT_REMAP[logicalId]) return DEFAULT_REMAP[logicalId];
  return null;
}
