/**
 * Vision-based accessibility input orchestrator.
 * Detection → signals → calibration → interpretation → bridge events.
 */

import { DrawingUtils } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm';
import { createCapture } from './lib/capture.js';
import { createFaceDetector } from './lib/detectors/face.js';
import { createHandDetector } from './lib/detectors/hands.js';
import { extractSignals, applyBaseline } from './lib/signals.js';
import { captureBaseline } from './lib/calibration.js';
import { createInterpreter } from './lib/interpreter.js';
import { createEmitter } from './lib/emitter.js';
import {
  getActiveProfile,
  saveProfile,
  gestureConfigsFromProfile,
  remapEntriesFromProfile,
} from './lib/profiles.js';
import { mountSetupUI } from './ui/setup.js';

const statusEl = document.getElementById('status');
const video = document.getElementById('video');
const canvas = document.getElementById('overlay');
const ctx = canvas.getContext('2d');
const setupRoot = document.getElementById('setup');

/** @type {import('./lib/profiles.js').CameraProfile} */
let profile = getActiveProfile();
let faceDetector = null;
/** @type {Awaited<ReturnType<typeof createHandDetector>>|null} */
let handDetector = null;
let handLoading = null;
let interpreter = createInterpreter(gestureConfigsFromProfile(profile));
/** @type {object|null} */
let lastFace = null;
/** @type {object|null} */
let lastHand = null;

const capture = createCapture(video, { lostTimeoutMs: 2500 });

const emitter = createEmitter({
  onStatus(s) {
    if (s === 'connected') setStatus('Connected — tracking your movements');
    else setStatus('Connection lost — retrying… On-screen controls still work in the extension.');
  },
});

function setStatus(msg) {
  statusEl.textContent = msg;
}

function rebuildInterpreter() {
  emitter.releaseAll();
  interpreter = createInterpreter(gestureConfigsFromProfile(profile));
}

function needsHands() {
  return !!(profile.categories.hands || profile.categories.fingers);
}

function needsFace() {
  return !!(profile.categories.head || profile.categories.face);
}

async function ensureHandDetector() {
  if (!needsHands()) {
    if (handDetector) {
      handDetector.close();
      handDetector = null;
    }
    return;
  }
  if (handDetector || handLoading) return handLoading;
  setStatus('Loading hand gesture model…');
  handLoading = createHandDetector()
    .then((d) => {
      handDetector = d;
      handLoading = null;
      setStatus('Hand model ready');
    })
    .catch((err) => {
      handLoading = null;
      setStatus(`Hand model error: ${err.message || err}`);
    });
  return handLoading;
}

function beep() {
  if (!profile.audioFeedback) return;
  try {
    const ctxAudio = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctxAudio.createOscillator();
    const g = ctxAudio.createGain();
    o.frequency.value = 880;
    g.gain.value = 0.04;
    o.connect(g);
    g.connect(ctxAudio.destination);
    o.start();
    o.stop(ctxAudio.currentTime + 0.06);
    setTimeout(() => ctxAudio.close(), 200);
  } catch {
    /* ignore */
  }
}

const ui = mountSetupUI(setupRoot, {
  getProfile: () => profile,
  setProfile(p) {
    profile = p;
  },
  onProfileChange() {
    rebuildInterpreter();
    ensureHandDetector();
  },
  async calibrate() {
    setStatus('Calibrating — hold a comfortable neutral pose…');
    const baseline = await captureBaseline({
      durationMs: 2500,
      sample: () => ({ face: lastFace, hand: lastHand }),
      onProgress(p) {
        setStatus(`Calibrating… ${Math.round(p * 100)}%`);
      },
    });
    profile.calibration = baseline;
    saveProfile(profile);
    setStatus('Calibration saved — intentional movements relative to neutral');
  },
  togglePause() {
    const next = !capture.isPaused();
    capture.setPaused(next);
    if (next) {
      const ups = interpreter.releaseAll();
      for (const e of ups) {
        if (profile.emitToBridge !== false) emitter.emit(e.id, 'up', 0);
      }
      emitter.releaseAll();
      setStatus('Camera control paused');
    } else {
      setStatus('Camera control resumed');
    }
  },
  isPaused: () => capture.isPaused(),
  applyRemap() {
    const entries = remapEntriesFromProfile(profile);
    emitter.setRemap(entries, true);
  },
  setStatus,
});

