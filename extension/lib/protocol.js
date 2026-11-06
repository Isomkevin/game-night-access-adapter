/**
 * Vendored from packages/shared/protocol.js — rebuild by copying after shared edits.
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
  'voice:gearUp': 'shiftUp',
  'voice:gearDown': 'shiftDown',
  'phone:tiltLeft': 'steerLeft',
  'phone:tiltRight': 'steerRight',
  'phone:throttle': 'throttle',
  'phone:brake': 'brake',
  'phone:boost': 'boost',
});

/** Logical input ids offered in the remap UI (human-readable labels) */
export const LOGICAL_INPUTS = Object.freeze([
  { id: 'demo:steerLeft', label: 'On-screen — Steer left', source: 'demo' },
  { id: 'demo:steerRight', label: 'On-screen — Steer right', source: 'demo' },
  { id: 'demo:throttle', label: 'On-screen — Throttle', source: 'demo' },
  { id: 'demo:brake', label: 'On-screen — Brake', source: 'demo' },
  { id: 'demo:boost', label: 'On-screen — Boost', source: 'demo' },
  { id: 'demo:pause', label: 'On-screen — Pause', source: 'demo' },

  // Camera — head (tiltLeft/Right preserved for Milestone 1 demos; they are yaw)
  { id: 'camera:tiltLeft', label: 'Head — Turn left (simple)', source: 'camera' },
  { id: 'camera:tiltRight', label: 'Head — Turn right (simple)', source: 'camera' },
  { id: 'camera:headYawLeft', label: 'Head — Turn left', source: 'camera' },
  { id: 'camera:headYawRight', label: 'Head — Turn right', source: 'camera' },
  { id: 'camera:headPitchUp', label: 'Head — Look up', source: 'camera' },
  { id: 'camera:headPitchDown', label: 'Head — Look down', source: 'camera' },
  { id: 'camera:headRollLeft', label: 'Head — Tilt left', source: 'camera' },
  { id: 'camera:headRollRight', label: 'Head — Tilt right', source: 'camera' },
  { id: 'camera:headCloser', label: 'Head — Move closer', source: 'camera' },
  { id: 'camera:headFarther', label: 'Head — Move farther', source: 'camera' },

  // Camera — face
  { id: 'camera:mouthOpen', label: 'Face — Open mouth', source: 'camera' },
  { id: 'camera:smile', label: 'Face — Smile', source: 'camera' },
  { id: 'camera:browRaise', label: 'Face — Raise eyebrows', source: 'camera' },
  { id: 'camera:frown', label: 'Face — Frown', source: 'camera' },
  { id: 'camera:blinkLeft', label: 'Face — Blink left eye', source: 'camera' },
  { id: 'camera:blinkRight', label: 'Face — Blink right eye', source: 'camera' },
  { id: 'camera:blinkBoth', label: 'Face — Blink both eyes', source: 'camera' },
  { id: 'camera:squint', label: 'Face — Squint', source: 'camera' },

  // Camera — hands
  { id: 'camera:handRaise', label: 'Hand — Raise hand', source: 'camera' },
  { id: 'camera:handLeft', label: 'Hand — Move left', source: 'camera' },
  { id: 'camera:handRight', label: 'Hand — Move right', source: 'camera' },
  { id: 'camera:palmOpen', label: 'Hand — Open palm', source: 'camera' },
  { id: 'camera:fist', label: 'Hand — Fist', source: 'camera' },
  { id: 'camera:thumbUp', label: 'Hand — Thumbs up', source: 'camera' },
  { id: 'camera:thumbDown', label: 'Hand — Thumbs down', source: 'camera' },
  { id: 'camera:pointUp', label: 'Hand — Point up', source: 'camera' },

  // Camera — fingers
  { id: 'camera:pinch', label: 'Finger — Pinch', source: 'camera' },
  { id: 'camera:indexPoint', label: 'Finger — Index extended', source: 'camera' },

  { id: 'voice:turnLeft', label: 'Say “turn left”', source: 'voice' },
  { id: 'voice:turnRight', label: 'Say “turn right”', source: 'voice' },
  { id: 'voice:go', label: 'Say “go” / “accelerate”', source: 'voice' },
  { id: 'voice:stop', label: 'Say “stop” / “brake”', source: 'voice' },
  { id: 'voice:boost', label: 'Say “boost”', source: 'voice' },
  { id: 'voice:pause', label: 'Say “pause”', source: 'voice' },
  { id: 'voice:gearUp', label: 'Say “gear up”', source: 'voice' },
  { id: 'voice:gearDown', label: 'Say “gear down”', source: 'voice' },
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
