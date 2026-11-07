import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultProfile, gestureConfigsFromProfile } from '../lib/profiles.js';
import { createInterpreter } from '../lib/interpreter.js';
import { CameraKeys } from '../../extension/lib/camera-keys.js';
import { DEFAULT_KEY_CODES } from '../../extension/lib/actions.js';

function fixture(profile = createDefaultProfile()) {
  const interpreter = createInterpreter(gestureConfigsFromProfile(profile));
  const delivered = [], held = new Set(), timers = new Map();
  let now = 0, timerId = 0;
  const keys = new CameraKeys((code, state) => {
    delivered.push({ code, state, now });
    if (state === 'down') held.add(code);
    else held.delete(code);
    assert.ok(!(held.has('KeyA') && held.has('KeyD')), 'opposite directions must not overlap');
  }, {
    setTimer(callback) { timers.set(++timerId, callback); return timerId; },
    clearTimer(id) { timers.delete(id); },
  });
  async function deliver(events) {
    for (const event of events) {
      const code = DEFAULT_KEY_CODES[profile.bindings[event.id]];
      if (code) await keys.apply(event.id, code, event.state);
    }
    return events;
  }
  return {
    interpreter, delivered, held, timers,
    async frame(signals, time) { now = time; return deliver(interpreter.update(signals, time)); },
    async lose(time) { now = time; await deliver(interpreter.releaseAll()); },
    async expire(time) {
      now = time;
      for (const callback of [...timers.values()]) callback();
      await keys.pending;
    },
  };
}

async function steeringDuration(yaw) {
  const f = fixture();
  for (let now = 0; now < 1200; now += 10) await f.frame({ yaw }, now);
  await f.frame({ yaw: 0 }, 1200);
  let pressedAt = null, duration = 0;
  for (const event of f.delivered) {
    if (event.state === 'down') pressedAt = event.now;
    else { duration += event.now - pressedAt; pressedAt = null; }
  }
  assert.equal(f.held.size, 0);
  assert.equal(f.timers.size, 0);
  return { duration, delivered: f.delivered };
}

for (const [direction, sign, code] of [['right', 1, 'KeyD'], ['left', -1, 'KeyA']]) {
  test(`${direction} steering increases from brief presses to continuous hold`, async () => {
    const slight = await steeringDuration(sign * 0.09);
    const medium = await steeringDuration(sign * 0.16);
    const full = await steeringDuration(sign * 0.28);
    assert.ok(slight.duration > 0 && slight.duration < 350);
    assert.ok(medium.duration > slight.duration && medium.duration < full.duration);
    assert.equal(full.duration, 1200);
    assert.equal(full.delivered.length, 2, 'full steering stays held until neutral');
    assert.ok(slight.delivered.length > 2, 'light steering has release gaps');
    assert.ok(slight.delivered.every((event) => event.code === code));
  });
}

test('fresh head positions respond immediately, release at neutral and reverse in order', async () => {
  const f = fixture();
  await f.frame({ yaw: 0.04 }, 0);
  assert.equal(f.delivered.length, 0, 'neutral jitter stays inside dead zone');
  const events = await f.frame({ yaw: 0.09 }, 10);
  assert.ok(events[0].strength < 0.25);
  assert.deepEqual(f.delivered.at(-1), { code: 'KeyD', state: 'down', now: 10 });
  await f.frame({ yaw: 0.09 }, 40);
  assert.equal(f.delivered.at(-1).state, 'up');
  await f.frame({ yaw: 0.28 }, 50);
  assert.deepEqual(f.delivered.at(-1), { code: 'KeyD', state: 'down', now: 50 });
  await f.frame({ yaw: -0.28 }, 60);
  assert.deepEqual(f.delivered.slice(-2), [
    { code: 'KeyD', state: 'up', now: 60 },
    { code: 'KeyA', state: 'down', now: 60 },
  ]);
  await f.frame({ yaw: 0 }, 70);
  assert.equal(f.held.size, 0, 'no smoothing tail after returning to centre');
});

test('lost tracking releases steering and the next fresh face frame can steer again', async () => {
  const f = fixture();
  await f.frame({ yaw: 0.28 }, 100);
  await f.lose(110);
  assert.equal(f.held.size, 0);
  assert.equal(f.timers.size, 0);
  await f.frame({ yaw: -0.09 }, 120);
  assert.deepEqual(f.delivered.at(-1), { code: 'KeyA', state: 'down', now: 120 });
  await f.expire(920);
  assert.equal(f.held.size, 0, 'stalled tracking still expires the receiver lease');
  await f.lose(930);
});

test('saved mappings and roll steering opt in without changing other gesture modes', () => {
  const profile = createDefaultProfile();
  profile.bindings.tiltLeft = 'steerRight';
  profile.bindings.tiltRight = 'throttle';
  profile.bindings.headRollLeft = 'steerLeft';
  profile.bindings.headYawRight = 'steerRight';
  profile.gestures.headYawRight.mode = 'toggle';
  const configs = gestureConfigsFromProfile(profile);
  assert.equal(configs.tiltLeft.proportional, true);
  assert.equal(configs.tiltRight.proportional, false, 'throttle remains a regular hold');
  assert.equal(configs.headRollLeft.proportional, true);
  assert.equal(configs.headYawRight.proportional, false, 'explicit toggle mode is preserved');
  assert.equal(configs.mouthOpen.proportional, false);
  assert.equal(configs.mouthOpen.smooth, 0.35);
});

test('head movements mapped to throttle still hold continuously', async () => {
  const profile = createDefaultProfile();
  profile.bindings.tiltRight = 'throttle';
  const f = fixture(profile);
  for (let now = 100; now <= 1200; now += 10) await f.frame({ yaw: 0.28 }, now);
  assert.deepEqual(f.delivered.map(({ code, state }) => [code, state]), [['KeyW', 'down']]);
  await f.lose(1210);
  assert.deepEqual(f.delivered.at(-1), { code: 'KeyW', state: 'up', now: 1210 });
});
