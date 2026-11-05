import test from 'node:test';
import assert from 'node:assert/strict';
import { CameraKeys } from '../lib/camera-keys.js';

function fixture(send) {
  const events = [], timers = new Map();
  let nextTimer = 0;
  const receiver = new CameraKeys(send || ((...event) => events.push(event)), {
    setTimer(callback) { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimer(id) { timers.delete(id); },
  });
  return { receiver, events, timers, expire() { for (const fn of [...timers.values()]) fn(); } };
}

test('missing camera refresh expires and releases the mapped game key', async () => {
  const { receiver, events, expire } = fixture();
  await receiver.apply('tiltLeft', 'KeyA', 'down');
  expire();
  await receiver.pending;
  assert.deepEqual(events, [['KeyA', 'down'], ['KeyA', 'up']]);
});

test('refresh replaces the lease without repeated game keydowns', async () => {
  const { receiver, events, timers, expire } = fixture();
  await receiver.apply('tiltLeft', 'KeyA', 'down');
  const oldTimer = [...timers.keys()][0];
  await receiver.apply('tiltLeft', 'KeyA', 'down');
  assert.equal(timers.has(oldTimer), false);
  assert.equal(timers.size, 1);
  assert.deepEqual(events, [['KeyA', 'down']]);
  expire(); await receiver.pending;
  assert.deepEqual(events.at(-1), ['KeyA', 'up']);
});

test('release uses the originally held code when the player changes remapping', async () => {
  const { receiver, events, timers } = fixture();
  await receiver.apply('tiltLeft', 'KeyA', 'down');
  await receiver.apply('tiltLeft', 'KeyD', 'up');
  assert.deepEqual(events, [['KeyA', 'down'], ['KeyA', 'up']]);
  assert.equal(timers.size, 0);
  await receiver.apply('tiltLeft', 'KeyA', 'down');
  await receiver.apply('tiltLeft', 'KeyD', 'down');
  assert.deepEqual(events.slice(-2), [['KeyA', 'up'], ['KeyD', 'down']]);
  await receiver.releaseAll();
});

test('two camera actions mapped to the same key do not release one another', async () => {
  const { receiver, events } = fixture();
  await receiver.apply('tiltLeft', 'KeyW', 'down');
  await receiver.apply('tiltRight', 'KeyW', 'down');
  await receiver.apply('tiltLeft', 'KeyW', 'up');
  assert.deepEqual(events, [['KeyW', 'down']]);
  await receiver.releaseAll();
  assert.deepEqual(events.at(-1), ['KeyW', 'up']);
});

test('disconnect releases all keys and cancels pending expiry timers', async () => {
  const { receiver, events, timers } = fixture();
  await receiver.apply('tiltLeft', 'KeyA', 'down');
  await receiver.apply('tiltRight', 'KeyD', 'down');
  await receiver.releaseAll();
  assert.equal(timers.size, 0);
  assert.deepEqual(events.slice(-2), [['KeyA', 'up'], ['KeyD', 'up']]);
});

test('delivery stays ordered even when tab messaging is asynchronous', async () => {
  const events = [];
  const { receiver } = fixture(async (code, state) => {
    await new Promise((resolve) => setTimeout(resolve, state === 'down' ? 10 : 0));
    events.push([code, state]);
  });
  receiver.apply('tiltLeft', 'KeyA', 'down');
  receiver.apply('tiltLeft', 'KeyA', 'up');
  await receiver.pending;
  assert.deepEqual(events, [['KeyA', 'down'], ['KeyA', 'up']]);
});
