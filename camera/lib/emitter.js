/**
 * Bridge WebSocket emitter for camera logical inputs.
 * Tracks held actions and can release-all on disconnect / pause / lost tracking.
 */

/**
 * @param {object} opts
 * @param {string} [opts.wsUrl]
 * @param {(status: string) => void} [opts.onStatus]
 */
export function createEmitter(opts = {}) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const wsUrl = opts.wsUrl || `${proto}://${location.host}`;
  /** @type {WebSocket|null} */
  let socket = null;
  /** @type {Set<string>} */
  const held = new Set();
  let closed = false;

  function send(msg) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(msg));
    }
  }

  function connect() {
    if (closed) return;
    socket = new WebSocket(wsUrl);
    socket.addEventListener('open', () => {
      if (opts.onStatus) opts.onStatus('connected');
      send({ type: 'hello', role: 'camera', v: 1, ts: Date.now() });
    });
    socket.addEventListener('close', () => {
      if (opts.onStatus) opts.onStatus('disconnected');
      releaseAll();
      socket = null;
      if (!closed) setTimeout(connect, 2000);
    });
    socket.addEventListener('error', () => {
      try {
        socket?.close();
      } catch {
        /* ignore */
      }
    });
  }

  /**
   * @param {string} action
   * @param {'down'|'up'|'pulse'} state
   * @param {number} [strength]
   */
  function emit(action, state, strength = 1) {
    if (state === 'down') held.add(action);
    if (state === 'up' || state === 'pulse') held.delete(action);
    // pulse should not leave held — already deleted
    if (state === 'pulse') {
      // ok
    }
    send({
      type: 'input',
      source: 'camera',
      action,
      state,
      strength,
      ts: Date.now(),
      v: 1,
    });
  }

  function releaseAll() {
    for (const action of [...held]) {
      send({
        type: 'input',
        source: 'camera',
        action,
        state: 'up',
        strength: 0,
        ts: Date.now(),
        v: 1,
      });
    }
    held.clear();
  }

  /**
   * Push remap entries to the extension via the bridge.
   * @param {Record<string, string>} entries  e.g. { "camera:mouthOpen": "throttle" }
   * @param {boolean} [merge]
   */
  function setRemap(entries, merge = true) {
    send({
      type: 'setRemap',
      entries,
      merge,
      v: 1,
      ts: Date.now(),
    });
  }

  function dispose() {
    closed = true;
    releaseAll();
    try {
      socket?.close();
    } catch {
      /* ignore */
    }
  }

  connect();

  return {
    emit,
    releaseAll,
    setRemap,
    dispose,
    getHeld: () => new Set(held),
  };
}
