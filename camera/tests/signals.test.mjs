import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateYawFromLandmarks, extractSignals, applyBaseline } from '../lib/signals.js';
import { createDefaultProfile, gestureConfigsFromProfile } from '../lib/profiles.js';
import { createInterpreter } from '../lib/interpreter.js';

function face(noseX = 0.5) {
  const points = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  points[1] = { x: noseX, y: 0.6 };
  points[234] = { x: 0.2, y: 0.5 };
  points[454] = { x: 0.8, y: 0.5 };
  points[33] = { x: 0.3, y: 0.4 };
  points[263] = { x: 0.7, y: 0.4 };
  points[152] = { x: 0.5, y: 0.9 };
  return { faceLandmarks: [points] };
}

test('overlay yaw follows the person: right is positive, left is negative', () => {
  assert.equal(estimateYawFromLandmarks(face().faceLandmarks[0]), 0);
  // In the unmirrored camera input, the person's right is image-left.
  assert.ok(estimateYawFromLandmarks(face(0.4).faceLandmarks[0]) > 0);
  assert.ok(estimateYawFromLandmarks(face(0.6).faceLandmarks[0]) < 0);
  assert.equal(estimateYawFromLandmarks([]), 0);
});

for (const [direction, noseX, gesture, action] of [
  ['right', 0.4, 'tiltRight', 'steerRight'],
  ['left', 0.6, 'tiltLeft', 'steerLeft'],
]) {
  test(`default profile steers ${direction} for a ${direction} turn and releases at neutral`, () => {
    const profile = createDefaultProfile();
    const interpreter = createInterpreter(gestureConfigsFromProfile(profile));
    // Calibrate a slightly off-centre resting pose, as a real user may do.
    const baseline = extractSignals(face(0.51), null, { mirrorSubject: true });
    const signals = applyBaseline(extractSignals(face(noseX), null, { mirrorSubject: true }), baseline);
    const downs = [];
    for (let now = 100; now <= 1000; now += 100) {
      downs.push(...interpreter.update(signals, now).filter((event) => event.state === 'down'));
    }
    assert.ok(downs.length > 0);
    assert.deepEqual([...new Set(downs.map((event) => event.id))], [gesture]);
    assert.ok(downs.every((event) => profile.bindings[event.id] === action));

    const neutral = applyBaseline(baseline, baseline);
    const neutralEvents = [];
    for (let now = 1100; now <= 2000; now += 100) {
      neutralEvents.push(...interpreter.update(neutral, now));
    }
    assert.ok(neutralEvents.every((event) => event.state === 'up' && event.id === gesture));
    assert.equal(interpreter.getState().get(gesture).active, false);
    assert.equal(interpreter.getState().get(gesture).pressed, false);
  });
}
