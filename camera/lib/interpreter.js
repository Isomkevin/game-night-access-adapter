/**
 * Turn continuous signals into discrete gesture events with
 * smoothing, hysteresis, debounce, and hold/pulse/toggle modes.
 */

import { gestureById } from './catalog.js';

/**
 * @typedef {object} GestureEvent
 * @property {string} id
 * @property {'down'|'up'|'pulse'} state
 * @property {number} strength
 */

/**
 * @typedef {object} GestureRuntimeConfig
 * @property {boolean} enabled
 * @property {'hold'|'pulse'|'toggle'} mode
 * @property {number} activate
 * @property {number} release
 * @property {number} [smooth] EMA alpha 0..1
 * @property {number} [cooldownMs]
 * @property {number} [minActiveMs]
 * @property {boolean} [proportional] Head steering: vary key duty with movement.
 * @property {number} [full] Signal magnitude for continuous steering.
 */

/**
 * @param {Record<string, GestureRuntimeConfig>} gestureConfigs  keyed by gesture id
 */
export function createInterpreter(gestureConfigs) {
  /** @type {Map<string, { smoothed: number, active: boolean, toggled: boolean, lastFire: number, activeSince: number }>} */
  const state = new Map();

  function ensure(id) {
    if (!state.has(id)) {
      state.set(id, {
        smoothed: 0,
        active: false,
        toggled: false,
        lastFire: 0,
        activeSince: 0,
        pressed: false,
      });
    }
    return state.get(id);
  }

  /**
   * @param {Record<string, number>} signals
   * @param {number} now
   * @returns {GestureEvent[]}
   */
  function update(signals, now = performance.now()) {
    /** @type {GestureEvent[]} */
    const events = [];

    for (const [id, cfg] of Object.entries(gestureConfigs)) {
      if (!cfg?.enabled) {
        const st = state.get(id);
        if (st?.active) {
          st.active = false;
          st.pressed = false;
          events.push({ id, state: 'up', strength: 0 });
        }
        continue;
      }

      const def = gestureById(id);
      if (!def) continue;

      const raw = signals[def.signal] ?? 0;
      const polarity = def.polarity ?? 1;
      const value = polarity < 0 ? -raw : raw;

      const st = ensure(id);
      if (cfg.proportional) {
        // Use the same fresh signal as the preview, without EMA trailing the head.
        // Activation/release hysteresis keeps small neutral-position jitter quiet.
        const activate = cfg.activate ?? def.defaultActivate;
        const release = Math.min(cfg.release ?? def.defaultRelease, activate);
        const full = Math.max(cfg.full ?? 0.28, activate + 0.02);
        const active = Number.isFinite(value)
          && (st.active ? value > release : value >= activate);
        if (active && !st.active) st.activeSince = now;
        st.active = active;
        const strength = active ? Math.min(1, Math.max(0, (value - release) / (full - release))) : 0;
        // Keyboard games accept on/off input: short holds approximate light steering.
        // Start a cycle on engagement so a fresh turn responds immediately.
        const phase = ((now - st.activeSince) % 120) / 120;
        const down = strength > 0 && (strength >= 1 || phase < strength);
        if (down) events.push({ id, state: 'down', strength });
        else if (st.pressed) events.push({ id, state: 'up', strength: 0 });
        st.pressed = down;
        continue;
      }
      const alpha = cfg.smooth ?? 0.35;
      st.smoothed = alpha * value + (1 - alpha) * st.smoothed;

      const activate = cfg.activate ?? def.defaultActivate;
      const release = cfg.release ?? def.defaultRelease;
      const mode = cfg.mode || def.defaultMode;
      const cooldown = cfg.cooldownMs ?? (mode === 'pulse' ? 280 : 80);
      const minActive = cfg.minActiveMs ?? (mode === 'pulse' ? 40 : 0);

      const strength = Math.min(
        1,
        Math.max(0, (st.smoothed - release) / Math.max(1e-6, activate - release))
      );

      if (!st.active) {
        if (st.smoothed >= activate && now - st.lastFire >= cooldown) {
          st.active = true;
          st.activeSince = now;
          st.lastFire = now;

          if (mode === 'toggle') {
            st.toggled = !st.toggled;
            events.push({
              id,
              state: st.toggled ? 'down' : 'up',
              strength: st.toggled ? Math.max(strength, 0.2) : 0,
            });
            // pulse-style end of press for toggle edge
            st.active = false;
          } else if (mode === 'pulse') {
            events.push({ id, state: 'pulse', strength: Math.max(strength, 0.5) });
            // stay "active" briefly until release threshold so we don't re-fire
          } else {
            events.push({ id, state: 'down', strength: Math.max(strength, 0.2) });
          }
        }
      } else {
        // active
        if (mode === 'hold') {
          if (st.smoothed < release && now - st.activeSince >= minActive) {
            st.active = false;
            events.push({ id, state: 'up', strength: 0 });
          } else {
            events.push({ id, state: 'down', strength: Math.max(strength, 0.2) });
          }
        } else if (mode === 'pulse') {
          if (st.smoothed < release && now - st.activeSince >= minActive) {
            st.active = false;
          }
        }
      }
    }

    // Release the previous direction before pressing its opposite on the same frame.
    return [...events.filter((e) => e.state === 'up'), ...events.filter((e) => e.state !== 'up')];
  }

  /** Force-release all held gestures (lost tracking / pause). */
  function releaseAll() {
    /** @type {GestureEvent[]} */
    const events = [];
    for (const [id, st] of state) {
      if (st.active || st.toggled) {
        if (st.toggled || st.active) {
          events.push({ id, state: 'up', strength: 0 });
        }
        st.active = false;
        st.toggled = false;
        st.pressed = false;
        st.smoothed = 0;
        st.lastFire = 0;
      }
    }
    return events;
  }

  function reset() {
    state.clear();
  }

  return { update, releaseAll, reset, getState: () => state };
}
