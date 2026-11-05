// Pure camera control logic. No camera, DOM, speech, or native dependencies.
export const YAW_DEADZONE = 0.08;
export const YAW_FULL = 0.28;
export const DEFAULTS = Object.freeze({
  deadzone: YAW_DEADZONE, full: YAW_FULL, smoothingMs: 120,
  calibrateMs: 1000, faceLostMs: 300, periodMs: 150, invert: false,
});

// Project the nose onto the eye line so head roll does not become yaw.
// Positive is toward the person's right (left in the unmirrored image).
// This is a normalized yaw proxy, not an angle in degrees.
export function estimateYaw(points, width = 1, height = 1) {
  const r = points?.[33], l = points?.[263], nose = points?.[1];
  if (![r, l, nose].every((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))) return null;
  const dx = (l.x - r.x) * width, dy = (l.y - r.y) * height;
  const distance2 = dx * dx + dy * dy;
  if (distance2 < 1e-10) return null;
  return ((((r.x + l.x) / 2 - nose.x) * width) * dx +
    (((r.y + l.y) / 2 - nose.y) * height) * dy) / distance2;
}

export class Steering {
  constructor(settings = {}) {
    this.settings = { ...DEFAULTS, ...settings };
    this.configure({});
    this.recenter();
  }

  configure(settings) {
    const next = { ...this.settings, ...settings };
    if (!Number.isFinite(next.deadzone) || next.deadzone < 0 ||
        !Number.isFinite(next.full) || next.full <= next.deadzone) {
      throw new Error('Full steering must be greater than the dead zone (both are normalized ratios).');
    }
    this.settings = next;
  }

  recenter() {
    this.neutral = null;
    this.samples = [];
    this.calibrateFrom = null;
    this.lastFaceAt = null;
    this.lastSampleAt = null;
    this.yaw = 0;
    this.steer = 0;
  }

  loseFace() {
    this.lastFaceAt = null;
    this.lastSampleAt = null;
    this.yaw = 0;
    this.steer = 0;
    if (this.neutral === null) {
      this.samples = [];
      this.calibrateFrom = null;
    }
  }

  sample(yaw, now) {
    if (!Number.isFinite(yaw)) { this.loseFace(); return; }
    if (this.lastFaceAt !== null && now - this.lastFaceAt > this.settings.faceLostMs) this.loseFace();
    const dt = this.lastSampleAt === null ? 0 : now - this.lastSampleAt;
    this.lastFaceAt = this.lastSampleAt = now;
    if (this.neutral === null) {
      this.calibrateFrom ??= now;
      this.samples.push(yaw);
      if (now - this.calibrateFrom >= this.settings.calibrateMs && this.samples.length >= 10) {
        this.neutral = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
        this.samples = [];
      }
      return;
    }
    this.yaw = (yaw - this.neutral) * (this.settings.invert ? -1 : 1);
    const magnitude = Math.max(0, Math.abs(this.yaw) - this.settings.deadzone);
    const target = Math.sign(this.yaw) * Math.min(1, magnitude / (this.settings.full - this.settings.deadzone));
    const k = this.settings.smoothingMs > 0 ? 1 - Math.exp(-dt / this.settings.smoothingMs) : 1;
    this.steer += (target - this.steer) * k;
    // Release immediately on entering neutral; smoothing is for active turns.
    if (!magnitude) this.steer = 0;
  }

  output(now) {
    if (this.lastFaceAt !== null && now - this.lastFaceAt > this.settings.faceLostMs) this.loseFace();
    const ready = this.neutral !== null && this.lastFaceAt !== null;
    const strength = ready ? Math.abs(this.steer) : 0;
    const phase = (now % this.settings.periodMs) / this.settings.periodMs;
    return {
      ready, strength,
      action: strength > 0 ? (this.steer < 0 ? 'tiltLeft' : 'tiltRight') : null,
      down: strength > 0 && (strength >= 0.98 || phase < strength),
    };
  }
}

// Pulse on the sender side, retaining the shared down/up protocol and remap.
// Repeat held downs every 100 ms so the extension can expire stale inputs.
export class SteeringSender {
  constructor(send) { this.send = send; this.held = null; this.lastSentAt = -Infinity; }

  update(output, now) {
    const next = output.down ? output.action : null;
    if (this.held && this.held !== next) {
      this.send(this.held, 'up', 0);
      this.held = null;
    }
    if (next && (this.held !== next || now - this.lastSentAt >= 100)) {
      if (this.send(next, 'down', output.strength)) {
        this.held = next;
        this.lastSentAt = now;
      }
    }
  }

  release() {
    // Also clears a missed release after reconnect or an extension restart.
    this.send('tiltLeft', 'up', 0);
    this.send('tiltRight', 'up', 0);
    this.held = null;
    this.lastSentAt = -Infinity;
  }
}
