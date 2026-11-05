/**
 * Camera setup UI: categories, meters, calibration, mapping, profiles, pause/test.
 */

import {
  GESTURE_CATALOG,
  CATEGORY_LABELS,
  supportedGestures,
} from '../lib/catalog.js';
import {
  loadProfiles,
  saveProfile,
  setActiveProfile,
  duplicateProfile,
  deleteProfile,
  exportProfileJson,
  importProfileJson,
  remapEntriesFromProfile,
} from '../lib/profiles.js';

const GAME_ACTIONS = [
  { id: '', label: '(unmapped)' },
  { id: 'steerLeft', label: 'Steer left' },
  { id: 'steerRight', label: 'Steer right' },
  { id: 'throttle', label: 'Throttle' },
  { id: 'brake', label: 'Brake' },
  { id: 'boost', label: 'Boost' },
  { id: 'pause', label: 'Pause menu' },
  { id: 'shiftUp', label: 'Gear up' },
  { id: 'shiftDown', label: 'Gear down' },
  { id: 'aero', label: 'Active aero / DRS' },
  { id: 'restart', label: 'Restart' },
];

/**
 * @param {object} api
 * @param {() => import('../lib/profiles.js').CameraProfile} api.getProfile
 * @param {(p: import('../lib/profiles.js').CameraProfile) => void} api.setProfile
 * @param {() => void} api.onProfileChange
 * @param {() => Promise<void>} api.calibrate
 * @param {() => void} api.togglePause
 * @param {() => boolean} api.isPaused
 * @param {() => void} api.applyRemap
 * @param {(msg: string) => void} [api.setStatus]
 */
