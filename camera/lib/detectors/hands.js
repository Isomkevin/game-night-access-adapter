/**
 * MediaPipe Gesture Recognizer (gestures + hand landmarks).
 * Lazy-loaded only when hands/fingers categories are enabled.
 */

import {
  GestureRecognizer,
  FilesetResolver,
} from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm';

const WASM =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL =
  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';

/**
 * @returns {Promise<{ detect: (video: HTMLVideoElement, ts: number) => object|null, close: () => void }>}
 */
export async function createHandDetector() {
  const vision = await FilesetResolver.forVisionTasks(WASM);

  async function createWithDelegate(delegate) {
    return GestureRecognizer.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL,
        delegate,
      },
      runningMode: 'VIDEO',
      numHands: 2,
    });
  }

  let recognizer;
  try {
    recognizer = await createWithDelegate('GPU');
  } catch {
    recognizer = await createWithDelegate('CPU');
  }

  return {
    detect(video, timestampMs) {
      try {
        return recognizer.recognizeForVideo(video, timestampMs);
      } catch {
        return null;
      }
    },
    close() {
      try {
        recognizer.close();
      } catch {
        /* ignore */
      }
    },
  };
}
