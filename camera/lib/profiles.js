/**
 * Named camera profiles in localStorage (enablement, thresholds, modes, bindings, calibration).
 */

import { GESTURE_CATALOG, defaultEnabledIds } from './catalog.js';

const STORAGE_KEY = 'gnaa.camera.profiles';
const ACTIVE_KEY = 'gnaa.camera.activeProfile';

/**
 * @typedef {object} GestureSettings
 * @property {boolean} enabled
 * @property {'hold'|'pulse'|'toggle'} mode
 * @property {number} activate
 * @property {number} release
 * @property {number} [smooth]
 * @property {number} [cooldownMs]
 */

/**
 * @typedef {object} CameraProfile
 * @property {string} id
 * @property {string} name
 * @property {{ head: boolean, face: boolean, hands: boolean, fingers: boolean }} categories
 * @property {Record<string, GestureSettings>} gestures
 * @property {Record<string, string>} bindings  gestureId → game action (empty = unmapped)
 * @property {Record<string, number>|null} calibration
 * @property {boolean} audioFeedback
 * @property {boolean} emitToBridge  false = test/preview only
 */

function defaultGestureSettings() {
  const enabled = defaultEnabledIds();
  /** @type {Record<string, GestureSettings>} */
  const gestures = {};
  for (const g of GESTURE_CATALOG) {
    if (!g.supported) continue;
    gestures[g.id] = {
      enabled: enabled.has(g.id),
      mode: g.defaultMode,
      activate: g.defaultActivate,
      release: g.defaultRelease,
      smooth: 0.35,
      cooldownMs: g.defaultMode === 'pulse' ? 280 : 80,
    };
  }
  return gestures;
}

/** @returns {CameraProfile} */
export function createDefaultProfile(name = 'LibreCorsa — head steer') {
  return {
    id: 'default',
    name,
    categories: { head: true, face: false, hands: false, fingers: false },
    gestures: defaultGestureSettings(),
    bindings: {
      tiltLeft: 'steerLeft',
      tiltRight: 'steerRight',
    },
    calibration: null,
    audioFeedback: false,
    emitToBridge: true,
  };
}

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeStore(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/** @returns {{ activeId: string, profiles: Record<string, CameraProfile> }} */
export function loadProfiles() {
  const store = readStore();
  if (!store?.profiles || !Object.keys(store.profiles).length) {
    const p = createDefaultProfile();
    const data = { activeId: p.id, profiles: { [p.id]: p } };
    writeStore(data);
    return data;
  }
  return {
    activeId: store.activeId || Object.keys(store.profiles)[0],
    profiles: store.profiles,
  };
}

/** @returns {CameraProfile} */
export function getActiveProfile() {
  const { activeId, profiles } = loadProfiles();
  return profiles[activeId] || createDefaultProfile();
}

/** @param {CameraProfile} profile */
export function saveProfile(profile) {
  const data = loadProfiles();
  data.profiles[profile.id] = profile;
  data.activeId = profile.id;
  writeStore(data);
  localStorage.setItem(ACTIVE_KEY, profile.id);
}

/** @param {string} id */
export function setActiveProfile(id) {
  const data = loadProfiles();
  if (!data.profiles[id]) return getActiveProfile();
  data.activeId = id;
  writeStore(data);
  localStorage.setItem(ACTIVE_KEY, id);
  return data.profiles[id];
}

/** @param {string} name */
export function duplicateProfile(name) {
  const current = getActiveProfile();
  const id = `p_${Date.now().toString(36)}`;
  const copy = {
    ...structuredClone(current),
    id,
    name,
  };
  saveProfile(copy);
  return copy;
}

/** @param {string} id */
export function deleteProfile(id) {
  const data = loadProfiles();
  if (id === 'default' || Object.keys(data.profiles).length <= 1) return false;
  delete data.profiles[id];
  if (data.activeId === id) {
    data.activeId = Object.keys(data.profiles)[0];
  }
  writeStore(data);
  return true;
}

export function exportProfileJson(profile = getActiveProfile()) {
  return JSON.stringify({ type: 'gnaa-camera-profile', v: 1, profile }, null, 2);
}

/** @param {string} json */
export function importProfileJson(json) {
  const data = JSON.parse(json);
  const profile = data.profile || data;
  if (!profile?.gestures || !profile?.categories) {
    throw new Error('Invalid camera profile JSON');
  }
  profile.id = profile.id || `p_${Date.now().toString(36)}`;
  profile.name = profile.name || 'Imported profile';
  // Merge with defaults so new gestures appear
  const base = createDefaultProfile(profile.name);
  profile.gestures = { ...base.gestures, ...profile.gestures };
  profile.categories = { ...base.categories, ...profile.categories };
  profile.bindings = profile.bindings || {};
  saveProfile(profile);
  return profile;
}

/**
 * Build interpreter configs from a profile (category gates + per-gesture).
 * @param {CameraProfile} profile
 */
export function gestureConfigsFromProfile(profile) {
  /** @type {Record<string, import('./interpreter.js').GestureRuntimeConfig>} */
  const out = {};
  for (const [id, g] of Object.entries(profile.gestures || {})) {
    const def = GESTURE_CATALOG.find((x) => x.id === id);
    if (!def) continue;
    const catOn = profile.categories?.[def.category] !== false;
    out[id] = {
      enabled: !!(g.enabled && catOn),
      mode: g.mode || def.defaultMode,
      activate: g.activate ?? def.defaultActivate,
      release: g.release ?? def.defaultRelease,
      smooth: g.smooth ?? 0.35,
      cooldownMs: g.cooldownMs,
    };
  }
  return out;
}

/**
 * Remap entries for extension: camera:<id> → gameAction
 * @param {CameraProfile} profile
 */
export function remapEntriesFromProfile(profile) {
  /** @type {Record<string, string>} */
  const entries = {};
  for (const [gestureId, gameAction] of Object.entries(profile.bindings || {})) {
    if (gameAction) entries[`camera:${gestureId}`] = gameAction;
  }
  return entries;
}
