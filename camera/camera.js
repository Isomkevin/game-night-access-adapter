/**
 * MediaPipe Face Landmarker → head yaw → bridge input events.
 * Runs entirely in-browser (macOS-friendly). Assigned to Tim; Kevin backup.
 */

import {
  FaceLandmarker,
  FilesetResolver,
  DrawingUtils,
} from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm';

const statusEl = document.getElementById('status');
const video = document.getElementById('video');
const canvas = document.getElementById('overlay');
const yawEl = document.getElementById('yaw');
const ctx = canvas.getContext('2d');

const proto = location.protocol === 'https:' ? 'wss' : 'ws';
const wsUrl = `${proto}://${location.host}`;

/** @type {WebSocket|null} */
let socket = null;
let lastSteer = 'none';
const YAW_DEADZONE = 0.08; // normalized approx
const YAW_FULL = 0.28;

function send(msg) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(msg));
  }
}

function input(action, state, strength = 1) {
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

function connect() {
  socket = new WebSocket(wsUrl);
  socket.addEventListener('open', () => {
    statusEl.textContent = 'Bridge connected — tracking…';
    send({ type: 'hello', role: 'camera', v: 1, ts: Date.now() });
  });
  socket.addEventListener('close', () => {
    statusEl.textContent = 'Bridge disconnected — retrying…';
    setTimeout(connect, 2000);
  });
}

/**
 * Rough yaw from face oval landmarks (nose tip vs cheek midpoint).
 * Landmarks: nose tip ~1, left cheek ~234, right cheek ~454 (Face Mesh topology).
 */
function estimateYaw(landmarks) {
  if (!landmarks || landmarks.length < 455) return 0;
  const nose = landmarks[1];
  const left = landmarks[234];
  const right = landmarks[454];
  const midX = (left.x + right.x) / 2;
  const width = Math.abs(right.x - left.x) || 1e-6;
  // Positive = turn right (nose right of mid)
  return (nose.x - midX) / width;
}

function applyYaw(yaw) {
  yawEl.textContent = yaw.toFixed(3);
  let next = 'none';
  if (yaw <= -YAW_DEADZONE) next = 'left';
  else if (yaw >= YAW_DEADZONE) next = 'right';

  const strength = Math.min(1, Math.max(0, (Math.abs(yaw) - YAW_DEADZONE) / (YAW_FULL - YAW_DEADZONE)));

  if (next !== lastSteer) {
    if (lastSteer === 'left') input('tiltLeft', 'up');
    if (lastSteer === 'right') input('tiltRight', 'up');
    if (next === 'left') input('tiltLeft', 'down', strength || 0.2);
    if (next === 'right') input('tiltRight', 'down', strength || 0.2);
    lastSteer = next;
  } else if (next === 'left') {
    input('tiltLeft', 'down', strength || 0.2);
  } else if (next === 'right') {
    input('tiltRight', 'down', strength || 0.2);
  }
}

async function main() {
  connect();

  statusEl.textContent = 'Loading MediaPipe…';
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
  );
  const landmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numFaces: 1,
  });

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: 640, height: 480 },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();

  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const drawer = new DrawingUtils(ctx);

  statusEl.textContent = 'Camera ready';

  let lastVideoTime = -1;
  const loop = () => {
    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const result = landmarker.detectForVideo(video, performance.now());
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (result.faceLandmarks?.[0]) {
        drawer.drawConnectors(
          result.faceLandmarks[0],
          FaceLandmarker.FACE_LANDMARKS_TESSELATION,
          { color: '#7eb6ff33', lineWidth: 1 }
        );
        applyYaw(estimateYaw(result.faceLandmarks[0]));
      }
    }
    requestAnimationFrame(loop);
  };
  loop();
}

main().catch((err) => {
  console.error(err);
  statusEl.textContent = `Camera error: ${err.message || err}`;
});
