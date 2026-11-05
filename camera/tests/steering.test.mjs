import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateYaw, Steering, SteeringSender } from '../steering.js';
import { CameraKeys } from '../../extension/lib/camera-keys.js';

function calibrate(control, resting = 0, from = 0) {
  for (let t = from; t <= from + 1000; t += 100) control.sample(resting, t);
}

function face(noseX = 0.5) {
  const points = [];
  points[33] = { x: 0.3, y: 0.4 };
  points[263] = { x: 0.7, y: 0.4 };
  points[1] = { x: noseX, y: 0.6 };
  return points;
}

test('yaw uses the person’s right and is independent of image aspect ratio and roll', () => {
  assert.equal(estimateYaw(face()), 0);
  assert.ok(Math.abs(estimateYaw(face(0.4), 640, 480) - 0.25) < 1e-10);
  assert.ok(estimateYaw(face(0.6)) < 0);
  const angle = 0.5;
  const rotated = face(0.4).map((p) => {
    const x = (p.x - 0.5) * 640, y = (p.y - 0.5) * 480;
    return { x: (x * Math.cos(angle) - y * Math.sin(angle)) / 640 + 0.5,
      y: (x * Math.sin(angle) + y * Math.cos(angle)) / 480 + 0.5 };
  });
  assert.ok(Math.abs(estimateYaw(rotated, 640, 480) - 0.25) < 1e-10);
  assert.equal(estimateYaw([]), null);
  assert.equal(estimateYaw(face(NaN)), null);
  const collapsed = face(); collapsed[263] = collapsed[33];
  assert.equal(estimateYaw(collapsed), null);
});

test('a tilted resting position calibrates to neutral and recenter releases output', () => {
  const control = new Steering({ smoothingMs: 0 });
  control.sample(0.17, 0);
  assert.equal(control.output(0).ready, false);
  calibrate(control, 0.17);
  control.sample(0.17, 1100);
  assert.ok(Math.abs(control.neutral - 0.17) < 1e-10);
  assert.equal(control.output(1100).down, false);
  control.sample(0.7, 1200);
  assert.equal(control.output(1200).down, true);
  control.recenter();
  assert.equal(control.output(1201).ready, false);
  assert.equal(control.output(1201).down, false);
});

test('calibration requires continuous face samples, including when frames stall', () => {
  const control = new Steering();
  for (let t = 0; t < 1000; t += 100) control.sample(0, t);
  control.sample(null, 1000);
  control.sample(0, 2000);
  assert.equal(control.neutral, null);
  calibrate(control, 0, 2000);
  assert.equal(control.neutral, 0);
  control.recenter();
  control.sample(0, 0);
  control.sample(0, 2000);
  assert.equal(control.neutral, null);
});

test('dead zone, full threshold and inversion control the transmitted strength', () => {
  const control = new Steering({ smoothingMs: 0 });
  calibrate(control);
  control.sample(0.05, 1100);
  assert.equal(control.output(1100).strength, 0);
  control.sample(0.18, 1200);
  assert.ok(Math.abs(control.output(1200).strength - 0.5) < 1e-10);
  assert.equal(control.output(1200).action, 'tiltRight');
  control.configure({ full: 0.48, invert: true });
  control.sample(0.18, 1300);
  assert.ok(Math.abs(control.output(1300).strength - 0.25) < 1e-10);
  assert.equal(control.output(1300).action, 'tiltLeft');
  assert.throws(() => control.configure({ full: 0.08 }));
  assert.throws(() => control.configure({ deadzone: NaN }));
});

test('smoothing steadies active turns but neutral and missing faces release immediately', () => {
  const control = new Steering({ smoothingMs: 120 });
  calibrate(control);
  control.sample(0.28, 1100);
  assert.ok(control.steer > 0 && control.steer < 1);
  control.sample(0, 1200);
  assert.equal(control.output(1200).strength, 0);
  control.sample(0.28, 1300);
  control.sample(null, 1325);
  assert.equal(control.output(1325).down, false);
  assert.equal(control.output(1325).ready, false);
  control.sample(0.28, 1400);
  control.sample(0.28, 1425);
  assert.ok(control.output(1425).strength > 0);
  assert.equal(control.output(1800).down, false, 'stalled video also releases');
});

test('partial steering pulses both down and up while full steering stays held', () => {
  const control = new Steering({ smoothingMs: 0 });
  calibrate(control);
  const half = [], full = [];
  for (let t = 1200; t < 1350; t += 25) {
    control.sample(0.18, t);
    half.push(control.output(t).down);
  }
  for (let t = 1350; t < 1500; t += 25) {
    control.sample(0.28, t);
    full.push(control.output(t).down);
  }
  assert.deepEqual(half, [true, true, true, false, false, false]);
  assert.ok(full.every(Boolean));
});

test('sender releases before reversing, refreshes holds and resets after a failed send', () => {
  const events = [];
  let online = true;
  const sender = new SteeringSender((...event) => { if (!online) return false; events.push(event); return true; });
  sender.update({ action: 'tiltLeft', down: true, strength: 1 }, 0);
  sender.update({ action: 'tiltLeft', down: true, strength: 1 }, 50);
  assert.equal(events.length, 1);
  sender.update({ action: 'tiltLeft', down: true, strength: 1 }, 100);
  assert.equal(events.length, 2);
  sender.update({ action: 'tiltRight', down: true, strength: 1 }, 125);
  assert.deepEqual(events.slice(-2).map((e) => e.slice(0, 2)), [['tiltLeft', 'up'], ['tiltRight', 'down']]);
  sender.release();
  assert.equal(sender.held, null);
  online = false;
  sender.update({ action: 'tiltLeft', down: true, strength: 1 }, 200);
  assert.equal(sender.held, null);
  online = true;
  sender.update({ action: 'tiltLeft', down: true, strength: 1 }, 225);
  assert.equal(sender.held, 'tiltLeft');
});

test('camera output passes through a custom remap without phone or voice inputs', async () => {
  const delivered = [];
  const receiver = new CameraKeys((code, state) => delivered.push([code, state]));
  const remap = { tiltLeft: 'KeyD', tiltRight: 'KeyA' };
  const sender = new SteeringSender((action, state) => { receiver.apply(action, remap[action], state); return true; });
  const control = new Steering({ smoothingMs: 0 });
  calibrate(control);
  control.sample(-0.28, 1200);
  sender.update(control.output(1200), 1200);
  control.sample(0, 1250);
  sender.update(control.output(1250), 1250);
  await receiver.pending;
  assert.deepEqual(delivered, [['KeyD', 'down'], ['KeyD', 'up']]);
  await receiver.releaseAll();
});
