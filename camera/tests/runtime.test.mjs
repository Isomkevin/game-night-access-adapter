// Run the real browser modules with fake camera/Chrome surfaces, without hardware.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(setImmediate); };

class Surface {
  constructor() { this.listeners = {}; this.textContent = ''; this.disabled = false; this.value = ''; this.checked = false; }
  addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
  fire(type, event = {}) { return Promise.all((this.listeners[type] || []).map((callback) => callback(event))); }
  checkValidity() { return true; }
}

function sockets() {
  const instances = [];
  class Socket extends Surface {
    static OPEN = 1; static CONNECTING = 0;
    constructor() { super(); this.readyState = 0; this.sent = []; instances.push(this); }
    send(data) { this.sent.push(JSON.parse(data)); }
    open() { this.readyState = 1; return this.fire('open'); }
    close() { this.readyState = 3; return this.fire('close'); }
    message(data) { return this.fire('message', { data: JSON.stringify(data) }); }
  }
  return { Socket, instances };
}

async function load(path, globals, dynamicSource) {
  const context = vm.createContext({ console, ...globals });
  const modules = new Map();
  async function moduleAt(url) {
    if (modules.has(url.href)) return modules.get(url.href);
    const source = await readFile(url, 'utf8');
    const module = new vm.SourceTextModule(source, {
      context, identifier: url.href,
      importModuleDynamically: async () => {
        const dynamic = new vm.SourceTextModule(dynamicSource, { context });
        await dynamic.link(() => { throw new Error('Unexpected dynamic dependency'); });
        await dynamic.evaluate();
        return dynamic;
      },
    });
    modules.set(url.href, module);
    return module;
  }
  const entry = await moduleAt(new URL(path, root));
  await entry.link((specifier, parent) => moduleAt(new URL(specifier, parent.identifier)));
  await entry.evaluate();
  await flush();
  context.exports = entry.namespace;
  return context;
}

async function cameraFixture({ deny = false, pendingPermission = false, failGpu = false, failModel = false } = {}) {
  const elements = new Map();
  const document = new Surface(), window = new Surface();
  document.hidden = false;
  document.getElementById = (id) => {
    if (!elements.has(id)) elements.set(id, new Surface());
    return elements.get(id);
  };
  const el = document.getElementById;
  el('overlay').getContext = () => ({ clearRect() {} });
  Object.assign(el('video'), { videoWidth: 640, videoHeight: 480, readyState: 2, currentTime: 0, play: async () => {} });
  const videoTrack = new Surface();
  videoTrack.stops = 0;
  videoTrack.stop = () => videoTrack.stops++;
  const stream = { getTracks: () => [videoTrack], getVideoTracks: () => [videoTrack] };
  const tracker = { closes: 0, close() { this.closes++; }, detectForVideo: () => ({ faceLandmarks: [] }) };
  const delegates = [];
  const intervals = new Map(), timers = new Map();
  let nextId = 0, clock = 0, permissionResolve;
  const { Socket, instances } = sockets();
  const requests = [];
  await load('camera/head-steering.js', {
    document, window, location: { protocol: 'http:', host: '127.0.0.1:18765' },
    WebSocket: Socket, performance: { now: () => clock },
    setTimeout: (callback) => { timers.set(++nextId, callback); return nextId; }, clearTimeout: (id) => timers.delete(id),
    setInterval: (callback) => { intervals.set(++nextId, callback); return nextId; }, clearInterval: (id) => intervals.delete(id),
    navigator: { mediaDevices: { getUserMedia: async (options) => {
      requests.push(options);
      if (deny) throw Object.assign(new Error('blocked'), { name: 'NotAllowedError' });
      if (pendingPermission) return new Promise((resolve) => { permissionResolve = resolve; });
      return stream;
    } } },
    fixture: { tracker, delegates, failGpu, failModel },
  }, `
    export const FilesetResolver = { forVisionTasks: async () => ({}) };
    export const FaceLandmarker = { FACE_LANDMARKS_TESSELATION: [], createFromOptions: async (_, options) => {
      fixture.delegates.push(options.baseOptions.delegate);
      if (fixture.failModel || (fixture.failGpu && options.baseOptions.delegate === 'GPU')) throw new Error('fake unavailable delegate');
      return fixture.tracker;
    } };
    export class DrawingUtils { drawConnectors() {} }
  `);
  return { el, document, window, instances, intervals, timers, tracker, videoTrack, requests, delegates,
    permission: () => permissionResolve?.(stream),
    tick(now) { clock = now; el('video').currentTime = now / 1000; for (const callback of intervals.values()) callback(); },
  };
}

