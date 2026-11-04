/**
 * Vendored from packages/shared/protocol.js — rebuild by copying after shared edits.
 */

export const PROTOCOL_VERSION = 1;
export const DEFAULT_BRIDGE_PORT = 18765;
export const DEFAULT_BRIDGE_WS = `ws://127.0.0.1:${DEFAULT_BRIDGE_PORT}`;

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

export function isInputEvent(msg) {
  if (!msg || typeof msg !== 'object') return false;
  return (
    msg.type === 'input' &&
    typeof msg.source === 'string' &&
    typeof msg.action === 'string' &&
    (msg.state === 'down' || msg.state === 'up' || msg.state === 'pulse')
  );
}

export function createHello(role) {
  return {
    type: 'hello',
    role,
    v: PROTOCOL_VERSION,
    ts: Date.now(),
  };
}

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

export function resolveRemap(remap, logicalId) {
  if (remap && remap[logicalId]) return remap[logicalId];
  if (DEFAULT_REMAP[logicalId]) return DEFAULT_REMAP[logicalId];
  return null;
}
