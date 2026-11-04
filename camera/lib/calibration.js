/**
 * Neutral-pose baseline capture for intentional vs resting movement.
 */

import { extractSignals } from './signals.js';

/**
 * Average signals over a short window while the user holds a neutral pose.
 * @param {object} opts
 * @param {() => { face: object|null, hand: object|null }} opts.sample
 * @param {number} [opts.durationMs]
 * @param {(progress: number) => void} [opts.onProgress]
 * @returns {Promise<Record<string, number>>}
 */
export async function captureBaseline({ sample, durationMs = 2500, onProgress }) {
  const start = performance.now();
  /** @type {Record<string, number[]>} */
  const buckets = {};

  return new Promise((resolve) => {
    const tick = () => {
      const elapsed = performance.now() - start;
      const progress = Math.min(1, elapsed / durationMs);
      if (onProgress) onProgress(progress);

      const { face, hand } = sample();
      const sig = extractSignals(face, hand);
      for (const [k, v] of Object.entries(sig)) {
        if (typeof v !== 'number') continue;
        if (!buckets[k]) buckets[k] = [];
        buckets[k].push(v);
      }

      if (elapsed >= durationMs) {
        /** @type {Record<string, number>} */
        const baseline = {};
        for (const [k, arr] of Object.entries(buckets)) {
          const sum = arr.reduce((a, b) => a + b, 0);
          baseline[k] = sum / arr.length;
        }
        resolve(baseline);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
