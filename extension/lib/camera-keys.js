// Camera-only receiver lease: a lost tab/socket must not leave a steering key held.
// Down events are refreshed by the camera at least every 100 ms while held.
export class CameraKeys {
  constructor(send, { timeoutMs = 800, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
    this.send = send;
    this.timeoutMs = timeoutMs;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.held = new Map();
    this.pending = Promise.resolve();
  }

  emit(code, state) {
    this.pending = this.pending.then(() => this.send(code, state)).catch((error) => console.error('[Camera] Key delivery failed', error));
    return this.pending;
  }

  apply(action, code, state) {
    const old = this.held.get(action);
    if (old && (state !== 'down' || old.code !== code)) this.release(action);
    if (state !== 'down') return this.pending;
    const current = this.held.get(action);
    if (current) this.clearTimer(current.timer);
    else {
      if (![...this.held.values()].some((held) => held.code === code)) this.emit(code, 'down');
      this.held.set(action, { code, timer: null });
    }
    const held = this.held.get(action);
    held.timer = this.setTimer(() => this.release(action), this.timeoutMs);
    return this.pending;
  }

  release(action) {
    const held = this.held.get(action);
    if (!held) return;
    this.clearTimer(held.timer);
    this.held.delete(action);
    if (![...this.held.values()].some((other) => other.code === held.code)) this.emit(held.code, 'up');
  }

  releaseAll() {
    for (const action of [...this.held.keys()]) this.release(action);
    return this.pending;
  }
}
