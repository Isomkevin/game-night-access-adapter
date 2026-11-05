/** MediaPipe head yaw -> bridge -> extension remap. No voice or phone required. */
import { Steering, SteeringSender, estimateYaw, YAW_DEADZONE, YAW_FULL } from './steering.js';

const $ = (id) => document.getElementById(id);
const video = $('video'), canvas = $('overlay'), ctx = canvas.getContext('2d');
const steering = new Steering();
const wsUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;
const VISION_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm';
const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
let socket = null, reconnectTimer = null, closing = false;
let stream = null, tracker = null, loopTimer = null, generation = 0, running = false;
let lastVideoTime = -1, drawer = null, visionModule = null;
let settingsValid = true;

function status(message) {
  if ($('status').textContent !== message) $('status').textContent = message;
}

function send(message) {
  if (socket?.readyState !== WebSocket.OPEN) return false;
  try { socket.send(JSON.stringify(message)); return true; }
  catch { return false; }
}

const sender = new SteeringSender((action, state, strength) => send({
  type: 'input', source: 'camera', action, state, strength, ts: Date.now(), v: 1,
}));

function recenter() {
  sender.release();
  steering.recenter();
  if (running) status('Hold your head comfortably still for one second.');
}

function connect() {
  if (closing || socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;
  $('bridge-status').textContent = 'Bridge: connecting…';
  const client = new WebSocket(wsUrl);
  socket = client;
  client.addEventListener('open', () => {
    if (socket !== client) return;
    send({ type: 'hello', role: 'camera', v: 1, ts: Date.now() });
    $('bridge-status').textContent = 'Bridge: connected. Waiting for extension status…';
    recenter();
  });
  client.addEventListener('message', (event) => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (message.type === 'status') {
      const count = message.clients?.extension || 0;
      $('bridge-status').textContent = count
        ? `Bridge: connected · extension connected (${count})`
        : 'Bridge: connected · extension offline. Load or reload extension/ in Chrome.';
    }
  });
  client.addEventListener('error', () => client.close());
  client.addEventListener('close', () => {
    if (socket !== client) return;
    sender.release();
    steering.loseFace();
    socket = null;
    $('bridge-status').textContent = 'Bridge: disconnected. Retrying in two seconds…';
    if (!closing) reconnectTimer = setTimeout(connect, 2000);
  });
}

function stopCamera(message = 'Camera stopped. Press Start camera to try again.') {
  generation++;
  running = false;
  clearInterval(loopTimer);
  loopTimer = null;
  sender.release();
  steering.recenter();
  const oldStream = stream;
  stream = null;
  oldStream?.getTracks().forEach((track) => track.stop());
  video.srcObject = null;
  tracker?.close();
  tracker = null;
  drawer = null;
  ctx?.clearRect(0, 0, canvas.width, canvas.height);
  $('start').disabled = false;
  $('stop').disabled = $('recenter').disabled = true;
  $('yaw').textContent = '—';
  $('direction').textContent = 'Released';
  status(message);
}

function cameraError(error) {
  if (/NotAllowed|Security/.test(error?.name)) return 'Camera permission blocked. Allow Camera for this localhost site in Chrome, then press Start camera.';
  if (/NotFound|DevicesNotFound/.test(error?.name)) return 'No camera found. Connect or enable a camera, then press Start camera.';
  if (/NotReadable|TrackStart/.test(error?.name)) return 'Camera unavailable. Close other camera apps, then press Start camera.';
  return `Camera could not start: ${error?.message || error}. Check your internet connection for MediaPipe, then retry.`;
}