test('camera starts on request, falls back to CPU, releases on hidden page and stops cleanly', async () => {
  const f = await cameraFixture({ failGpu: true });
  assert.equal(f.requests.length, 0, 'no permission request before Start');
  await f.instances[0].open();
  await f.el('start').fire('click');
  assert.deepEqual(f.delegates, ['GPU', 'CPU']);
  assert.equal(f.requests[0].audio, false);
  assert.equal(f.intervals.size, 1);
  const points = [];
  points[33] = { x: 0.3, y: 0.4 }; points[263] = { x: 0.7, y: 0.4 }; points[1] = { x: 0.5, y: 0.6 };
  f.tracker.detectForVideo = () => ({ faceLandmarks: [points] });
  for (let now = 0; now <= 1000; now += 100) f.tick(now);
  points[1].x = 0.2;
  for (let now = 1100; now <= 1500; now += 100) f.tick(now);
  assert.ok(f.instances[0].sent.some((msg) => msg.action === 'tiltRight' && msg.state === 'down'));
  f.document.hidden = true;
  await f.document.fire('visibilitychange');
  assert.equal(f.instances[0].sent.at(-1).state, 'up');
  assert.match(f.el('status').textContent, /hidden/);
  await f.el('stop').fire('click');
  assert.equal(f.videoTrack.stops, 1);
  assert.equal(f.tracker.closes, 1);
  assert.equal(f.intervals.size, 0);
  assert.equal(f.el('start').disabled, false);
});

test('denied permissions and model errors leave a retryable page with no tracker leak', async () => {
  for (const options of [{ deny: true }, { failModel: true }]) {
    const f = await cameraFixture(options);
    await f.el('start').fire('click');
    assert.equal(f.el('start').disabled, false);
    assert.equal(f.intervals.size, 0);
    assert.match(f.el('status').textContent, options.deny ? /permission blocked/ : /could not start/);
    if (options.deny) assert.equal(f.tracker.closes, 1);
  }
});

test('stopping while permission is pending disposes the later stream', async () => {
  const f = await cameraFixture({ pendingPermission: true });
  const start = f.el('start').fire('click');
  await flush();
  await f.el('stop').fire('click');
  f.permission();
  await start;
  assert.equal(f.videoTrack.stops, 1);
  assert.equal(f.tracker.closes, 1);
  assert.equal(f.intervals.size, 0);
});

test('camera reconnect identifies itself and releases both old logical actions', async () => {
  const f = await cameraFixture();
  await f.instances[0].open();
  await f.instances[0].close();
  for (const callback of [...f.timers.values()]) callback();
  assert.equal(f.instances.length, 2);
  await f.instances[1].open();
  assert.equal(f.instances[1].sent[0].role, 'camera');
  assert.deepEqual(f.instances[1].sent.slice(1).map((msg) => [msg.action, msg.state]), [['tiltLeft', 'up'], ['tiltRight', 'up']]);
  await f.window.fire('pagehide');
});

test('real extension background remaps camera inputs and releases them on disconnect without releasing voice', async () => {
  const { Socket, instances } = sockets();
  const delivered = [], timers = new Map();
  let nextTimer = 0;
  const settings = {};
  const session = {};
  const event = () => ({ addListener() {} });
  await load('extension/background.js', {
    WebSocket: Socket,
    setTimeout: (callback) => { timers.set(++nextTimer, callback); return nextTimer; },
    clearTimeout: (id) => timers.delete(id),
    chrome: {
      storage: {
        local: { get: async () => ({ ...settings }), set: async (patch) => Object.assign(settings, patch) },
        session: {
          get: async (keys) => {
            const wanted = Array.isArray(keys) ? keys : [keys];
            return Object.fromEntries(wanted.map((key) => [key, session[key]]));
          },
          set: async (patch) => Object.assign(session, patch),
          remove: async (keys) => {
            for (const key of Array.isArray(keys) ? keys : [keys]) delete session[key];
          },
        },
        onChanged: event(),
      },
      runtime: { onInstalled: event(), onStartup: event(), onMessage: event() },
      action: { setBadgeText() {}, setBadgeBackgroundColor() {} },
      tabs: {
        query: async () => [{ id: 99 }],
        sendMessage: async (_tab, message) => delivered.push(message),
        onRemoved: event(),
      },
    },
  });
  await instances[0].open();
  await instances[0].message({ type: 'input', source: 'camera', action: 'tiltLeft', state: 'down', strength: 1 });
  await flush();
  assert.deepEqual(delivered.map((msg) => [msg.code, msg.state]), [['KeyA', 'down']]);
  settings.remap['camera:tiltLeft'] = 'steerRight';
  await instances[0].message({ type: 'input', source: 'camera', action: 'tiltLeft', state: 'up' });
  await flush();
  assert.deepEqual([delivered.at(-1).code, delivered.at(-1).state], ['KeyA', 'up']);
  await instances[0].message({ type: 'input', source: 'camera', action: 'tiltLeft', state: 'down' });
  await instances[0].message({ type: 'input', source: 'voice', action: 'go', state: 'down' });
  await flush();
  await instances[0].close();
  await flush();
  assert.deepEqual(delivered.filter((msg) => msg.code === 'KeyD').map((msg) => msg.state), ['down', 'up']);
  assert.deepEqual(delivered.filter((msg) => msg.code === 'KeyW').map((msg) => msg.state), ['down']);
});

