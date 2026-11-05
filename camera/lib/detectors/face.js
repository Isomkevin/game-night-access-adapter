/**
 * MediaPipe Face Landmarker (blendshapes + facial transformation matrix).
 */

import {
  FaceLandmarker,
  FilesetResolver,
} from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm';

const WASM =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

/**
 * @returns {Promise<{ detect: (video: HTMLVideoElement, ts: number) => object|null, close: () => void, FaceLandmarker: typeof FaceLandmarker }>}
 */
export async function createFaceDetector() {
  const vision = await FilesetResolver.forVisionTasks(WASM);

  async function createWithDelegate(delegate) {
    return FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL,
        delegate,
      },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    });
  }

  let landmarker;
  try {
    landmarker = await createWithDelegate('GPU');
  } catch {
    landmarker = await createWithDelegate('CPU');
  }

  return {
    FaceLandmarker,
    detect(video, timestampMs) {
      try {
        return landmarker.detectForVideo(video, timestampMs);
      } catch {
        return null;
      }
    },
    close() {
      try {
        landmarker.close();
      } catch {
        /* ignore */
      }
    },
  };
}
