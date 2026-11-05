/**
 * Canonical vision gestures exposed as camera:* logical inputs.
 * Only entries with supported:true are shown as working features.
 */

/** @typedef {'head'|'face'|'hands'|'fingers'} GestureCategory */
/** @typedef {'hold'|'pulse'|'toggle'} GestureMode */

/**
 * @typedef {object} GestureDef
 * @property {string} id
 * @property {string} label
 * @property {GestureCategory} category
 * @property {boolean} supported
 * @property {GestureMode} defaultMode
 * @property {string} signal  Key in the signals object
 * @property {number} [polarity] 1 = high activates, -1 = low (negated) activates
 * @property {number} defaultActivate
 * @property {number} defaultRelease
 * @property {string} [aliasOf]  Stable alias of another gesture id
 * @property {string} [note]
 */

/** @type {readonly GestureDef[]} */
export const GESTURE_CATALOG = Object.freeze([
  // —— Head (yaw aliases preserve Milestone 1 steering) ——
  {
    id: 'tiltLeft',
    label: 'Head yaw left (legacy tilt)',
    category: 'head',
    supported: true,
    defaultMode: 'hold',
    signal: 'yaw',
    polarity: -1,
    defaultActivate: 0.08,
    defaultRelease: 0.05,
    note: 'Legacy id — same as headYawLeft',
  },
  {
    id: 'tiltRight',
    label: 'Head yaw right (legacy tilt)',
    category: 'head',
    supported: true,
    defaultMode: 'hold',
    signal: 'yaw',
    polarity: 1,
    defaultActivate: 0.08,
    defaultRelease: 0.05,
    note: 'Legacy id — same as headYawRight',
  },
  {
    id: 'headYawLeft',
    label: 'Turn head left',
    category: 'head',
    supported: true,
    defaultMode: 'hold',
    signal: 'yaw',
    polarity: -1,
    defaultActivate: 0.08,
    defaultRelease: 0.05,
  },
  {
    id: 'headYawRight',
    label: 'Turn head right',
    category: 'head',
    supported: true,
    defaultMode: 'hold',
    signal: 'yaw',
    polarity: 1,
    defaultActivate: 0.08,
    defaultRelease: 0.05,
  },
  {
    id: 'headPitchUp',
    label: 'Raise head / look up',
    category: 'head',
    supported: true,
    defaultMode: 'hold',
    signal: 'pitch',
    polarity: -1,
    defaultActivate: 0.12,
    defaultRelease: 0.07,
  },
  {
    id: 'headPitchDown',
    label: 'Lower head / look down',
    category: 'head',
    supported: true,
    defaultMode: 'hold',
    signal: 'pitch',
    polarity: 1,
    defaultActivate: 0.12,
    defaultRelease: 0.07,
  },
  {
    id: 'headRollLeft',
    label: 'Tilt head left (roll)',
    category: 'head',
    supported: true,
    defaultMode: 'hold',
    signal: 'roll',
    polarity: -1,
    defaultActivate: 0.1,
    defaultRelease: 0.06,
  },
  {
    id: 'headRollRight',
    label: 'Tilt head right (roll)',
    category: 'head',
    supported: true,
    defaultMode: 'hold',
    signal: 'roll',
    polarity: 1,
    defaultActivate: 0.1,
    defaultRelease: 0.06,
  },
  {
    id: 'headCloser',
    label: 'Move head closer (experimental)',
    category: 'head',
    supported: true,
    defaultMode: 'hold',
    signal: 'faceScale',
    polarity: 1,
    defaultActivate: 0.15,
    defaultRelease: 0.08,
    note: 'Monocular scale proxy — unreliable; off by default',
  },
  {
    id: 'headFarther',
    label: 'Move head farther (experimental)',
    category: 'head',
    supported: true,
    defaultMode: 'hold',
    signal: 'faceScale',
    polarity: -1,
    defaultActivate: 0.15,
    defaultRelease: 0.08,
    note: 'Monocular scale proxy — unreliable; off by default',
  },

  // —— Face (blendshapes) ——
  {
    id: 'mouthOpen',
    label: 'Open mouth',
    category: 'face',
    supported: true,
    defaultMode: 'hold',
    signal: 'jawOpen',
    polarity: 1,
    defaultActivate: 0.35,
    defaultRelease: 0.22,
  },
  {
    id: 'smile',
    label: 'Smile',
    category: 'face',
    supported: true,
    defaultMode: 'hold',
    signal: 'smile',
    polarity: 1,
    defaultActivate: 0.4,
    defaultRelease: 0.25,
  },
  {
    id: 'browRaise',
    label: 'Raise eyebrows',
    category: 'face',
    supported: true,
    defaultMode: 'pulse',
    signal: 'browRaise',
    polarity: 1,
    defaultActivate: 0.35,
    defaultRelease: 0.2,
  },
  {
    id: 'frown',
    label: 'Frown',
    category: 'face',
    supported: true,
    defaultMode: 'hold',
    signal: 'frown',
    polarity: 1,
    defaultActivate: 0.35,
    defaultRelease: 0.2,
  },
  {
    id: 'blinkLeft',
    label: 'Blink left eye',
    category: 'face',
    supported: true,
    defaultMode: 'pulse',
    signal: 'blinkLeft',
    polarity: 1,
    defaultActivate: 0.55,
    defaultRelease: 0.3,
  },
  {
    id: 'blinkRight',
    label: 'Blink right eye',
    category: 'face',
    supported: true,
    defaultMode: 'pulse',
    signal: 'blinkRight',
    polarity: 1,
    defaultActivate: 0.55,
    defaultRelease: 0.3,
  },
  {
    id: 'blinkBoth',
    label: 'Blink both eyes',
    category: 'face',
    supported: true,
    defaultMode: 'pulse',
    signal: 'blinkBoth',
    polarity: 1,
    defaultActivate: 0.5,
    defaultRelease: 0.28,
  },
  {
    id: 'squint',
    label: 'Squint',
    category: 'face',
    supported: true,
    defaultMode: 'hold',
    signal: 'squint',
    polarity: 1,
    defaultActivate: 0.35,
    defaultRelease: 0.2,
  },

  // —— Hands ——
  {
    id: 'handRaise',
    label: 'Raise hand',
    category: 'hands',
    supported: true,
    defaultMode: 'hold',
    signal: 'handRaise',
    polarity: 1,
    defaultActivate: 0.2,
    defaultRelease: 0.1,
  },
  {
    id: 'handLeft',
    label: 'Move hand left',
    category: 'hands',
    supported: true,
    defaultMode: 'hold',
    signal: 'handX',
    polarity: -1,
    defaultActivate: 0.2,
    defaultRelease: 0.1,
  },
  {
    id: 'handRight',
    label: 'Move hand right',
    category: 'hands',
    supported: true,
    defaultMode: 'hold',
    signal: 'handX',
    polarity: 1,
    defaultActivate: 0.2,
    defaultRelease: 0.1,
  },
  {
    id: 'palmOpen',
    label: 'Open palm',
    category: 'hands',
    supported: true,
    defaultMode: 'hold',
    signal: 'gestureOpenPalm',
    polarity: 1,
    defaultActivate: 0.55,
    defaultRelease: 0.35,
  },
  {
    id: 'fist',
    label: 'Make a fist',
    category: 'hands',
    supported: true,
    defaultMode: 'hold',
    signal: 'gestureClosedFist',
    polarity: 1,
    defaultActivate: 0.55,
    defaultRelease: 0.35,
  },
  {
    id: 'thumbUp',
    label: 'Thumbs up',
    category: 'hands',
    supported: true,
    defaultMode: 'pulse',
    signal: 'gestureThumbUp',
    polarity: 1,
    defaultActivate: 0.55,
    defaultRelease: 0.35,
  },
  {
    id: 'thumbDown',
    label: 'Thumbs down',
    category: 'hands',
    supported: true,
    defaultMode: 'pulse',
    signal: 'gestureThumbDown',
    polarity: 1,
    defaultActivate: 0.55,
    defaultRelease: 0.35,
  },
  {
    id: 'pointUp',
    label: 'Point up',
    category: 'hands',
    supported: true,
    defaultMode: 'hold',
    signal: 'gesturePointingUp',
    polarity: 1,
    defaultActivate: 0.55,
    defaultRelease: 0.35,
  },

  // —— Fingers ——
  {
    id: 'pinch',
    label: 'Pinch (thumb + index)',
    category: 'fingers',
    supported: true,
    defaultMode: 'hold',
    signal: 'pinch',
    polarity: 1,
    defaultActivate: 0.55,
    defaultRelease: 0.35,
  },
  {
    id: 'indexPoint',
    label: 'Index finger extended',
    category: 'fingers',
    supported: true,
    defaultMode: 'hold',
    signal: 'indexExtend',
    polarity: 1,
    defaultActivate: 0.45,
    defaultRelease: 0.28,
  },
]);

export const CATEGORY_LABELS = Object.freeze({
  head: 'Head movements',
  face: 'Facial movements',
  hands: 'Hand gestures',
  fingers: 'Finger gestures',
});

/** Gestures shown in UI / claimed as working */
export function supportedGestures() {
  return GESTURE_CATALOG.filter((g) => g.supported);
}

export function gestureById(id) {
  return GESTURE_CATALOG.find((g) => g.id === id) || null;
}

/** Default enabled set: legacy yaw steering only */
export function defaultEnabledIds() {
  return new Set(['tiltLeft', 'tiltRight']);
}
