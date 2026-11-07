import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { CameraKeys } from '../lib/camera-keys.js';

test('default browser timers retain their global receiver for holds, refresh, pulses and stop', async () => {
  const context = vm.createContext({ console });
  // WebIDL browser timers reject calls whose receiver is a CameraKeys instance.
  vm.runInContext(`
    'use strict';
    globalThis.timers = new Map();
    let nextTimer = 0;
    globalThis.setTimeout = function(callback, delay) {
      if (this !== globalThis) throw new TypeError('Illegal invocation');
      const id = ++nextTimer;
      timers.set(id, { callback, delay });
      return id;
    };
    globalThis.clearTimeout = function(id) {
      if (this !== globalThis) throw new TypeError('Illegal invocation');
      timers.delete(id);
    };
  `, context);
  const module = new vm.SourceTextModule(await readFile(new URL('../lib/camera-keys.js', import.meta.url), 'utf8'), { context });
  await module.link(() => { throw new Error('Unexpected dependency'); });
  await module.evaluate();
  const events = [];
  const receiver = new module.namespace.CameraKeys((code, state) => events.push([code, state]));
  await receiver.apply('tiltLeft', 'KeyA', 'down');
  await receiver.apply('tiltLeft', 'KeyA', 'down');
  assert.equal(context.timers.size, 1);
  assert.equal([...context.timers.values()][0].delay, 800);
  await receiver.release('tiltLeft');
  assert.equal(context.timers.size, 0);
  await receiver.apply('blinkLeft', 'Escape', 'pulse');
  const pulse = [...context.timers.values()][0];
  assert.equal(pulse.delay, 120);
  pulse.callback();
  await receiver.pending;
  await receiver.apply('tiltRight', 'KeyD', 'down');
  await receiver.releaseAll();
  assert.equal(context.timers.size, 0);
  assert.deepEqual(events, [
    ['KeyA', 'down'], ['KeyA', 'up'],
    ['Escape', 'down'], ['Escape', 'up'],
    ['KeyD', 'down'], ['KeyD', 'up'],
  ]);
});

function fixture(send) {
  const events = [], timers = new Map(), delays = [];
  let nextTimer = 0;
  const receiver = new CameraKeys(send || ((...event) => events.push(event)), {
    setTimer(callback, ms) { const id = ++nextTimer; timers.set(id, callback); delays.push(ms); return id; },
    clearTimer(id) { timers.delete(id); },
  });
  return { receiver, events, timers, delays, expire() { for (const fn of [...timers.values()]) fn(); } };
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

test('camera pulse gestures release after 120 ms and can retrigger a held action', async () => {
  const { receiver, events, delays, timers, expire } = fixture();
  await receiver.apply('blinkLeft', 'Escape', 'pulse');
  assert.equal(delays.at(-1), 120);
  assert.equal(timers.size, 1);
  assert.deepEqual(events, [['Escape', 'down']]);
  await receiver.apply('blinkLeft', 'Escape', 'pulse');
  assert.deepEqual(events.slice(-2), [['Escape', 'up'], ['Escape', 'down']]);
  expire(); await receiver.pending;
  assert.deepEqual(events.at(-1), ['Escape', 'up']);
  assert.equal(timers.size, 0);
});