export function mountSetupUI(root, api) {
  root.innerHTML = `
    <div class="panel controls">
      <div class="toolbar">
        <button type="button" id="btn-pause" class="danger">Pause control</button>
        <button type="button" id="btn-calibrate">Calibrate neutral</button>
        <button type="button" id="btn-apply-remap">Apply mappings to extension</button>
        <label class="check"><input type="checkbox" id="chk-emit" checked /> Emit to game</label>
        <label class="check"><input type="checkbox" id="chk-audio" /> Audio feedback</label>
      </div>

      <div class="toolbar profiles">
        <label>Profile
          <select id="profile-select"></select>
        </label>
        <button type="button" id="btn-save-profile" class="secondary">Save</button>
        <button type="button" id="btn-new-profile" class="secondary">Duplicate</button>
        <button type="button" id="btn-export-profile" class="secondary">Export</button>
        <label class="import secondary">Import<input type="file" id="import-profile" accept="application/json,.json" /></label>
        <button type="button" id="btn-delete-profile" class="secondary">Delete</button>
      </div>

      <div class="categories" id="categories"></div>
      <p class="hint cpu-hint" id="cpu-hint" hidden>
        Face + hands together increases CPU use. Disable categories you do not need.
      </p>

      <div class="live-row">
        <div>
          <h2>Live signals</h2>
          <div id="meters" class="meters"></div>
        </div>
        <div>
          <h2>Recognized</h2>
          <ul id="active-list" class="active-list" aria-live="polite"></ul>
          <p class="hint">Test movements here before playing. Unreliable signals show as dim meters.</p>
        </div>
      </div>

      <h2>Gestures &amp; mappings</h2>
      <p class="hint">Enable only movements you can perform comfortably. Map each to a game action, then Apply to extension.</p>
      <div id="gesture-table" class="gesture-table"></div>
    </div>
  `;

  const els = {
    pause: root.querySelector('#btn-pause'),
    calibrate: root.querySelector('#btn-calibrate'),
    applyRemap: root.querySelector('#btn-apply-remap'),
    emit: root.querySelector('#chk-emit'),
    audio: root.querySelector('#chk-audio'),
    profileSelect: root.querySelector('#profile-select'),
    saveProfile: root.querySelector('#btn-save-profile'),
    newProfile: root.querySelector('#btn-new-profile'),
    exportProfile: root.querySelector('#btn-export-profile'),
    importProfile: root.querySelector('#import-profile'),
    deleteProfile: root.querySelector('#btn-delete-profile'),
    categories: root.querySelector('#categories'),
    cpuHint: root.querySelector('#cpu-hint'),
    meters: root.querySelector('#meters'),
    activeList: root.querySelector('#active-list'),
    gestureTable: root.querySelector('#gesture-table'),
  };

  function profile() {
    return api.getProfile();
  }

  function persist() {
    saveProfile(profile());
    api.onProfileChange();
  }

  function refreshProfileSelect() {
    const { activeId, profiles } = loadProfiles();
    els.profileSelect.innerHTML = Object.values(profiles)
      .map(
        (p) =>
          `<option value="${p.id}" ${p.id === activeId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`
      )
      .join('');
  }

  function renderCategories() {
    const p = profile();
    els.categories.innerHTML = '';
    for (const [id, label] of Object.entries(CATEGORY_LABELS)) {
      const wrap = document.createElement('label');
      wrap.className = 'cat';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!p.categories[id];
      cb.addEventListener('change', () => {
        p.categories[id] = cb.checked;
        persist();
        renderGestureTable();
        updateCpuHint();
      });
      wrap.append(cb, document.createTextNode(label));
      els.categories.append(wrap);
    }
    updateCpuHint();
  }

  function updateCpuHint() {
    const p = profile();
    const heavy = p.categories.face && (p.categories.hands || p.categories.fingers);
    const needHands = p.categories.hands || p.categories.fingers;
    els.cpuHint.hidden = !(heavy || (needHands && p.categories.head));
  }

  function renderGestureTable() {
    const p = profile();
    els.gestureTable.innerHTML = '';

    /** @type {Record<string, typeof GESTURE_CATALOG>} */
    const byCat = {};
    for (const g of supportedGestures()) {
      if (!byCat[g.category]) byCat[g.category] = [];
      byCat[g.category].push(g);
    }

    for (const [cat, gestures] of Object.entries(byCat)) {
      const section = document.createElement('section');
      section.className = 'gesture-section';
      const h = document.createElement('h3');
      h.textContent = CATEGORY_LABELS[cat] || cat;
      section.append(h);

      if (!p.categories[cat]) {
        const off = document.createElement('p');
        off.className = 'hint';
        off.textContent = 'Category disabled — enable above to configure.';
        section.append(off);
        els.gestureTable.append(section);
        continue;
      }

      for (const g of gestures) {
        const row = document.createElement('div');
        row.className = 'gesture-row';
        row.dataset.gesture = g.id;

        const gs = p.gestures[g.id] || {
          enabled: false,
          mode: g.defaultMode,
          activate: g.defaultActivate,
          release: g.defaultRelease,
        };

        const en = document.createElement('input');
        en.type = 'checkbox';
        en.checked = !!gs.enabled;
        en.title = 'Enable';
        en.addEventListener('change', () => {
          p.gestures[g.id] = { ...gs, enabled: en.checked };
          persist();
        });

        const label = document.createElement('div');
        label.className = 'g-label';
        label.innerHTML = `<strong>${escapeHtml(g.label)}</strong><code>${g.id}</code>${
          g.note ? `<span class="note">${escapeHtml(g.note)}</span>` : ''
        }`;

        const mode = document.createElement('select');
        mode.setAttribute('aria-label', `${g.label} mode`);
        for (const m of ['hold', 'pulse', 'toggle']) {
          const o = document.createElement('option');
          o.value = m;
          o.textContent = m;
          if (m === gs.mode) o.selected = true;
          mode.append(o);
        }
        mode.addEventListener('change', () => {
          p.gestures[g.id] = { ...p.gestures[g.id], mode: mode.value };
          persist();
        });

        const act = document.createElement('input');
        act.type = 'range';
        act.min = '0.02';
        act.max = '0.9';
        act.step = '0.01';
        act.value = String(gs.activate);
        act.title = 'Activation threshold';
        act.addEventListener('input', () => {
          const v = Number(act.value);
          const release = Math.min(p.gestures[g.id].release, v - 0.02);
          p.gestures[g.id] = { ...p.gestures[g.id], activate: v, release };
          rel.value = String(release);
          persist();
        });

        const rel = document.createElement('input');
        rel.type = 'range';
        rel.min = '0.01';
        rel.max = '0.85';
        rel.step = '0.01';
        rel.value = String(gs.release);
        rel.title = 'Release threshold';
        rel.addEventListener('input', () => {
          const v = Number(rel.value);
          p.gestures[g.id] = { ...p.gestures[g.id], release: v };
          persist();
        });

        const bind = document.createElement('select');
        bind.setAttribute('aria-label', `${g.label} game action`);
        for (const a of GAME_ACTIONS) {
          const o = document.createElement('option');
          o.value = a.id;
          o.textContent = a.label;
          if ((p.bindings[g.id] || '') === a.id) o.selected = true;
          bind.append(o);
        }
        bind.addEventListener('change', () => {
          if (bind.value) p.bindings[g.id] = bind.value;
          else delete p.bindings[g.id];
          persist();
        });

        const flash = document.createElement('span');
        flash.className = 'flash';
        flash.dataset.flash = g.id;

        row.append(en, label, mode, act, rel, bind, flash);
        section.append(row);
      }
      els.gestureTable.append(section);
    }
  }

  const meterKeys = [
    ['yaw', 'Yaw'],
    ['pitch', 'Pitch'],
    ['roll', 'Roll'],
    ['jawOpen', 'Mouth'],
    ['smile', 'Smile'],
    ['blinkLeft', 'Blink L'],
    ['blinkRight', 'Blink R'],
    ['handRaise', 'Hand↑'],
    ['pinch', 'Pinch'],
  ];

  function ensureMeters() {
    if (els.meters.childElementCount) return;
    for (const [key, label] of meterKeys) {
      const row = document.createElement('div');
      row.className = 'meter';
      row.innerHTML = `<span>${label}</span><div class="bar"><i data-meter="${key}"></i></div><code data-val="${key}">0</code>`;
      els.meters.append(row);
    }
  }

  /** @type {Map<string, number>} */
  const flashUntil = new Map();

  /**
   * @param {Record<string, number>} signals
   * @param {string[]} activeIds
   */
  function updateLive(signals, activeIds) {
    ensureMeters();
    for (const [key] of meterKeys) {
      const v = signals[key] ?? 0;
      const bar = els.meters.querySelector(`[data-meter="${key}"]`);
      const val = els.meters.querySelector(`[data-val="${key}"]`);
      if (bar) {
        const pct = Math.min(100, Math.abs(v) * 100);
        bar.style.width = `${pct}%`;
        bar.parentElement.classList.toggle('dim', Math.abs(v) < 0.05);
      }
      if (val) val.textContent = Number(v).toFixed(2);
    }

    const now = performance.now();
    for (const id of activeIds) flashUntil.set(id, now + 400);

    els.activeList.innerHTML = '';
    const show = [...flashUntil.entries()].filter(([, t]) => t > now);
    for (const [id] of show) {
      const g = GESTURE_CATALOG.find((x) => x.id === id);
      const li = document.createElement('li');
      li.textContent = g?.label || id;
      els.activeList.append(li);
      const flash = root.querySelector(`[data-flash="${id}"]`);
      if (flash) flash.classList.add('on');
    }
    for (const el of root.querySelectorAll('.flash.on')) {
      const id = el.getAttribute('data-flash');
      if (!flashUntil.has(id) || flashUntil.get(id) <= now) el.classList.remove('on');
    }
  }

  // Wire controls
  els.pause.addEventListener('click', () => {
    api.togglePause();
    const paused = api.isPaused();
    els.pause.textContent = paused ? 'Resume control' : 'Pause control';
    els.pause.classList.toggle('danger', !paused);
  });

  els.calibrate.addEventListener('click', async () => {
    els.calibrate.disabled = true;
    els.calibrate.textContent = 'Hold still…';
    try {
      await api.calibrate();
      if (api.setStatus) api.setStatus('Calibration saved');
    } finally {
      els.calibrate.disabled = false;
      els.calibrate.textContent = 'Calibrate neutral';
    }
  });

  els.applyRemap.addEventListener('click', () => {
    api.applyRemap();
    if (api.setStatus) api.setStatus('Mappings sent to extension');
  });

  els.emit.addEventListener('change', () => {
    profile().emitToBridge = els.emit.checked;
    persist();
  });

  els.audio.addEventListener('change', () => {
    profile().audioFeedback = els.audio.checked;
    persist();
  });

  els.profileSelect.addEventListener('change', () => {
    const p = setActiveProfile(els.profileSelect.value);
    api.setProfile(p);
    syncFromProfile();
    api.onProfileChange();
  });

  els.saveProfile.addEventListener('click', () => {
    const name = prompt('Profile name', profile().name);
    if (!name) return;
    profile().name = name;
    persist();
    refreshProfileSelect();
  });

  els.newProfile.addEventListener('click', () => {
    const name = prompt('Name for duplicated profile', `${profile().name} copy`);
    if (!name) return;
    const p = duplicateProfile(name);
    api.setProfile(p);
    syncFromProfile();
    api.onProfileChange();
  });

  els.exportProfile.addEventListener('click', () => {
    const blob = new Blob([exportProfileJson(profile())], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'gnaa-camera-profile.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  els.importProfile.addEventListener('change', async () => {
    const file = els.importProfile.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const p = importProfileJson(text);
      api.setProfile(p);
      syncFromProfile();
      api.onProfileChange();
    } catch (err) {
      alert(err.message || String(err));
    }
    els.importProfile.value = '';
  });

  els.deleteProfile.addEventListener('click', () => {
    if (!confirm('Delete this profile?')) return;
    if (!deleteProfile(profile().id)) {
      alert('Cannot delete the last/default profile.');
      return;
    }
    api.setProfile(setActiveProfile(loadProfiles().activeId));
    syncFromProfile();
    api.onProfileChange();
  });

  function syncFromProfile() {
    const p = profile();
    els.emit.checked = p.emitToBridge !== false;
    els.audio.checked = !!p.audioFeedback;
    refreshProfileSelect();
    renderCategories();
    renderGestureTable();
  }

  syncFromProfile();

  return {
    updateLive,
    refresh: syncFromProfile,
    getRemapEntries: () => remapEntriesFromProfile(profile()),
  };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
