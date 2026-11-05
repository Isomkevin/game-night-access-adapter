import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { Steering, SteeringSender } from '../steering.js';

const require = createRequire(new URL('../../bridge/package.json', import.meta.url));
const { WebSocket } = require('ws');
const once = (target, type) => new Promise((resolve, reject) => {
  target.once(type, resolve); target.once('error', reject);
});

test('real bridge serves the camera page and relays camera-only steering to an extension client', { timeout: 15000 }, async (t) => {
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const process = spawn(globalThis.process.execPath, ['server.js'], {
    cwd: fileURLToPath(new URL('../../bridge/', import.meta.url)),
    env: { ...globalThis.process.env, GNAA_PORT: String(port) }, windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(async () => {
    if (process.exitCode !== null) return;
    const exited = once(process, 'exit');
    process.kill();
    await exited;
  });
  await new Promise((resolve, reject) => {
    let log = '';
    process.stdout.on('data', (data) => { log += data; if (log.includes('Game Night bridge on')) resolve(); });
    process.stderr.on('data', (data) => { log += data; });
    process.once('error', reject);
    process.once('exit', (code) => reject(new Error(`Bridge exited (${code}): ${log}`)));
  });
  const origin = `http://127.0.0.1:${port}`;
  const page = await fetch(`${origin}/camera/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /id="setup"/);
  const headPage = await fetch(`${origin}/camera/head-steering.html`);
  assert.equal(headPage.status, 200);
  assert.match(await headPage.text(), /id="recenter"/);
  for (const file of ['camera.js', 'head-steering.js', 'steering.js']) {
    const response = await fetch(`${origin}/camera/${file}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /javascript/);
  }
  const extension = new WebSocket(`ws://127.0.0.1:${port}`);
  const camera = new WebSocket(`ws://127.0.0.1:${port}`);
  t.after(() => { extension.terminate(); camera.terminate(); });
  await Promise.all([once(extension, 'open'), once(camera, 'open')]);
  extension.send(JSON.stringify({ type: 'hello', role: 'extension', v: 1 }));
  camera.send(JSON.stringify({ type: 'hello', role: 'camera', v: 1 }));
  // Status delivery confirms the bridge has registered the receiving role.
  await new Promise((resolve) => {
    const listener = (raw) => {
      const message = JSON.parse(raw);
      if (message.type === 'status' && message.clients.extension === 1 && message.clients.camera === 1) {
        extension.off('message', listener); resolve();
      }
    };
    extension.on('message', listener);
  });
  const events = [];
  const received = new Promise((resolve) => extension.on('message', (raw) => {
    const message = JSON.parse(raw);
    if (message.type === 'input') { events.push(message); if (events.length === 2) resolve(); }
  }));
  const sender = new SteeringSender((action, state, strength) => {
    camera.send(JSON.stringify({ type: 'input', source: 'camera', action, state, strength, v: 1, ts: Date.now() }));
    return true;
  });
  const control = new Steering({ smoothingMs: 0 });
  for (let now = 0; now <= 1000; now += 100) control.sample(0, now);
  control.sample(-0.28, 1200);
  sender.update(control.output(1200), 1200);
  control.sample(0, 1250);
  sender.update(control.output(1250), 1250);
  await received;
  assert.deepEqual(events.map((event) => [event.source, event.action, event.state]), [
    ['camera', 'tiltLeft', 'down'], ['camera', 'tiltLeft', 'up'],
  ]);
  const health = await (await fetch(`${origin}/health`)).json();
  assert.equal(health.clients.phone, undefined);
  assert.equal(health.clients.voice, undefined);
  assert.equal(health.clients.camera, 1);
});
