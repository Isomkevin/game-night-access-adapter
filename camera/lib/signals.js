/**
 * Extract continuous normalized signals from MediaPipe face + hand results.
 * Values are absolute (pre-calibration); calibration applies deltas separately.
 */

function blendMap(blendshapes) {
  /** @type {Record<string, number>} */
  const out = {};
  if (!blendshapes?.length) return out;
  const cats = blendshapes[0]?.categories || blendshapes[0];
  if (!Array.isArray(cats)) return out;
  for (const c of cats) {
    if (c && typeof c.categoryName === 'string') {
      out[c.categoryName] = c.score ?? 0;
    }
  }
  return out;
}

/**
 * Rough yaw from face oval (legacy heuristic — stable for steering).
 * Positive = turn right (nose right of mid).
 */
export function estimateYawFromLandmarks(landmarks) {
  if (!landmarks || landmarks.length < 455) return 0;
  const nose = landmarks[1];
  const left = landmarks[234];
  const right = landmarks[454];
  const midX = (left.x + right.x) / 2;
  const width = Math.abs(right.x - left.x) || 1e-6;
  return (nose.x - midX) / width;
}

/** Pitch proxy: nose vs eye midline vertical offset normalized by face height */
export function estimatePitchFromLandmarks(landmarks) {
  if (!landmarks || landmarks.length < 455) return 0;
  const nose = landmarks[1];
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const chin = landmarks[152];
  const eyeY = (leftEye.y + rightEye.y) / 2;
  const height = Math.abs(chin.y - eyeY) || 1e-6;
  // Nose below eyes is normal; more below → looking down (positive)
  return (nose.y - eyeY) / height - 0.45;
}

/** Roll proxy: eye line angle */
export function estimateRollFromLandmarks(landmarks) {
  if (!landmarks || landmarks.length < 264) return 0;
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  return Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
}

/** Face width as scale proxy (larger = closer) */
export function estimateFaceScale(landmarks) {
  if (!landmarks || landmarks.length < 455) return 0;
  return Math.abs(landmarks[454].x - landmarks[234].x);
}

/**
 * Extract euler-ish angles from 4x4 column-major facial transformation matrix.
 * Falls back silently if matrix missing.
 * @param {Float32Array|number[]|undefined} matrix
 */
export function matrixToPose(matrix) {
  if (!matrix || matrix.length < 16) return null;
  const r01 = matrix[4];
  const r11 = matrix[5];
  const r20 = matrix[2];
  const r21 = matrix[6];
  const r22 = matrix[10];
  const pitch = Math.asin(Math.max(-1, Math.min(1, -r21)));
  const yaw = Math.atan2(r20, r22);
  const roll = Math.atan2(r01, r11);
  return { yaw, pitch, roll };
}

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z || 0) - (b.z || 0);
  return Math.hypot(dx, dy, dz);
}

/**
 * @param {object|null} faceResult
 * @param {object|null} handResult
 * @param {{ mirrorSubject?: boolean }} [opts]
 *   mirrorSubject: preview is mirrored; swap left/right blendshapes for subject-correct labels
 */