async function startCamera() {
  if ($('start').disabled) return;
  const attempt = ++generation;
  $('start').disabled = true;
  $('stop').disabled = false;
  let nextTracker = null, nextStream = null;
  const cancelled = () => {
    if (attempt === generation) return false;
    nextStream?.getTracks().forEach((track) => track.stop());
    nextTracker?.close();
    return true;
  };
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Open this page on http://127.0.0.1:18765 or HTTPS to use the camera');
    status('Loading MediaPipe. Internet access is needed for the model and WASM.');
    visionModule = await import(VISION_URL);
    if (cancelled()) return;
    const files = await visionModule.FilesetResolver.forVisionTasks(WASM_URL);
    if (cancelled()) return;
    const make = (delegate) => visionModule.FaceLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate }, runningMode: 'VIDEO', numFaces: 1,
    });
    try { nextTracker = await make('GPU'); }
    catch (error) { console.info('[Camera] GPU unavailable; trying CPU.', error); if (cancelled()) return; nextTracker = await make('CPU'); }
    if (cancelled()) return;
    status('Allow camera access in Chrome. No microphone is requested.');
    nextStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: 640, height: 480 }, audio: false,
    });
    if (cancelled()) return;
    stream = nextStream;
    tracker = nextTracker;
    // Ownership has moved to stopCamera(), including cancellation during play().
    nextStream = nextTracker = null;
    video.srcObject = stream;
    await video.play();
    if (cancelled()) return;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    drawer = ctx ? new visionModule.DrawingUtils(ctx) : null;
    running = true;
    lastVideoTime = -1;
    $('recenter').disabled = false;
    for (const track of stream.getVideoTracks()) {
      track.addEventListener('ended', () => { if (running) stopCamera('Camera disconnected or permission revoked. Press Start camera to retry.'); });
    }
    recenter();
    loopTimer = setInterval(tick, 25);
  } catch (error) {
    nextStream?.getTracks().forEach((track) => track.stop());
    nextTracker?.close();
    if (attempt !== generation) return;
    console.error('[Camera]', error);
    stopCamera(cameraError(error));
  }
}

function tick() {
  if (!running || document.hidden || !settingsValid) return;
  const now = performance.now();
  try {
    if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const face = tracker.detectForVideo(video, now).faceLandmarks?.[0];
      steering.sample(estimateYaw(face, video.videoWidth, video.videoHeight), now);
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      if (face && drawer) drawer.drawConnectors(face, visionModule.FaceLandmarker.FACE_LANDMARKS_TESSELATION, { color: '#7eb6ff33', lineWidth: 1 });
    }
    const output = steering.output(now);
    sender.update(output, now);
    $('yaw').textContent = steering.yaw.toFixed(3);
    $('direction').textContent = output.action
      ? `${output.action === 'tiltLeft' ? 'Left' : 'Right'} · ${Math.round(output.strength * 100)}%`
      : 'Neutral · keys released';
    if (steering.lastFaceAt === null) status('Face not in view or camera frame stalled. Steering released.');
    else if (steering.neutral === null) status('Hold your head comfortably still for one second.');
    else status('Steering ready. Turn your face left or right; Recenter sets your resting position again.');
  } catch (error) {
    console.error('[Camera] Tracking stopped', error);
    stopCamera('Face tracking failed. Steering released. Press Start camera to retry.');
  }
}

$('deadzone').value = YAW_DEADZONE;
$('full').value = YAW_FULL;
$('start').addEventListener('click', startCamera);
$('stop').addEventListener('click', () => stopCamera());
$('recenter').addEventListener('click', recenter);
function updateSettings() {
  try {
    if (!$('deadzone').value || !$('full').value || !$('deadzone').checkValidity() || !$('full').checkValidity()) {
      throw new Error('Enter a dead zone of 0–0.99 and full steering of 0.01–1.');
    }
    steering.configure({ deadzone: Number($('deadzone').value), full: Number($('full').value), invert: $('invert').checked });
    settingsValid = true;
    $('settings-error').textContent = '';
    recenter();
  } catch (error) { settingsValid = false; sender.release(); steering.loseFace(); $('settings-error').textContent = error.message; status('Steering released. Fix the steering settings to continue.'); }
}
for (const id of ['deadzone', 'full', 'invert']) $(id).addEventListener('change', updateSettings);
document.addEventListener('visibilitychange', () => {
  sender.release();
  steering.loseFace();
  if (!running) return;
  if (document.hidden) status('Camera window hidden. Steering released. Keep this window visible beside LibreCorsa.');
  else recenter();
});
document.addEventListener('freeze', () => stopCamera('Camera page suspended. Press Start camera to resume.'));
window.addEventListener('pagehide', () => {
  closing = true;
  clearTimeout(reconnectTimer);
  stopCamera();
  socket?.close();
});
window.addEventListener('pageshow', (event) => { if (event.persisted) { closing = false; connect(); } });
status('Press Start camera, then hold your head comfortably still for one second.');
connect();
