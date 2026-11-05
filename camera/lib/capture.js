/**
 * Webcam capture, pause, and visibility / disconnect timeouts.
 */

/**
 * @typedef {object} CaptureHandle
 * @property {HTMLVideoElement} video
 * @property {MediaStream|null} stream
 * @property {() => Promise<void>} start
 * @property {() => void} stop
 * @property {(paused: boolean) => void} setPaused
 * @property {() => boolean} isPaused
 * @property {(cb: (reason: string) => void) => void} onLost
 */

/**
 * @param {HTMLVideoElement} video
 * @param {object} [opts]
 * @param {number} [opts.lostTimeoutMs]  No frames / hidden tab timeout
 */
export function createCapture(video, opts = {}) {
  const lostTimeoutMs = opts.lostTimeoutMs ?? 3000;
  /** @type {MediaStream|null} */
  let stream = null;
  let paused = false;
  let lostTimer = null;
  /** @type {((reason: string) => void)|null} */
  let lostCb = null;
  let lastFrameAt = 0;

  function clearLostTimer() {
    if (lostTimer) {
      clearTimeout(lostTimer);
      lostTimer = null;
    }
  }

  function armLostTimer(reason) {
    clearLostTimer();
    lostTimer = setTimeout(() => {
      if (lostCb) lostCb(reason);
    }, lostTimeoutMs);
  }

  function onVisibility() {
    if (document.hidden) {
      armLostTimer('tab-hidden');
    } else {
      clearLostTimer();
      lastFrameAt = performance.now();
    }
  }

  document.addEventListener('visibilitychange', onVisibility);

  return {
    video,
    get stream() {
      return stream;
    },
    async start() {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
      lastFrameAt = performance.now();
      clearLostTimer();
    },
    stop() {
      clearLostTimer();
      if (stream) {
        for (const t of stream.getTracks()) t.stop();
        stream = null;
      }
      video.srcObject = null;
    },
    setPaused(value) {
      paused = !!value;
      if (paused) {
        armLostTimer('paused');
      } else {
        clearLostTimer();
        lastFrameAt = performance.now();
      }
    },
    isPaused() {
      return paused;
    },
    /** Call each processed video frame to reset disconnect timeout */
    markFrame() {
      lastFrameAt = performance.now();
      if (!paused && !document.hidden) clearLostTimer();
    },
    onLost(cb) {
      lostCb = cb;
    },
    dispose() {
      document.removeEventListener('visibilitychange', onVisibility);
      this.stop();
    },
  };
}