export function extractSignals(faceResult, handResult, opts = {}) {
  const mirrorSubject = opts.mirrorSubject !== false;

  /** @type {Record<string, number>} */
  const signals = {
    yaw: 0,
    pitch: 0,
    roll: 0,
    faceScale: 0,
    jawOpen: 0,
    smile: 0,
    browRaise: 0,
    frown: 0,
    blinkLeft: 0,
    blinkRight: 0,
    blinkBoth: 0,
    squint: 0,
    handRaise: 0,
    handX: 0,
    handY: 0,
    gestureOpenPalm: 0,
    gestureClosedFist: 0,
    gestureThumbUp: 0,
    gestureThumbDown: 0,
    gesturePointingUp: 0,
    pinch: 0,
    indexExtend: 0,
    facePresent: 0,
    handPresent: 0,
  };

  const landmarks = faceResult?.faceLandmarks?.[0];
  if (landmarks) {
    signals.facePresent = 1;
    signals.yaw = estimateYawFromLandmarks(landmarks);
    signals.pitch = estimatePitchFromLandmarks(landmarks);
    signals.roll = estimateRollFromLandmarks(landmarks);
    signals.faceScale = estimateFaceScale(landmarks);

    const pose = matrixToPose(faceResult.facialTransformationMatrixes?.[0]?.data
      || faceResult.facialTransformationMatrixes?.[0]);
    if (pose) {
      // Blend matrix pitch/roll (radians → soft normalize) with landmark estimates
      signals.pitch = signals.pitch * 0.4 + (pose.pitch / 0.5) * 0.6;
      signals.roll = signals.roll * 0.3 + pose.roll * 0.7;
    }

    const b = blendMap(faceResult.faceBlendshapes);
    let blinkL = b.eyeBlinkLeft ?? 0;
    let blinkR = b.eyeBlinkRight ?? 0;
    let squintL = b.eyeSquintLeft ?? 0;
    let squintR = b.eyeSquintRight ?? 0;
    if (mirrorSubject) {
      [blinkL, blinkR] = [blinkR, blinkL];
      [squintL, squintR] = [squintR, squintL];
    }
    signals.jawOpen = b.jawOpen ?? 0;
    signals.smile = Math.max(b.mouthSmileLeft ?? 0, b.mouthSmileRight ?? 0);
    signals.browRaise = b.browInnerUp ?? 0;
    signals.frown = Math.max(b.mouthFrownLeft ?? 0, b.mouthFrownRight ?? 0);
    signals.blinkLeft = blinkL;
    signals.blinkRight = blinkR;
    signals.blinkBoth = Math.min(blinkL, blinkR);
    signals.squint = Math.max(squintL, squintR);
  }

  const handLandmarks = handResult?.landmarks?.[0];
  if (handLandmarks?.length) {
    signals.handPresent = 1;
    const wrist = handLandmarks[0];
    // Mirrored video: x increases to user's left visually; keep subject coords
    const wx = mirrorSubject ? 1 - wrist.x : wrist.x;
    signals.handX = (wx - 0.5) * 2; // -1..1 around center
    signals.handY = (0.5 - wrist.y) * 2; // up positive
    signals.handRaise = Math.max(0, signals.handY);

    const thumbTip = handLandmarks[4];
    const indexTip = handLandmarks[8];
    const indexPip = handLandmarks[6];
    const indexMcp = handLandmarks[5];
    const pinchDist = dist(thumbTip, indexTip);
    // Closer pinch → higher score
    signals.pinch = Math.max(0, Math.min(1, 1 - pinchDist / 0.12));

    const indexLen = dist(indexMcp, indexTip);
    const curled = dist(indexPip, indexTip);
    signals.indexExtend = Math.max(0, Math.min(1, indexLen / 0.18 - curled * 0.5));
  }

  const gestureHand = handResult?.gestures?.[0];
  if (Array.isArray(gestureHand)) {
    for (const g of gestureHand) {
      const name =
        g.categoryName ||
        g.categories?.[0]?.categoryName ||
        (typeof g === 'string' ? g : '');
      const score = g.score ?? g.categories?.[0]?.score ?? 0;
      if (!name || name === 'None') continue;
      if (name === 'Open_Palm') signals.gestureOpenPalm = Math.max(signals.gestureOpenPalm, score);
      if (name === 'Closed_Fist') signals.gestureClosedFist = Math.max(signals.gestureClosedFist, score);
      if (name === 'Thumb_Up') signals.gestureThumbUp = Math.max(signals.gestureThumbUp, score);
      if (name === 'Thumb_Down') signals.gestureThumbDown = Math.max(signals.gestureThumbDown, score);
      if (name === 'Pointing_Up') signals.gesturePointingUp = Math.max(signals.gesturePointingUp, score);
    }
  }

  return signals;
}

/**
 * Apply calibration baseline: subtract resting pose for head pose / scale;
 * blendshapes use max(0, value - baseline).
 * @param {Record<string, number>} signals
 * @param {Record<string, number>|null} baseline
 */
export function applyBaseline(signals, baseline) {
  if (!baseline) return { ...signals };
  const out = { ...signals };
  for (const key of ['yaw', 'pitch', 'roll', 'faceScale', 'handX', 'handY', 'handRaise']) {
    if (key in baseline && key in out) {
      out[key] = signals[key] - baseline[key];
    }
  }
  for (const key of [
    'jawOpen',
    'smile',
    'browRaise',
    'frown',
    'blinkLeft',
    'blinkRight',
    'blinkBoth',
    'squint',
  ]) {
    if (key in baseline && key in out) {
      out[key] = Math.max(0, signals[key] - (baseline[key] || 0) * 0.5);
    }
  }
  return out;
}