capture.onLost((reason) => {
  const ups = interpreter.releaseAll();
  for (const e of ups) {
    if (profile.emitToBridge !== false) emitter.emit(e.id, 'up', 0);
  }
  emitter.releaseAll();
  if (reason === 'paused') return;
  setStatus(`Tracking lost (${reason}) — inputs released`);
});

async function main() {
  setStatus('Starting camera — allow permission if asked…');
  faceDetector = await createFaceDetector();
  await capture.start();
  await ensureHandDetector();

  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const drawer = new DrawingUtils(ctx);

  setStatus('Camera ready — sit comfortably, then calibrate your neutral pose');

  let lastVideoTime = -1;
  let trackingLost = false;

  function releaseHeld(reason) {
    const ups = interpreter.releaseAll();
    for (const e of ups) {
      if (profile.emitToBridge !== false) emitter.emit(e.id, e.state, e.strength);
    }
    emitter.releaseAll();
    if (!trackingLost) {
      trackingLost = true;
      setStatus(`Tracking lost (${reason}) — inputs released`);
    }
  }

  const loop = () => {
    requestAnimationFrame(loop);
    if (capture.isPaused()) return;
    if (video.currentTime === lastVideoTime) return;
    lastVideoTime = video.currentTime;
    capture.markFrame();

    const ts = performance.now();
    lastFace = needsFace() ? faceDetector.detect(video, ts) : null;
    lastHand = handDetector && needsHands() ? handDetector.detect(video, ts) : null;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (lastFace?.faceLandmarks?.[0]) {
      drawer.drawConnectors(
        lastFace.faceLandmarks[0],
        faceDetector.FaceLandmarker.FACE_LANDMARKS_TESSELATION,
        { color: '#7eb6ff33', lineWidth: 1 }
      );
    }
    if (lastHand?.landmarks?.[0]) {
      try {
        drawer.drawLandmarks(lastHand.landmarks[0], {
          color: '#9fe870',
          lineWidth: 1,
          radius: 3,
        });
      } catch {
        for (const pt of lastHand.landmarks[0]) {
          const x = pt.x * canvas.width;
          const y = pt.y * canvas.height;
          ctx.fillStyle = '#9fe870';
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    const faceOk = !needsFace() || !!lastFace?.faceLandmarks?.[0];
    const handOk = !needsHands() || !!lastHand?.landmarks?.[0];
    const trackingOk =
      (!needsFace() || faceOk) && (!needsHands() || handOk || needsFace());

    // Hands-only profile: require a hand. Face profile: require a face.
    if (needsFace() && !faceOk) {
      releaseHeld('no-face');
      ui.updateLive(extractSignals(null, lastHand), []);
      return;
    }
    if (!needsFace() && needsHands() && !handOk) {
      releaseHeld('no-hand');
      ui.updateLive(extractSignals(null, null), []);
      return;
    }

    if (trackingLost && trackingOk) {
      trackingLost = false;
      setStatus('Tracking recovered');
    }

    const absolute = extractSignals(lastFace, lastHand, { mirrorSubject: true });
    const relative = applyBaseline(absolute, profile.calibration);
    const events = interpreter.update(relative, ts);

    /** @type {string[]} */
    const activeIds = [];
    for (const ev of events) {
      activeIds.push(ev.id);
      if (ev.state === 'down' || ev.state === 'pulse') beep();
      if (profile.emitToBridge !== false) {
        emitter.emit(ev.id, ev.state, ev.strength);
      }
    }

    for (const id of emitter.getHeld()) activeIds.push(id);
    emitter.refresh(ts);
    ui.updateLive(relative, [...new Set(activeIds)]);
  };
  loop();
}

main().catch((err) => {
  console.error(err);
  const msg = String(err.message || err);
  if (/NotAllowedError|Permission/i.test(msg)) {
    setStatus('Camera permission needed — allow access in the browser, then reload this page.');
  } else {
    setStatus(`Could not start the camera: ${msg}`);
  }
});

window.addEventListener('pagehide', () => {
  interpreter.releaseAll();
  emitter.dispose();
  capture.dispose();
  faceDetector?.close();
  handDetector?.close();
});
