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
 * @property {string} action
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

/** @param {unknown} msg */
export function isSetRemapEvent(msg) {
  if (!msg || typeof msg !== 'object') return false;
  const m = /** @type {Record<string, unknown>} */ (msg);
  return m.type === 'setRemap' && m.entries && typeof m.entries === 'object';
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
 * Camera gestures beyond tiltLeft/tiltRight are intentionally unmapped by default
 * so users assign them without accidental triggers.
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

  // Camera — head (tiltLeft/Right preserved for Milestone 1 demos; they are yaw)
  { id: 'camera:tiltLeft', label: 'Camera — Head yaw left (legacy)', source: 'camera' },
  { id: 'camera:tiltRight', label: 'Camera — Head yaw right (legacy)', source: 'camera' },
  { id: 'camera:headYawLeft', label: 'Camera — Turn head left', source: 'camera' },
  { id: 'camera:headYawRight', label: 'Camera — Turn head right', source: 'camera' },
  { id: 'camera:headPitchUp', label: 'Camera — Raise / look up', source: 'camera' },
  { id: 'camera:headPitchDown', label: 'Camera — Lower / look down', source: 'camera' },
  { id: 'camera:headRollLeft', label: 'Camera — Tilt head left (roll)', source: 'camera' },
  { id: 'camera:headRollRight', label: 'Camera — Tilt head right (roll)', source: 'camera' },
  { id: 'camera:headCloser', label: 'Camera — Head closer (experimental)', source: 'camera' },
  { id: 'camera:headFarther', label: 'Camera — Head farther (experimental)', source: 'camera' },

  // Camera — face
  { id: 'camera:mouthOpen', label: 'Camera — Open mouth', source: 'camera' },
  { id: 'camera:smile', label: 'Camera — Smile', source: 'camera' },
  { id: 'camera:browRaise', label: 'Camera — Raise eyebrows', source: 'camera' },
  { id: 'camera:frown', label: 'Camera — Frown', source: 'camera' },
  { id: 'camera:blinkLeft', label: 'Camera — Blink left eye', source: 'camera' },
  { id: 'camera:blinkRight', label: 'Camera — Blink right eye', source: 'camera' },
  { id: 'camera:blinkBoth', label: 'Camera — Blink both eyes', source: 'camera' },
  { id: 'camera:squint', label: 'Camera — Squint', source: 'camera' },

  // Camera — hands
  { id: 'camera:handRaise', label: 'Camera — Raise hand', source: 'camera' },
  { id: 'camera:handLeft', label: 'Camera — Move hand left', source: 'camera' },
  { id: 'camera:handRight', label: 'Camera — Move hand right', source: 'camera' },
  { id: 'camera:palmOpen', label: 'Camera — Open palm', source: 'camera' },
  { id: 'camera:fist', label: 'Camera — Fist', source: 'camera' },
  { id: 'camera:thumbUp', label: 'Camera — Thumbs up', source: 'camera' },
  { id: 'camera:thumbDown', label: 'Camera — Thumbs down', source: 'camera' },
  { id: 'camera:pointUp', label: 'Camera — Point up', source: 'camera' },

  // Camera — fingers
  { id: 'camera:pinch', label: 'Camera — Pinch', source: 'camera' },
  { id: 'camera:indexPoint', label: 'Camera — Index extended', source: 'camera' },

  { id: 'voice:turnLeft', label: 'Voice — “turn left”', source: 'voice' },
  { id: 'voice:turnRight', label: 'Voice — “turn right”', source: 'voice' },
  { id: 'voice:go', label: 'Voice — “go” / “accelerate”', source: 'voice' },
  { id: 'voice:stop', label: 'Voice — “stop” / “brake”', source: 'voice' },
  { id: 'voice:boost', label: 'Voice — “boost”', source: 'voice' },
  { id: 'voice:pause', label: 'Voice — “pause”', source: 'voice' },
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
  if (remap && Object.prototype.hasOwnProperty.call(remap, logicalId)) {
    const v = remap[logicalId];
    if (!v) return null;
    return v;
  }
  if (DEFAULT_REMAP[logicalId]) return DEFAULT_REMAP[logicalId];
  return null;
}