test('merged extension accepts setRemap, camera pulses, disabled-binding release, status and stop-all', async () => {
  const { Socket, instances } = sockets();
  const delivered = [], timers = new Map(), messageListeners = [];
  let nextTimer = 0;
  const settings = {};
  const session = {};
  const event = () => ({ addListener() {} });
  await load('extension/background.js', {
    WebSocket: Socket,
    setTimeout: (callback, ms) => { timers.set(++nextTimer, { callback, ms }); return nextTimer; },
    clearTimeout: (id) => timers.delete(id),
    chrome: {
      storage: {
        local: { get: async () => ({ ...settings }), set: async (patch) => Object.assign(settings, patch) },
        session: {
          get: async (keys) => {
            const wanted = Array.isArray(keys) ? keys : [keys];
            return Object.fromEntries(wanted.map((key) => [key, session[key]]));
          },
          set: async (patch) => Object.assign(session, patch),
          remove: async (keys) => {
            for (const key of Array.isArray(keys) ? keys : [keys]) delete session[key];
          },
        },
        onChanged: event(),
      },
      runtime: { onInstalled: event(), onStartup: event(), onMessage: { addListener: (fn) => messageListeners.push(fn) } },
      action: { setBadgeText() {}, setBadgeBackgroundColor() {} },
      tabs: {
        query: async () => [{ id: 99 }],
        sendMessage: async (_tab, message) => delivered.push(message),
        onRemoved: event(),
      },
    },
  });
  const socket = instances[0];
  await socket.open();
  await socket.message({ type: 'setRemap', entries: { 'camera:blinkLeft': 'pause' }, merge: true });
  await flush();
  assert.equal(settings.remap['camera:blinkLeft'], 'pause');
  await socket.message({ type: 'input', source: 'camera', action: 'blinkLeft', state: 'pulse' });
  await flush();
  assert.deepEqual([delivered.at(-1).code, delivered.at(-1).state], ['Escape', 'down']);
  const pulseTimer = [...timers.values()].find((timer) => timer.ms === 120);
  assert.ok(pulseTimer, 'pulse has a bounded release timer');
  pulseTimer.callback();
  await flush();
  assert.deepEqual([delivered.at(-1).code, delivered.at(-1).state], ['Escape', 'up']);
  await socket.message({ type: 'input', source: 'camera', action: 'tiltLeft', state: 'down' });
  await flush();
  settings.remap['camera:tiltLeft'] = '';
  await socket.message({ type: 'input', source: 'camera', action: 'tiltLeft', state: 'up' });
  await flush();
  assert.deepEqual([delivered.at(-1).code, delivered.at(-1).state], ['KeyA', 'up']);
  let status;
  messageListeners[0]({ type: 'gnaa-get-status' }, {}, (result) => { status = result; });
  await flush();
  assert.equal(status.gameTabCount, 1);
  assert.equal(status.workerOk, true);
  await socket.message({ type: 'input', source: 'camera', action: 'tiltRight', state: 'down' });
  await flush();
  let stopped;
  messageListeners[0]({ type: 'gnaa-release-all' }, {}, (result) => { stopped = result; });
  await flush();
  assert.equal(stopped.ok, true);
  assert.equal(delivered.at(-1).type, 'gnaa-release-all');
  assert.equal(timers.size, 0);
  await socket.close();
});

test('vision toggle gestures refresh only on fresh frames, preserve remap messages, and release on dispose', async () => {
  const { Socket, instances } = sockets();
  const module = await load('camera/lib/emitter.js', {
    WebSocket: Socket,
    location: { protocol: 'http:', host: '127.0.0.1:18765' },
    performance: { now: () => 0 }, setTimeout() {},
  });
  const emitter = module.exports.createEmitter();
  await instances[0].open();
  emitter.refresh(0);
  emitter.emit('mouthOpen', 'down');
  const count = instances[0].sent.length;
  emitter.refresh(50);
  assert.equal(instances[0].sent.length, count);
  emitter.refresh(100);
  assert.equal(instances[0].sent.at(-1).action, 'mouthOpen');
  assert.equal(instances[0].sent.at(-1).state, 'down');
  emitter.setRemap({ 'camera:mouthOpen': 'throttle' });
  assert.equal(instances[0].sent.at(-1).type, 'setRemap');
  emitter.dispose();
  assert.equal(instances[0].sent.at(-1).state, 'up');
  assert.equal(emitter.getHeld().size, 0);
});
