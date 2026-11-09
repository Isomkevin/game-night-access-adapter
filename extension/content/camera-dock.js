/**
 * Floating in-game camera preview dock.
 * Embeds the bridge camera UI (gesture controller) so tracking stays alive
 * while the game tab is focused — no separate camera tab required.
 *
 * Premium utility window: drag, resize (edges + corner), minimize, expand.
 * Preview mode keeps a 4:3 camera stage; expanded mode is free-form for gestures.
 */

const DOCK_ID = 'gnaa-camera-dock';
const STYLE_ID = 'gnaa-camera-dock-style';
const LAYOUT_KEY = 'gnaaCameraDockLayout';

const BAR_H = 36;
/** Compact default — useful preview without dominating the game. */
const DEFAULT_W = 248;
const PREVIEW_RATIO = 4 / 3;
const MIN_W = 200;
const MIN_PREVIEW_H = BAR_H + 120;
const MIN_EXPANDED_H = 280;
const MAX_W_CAP = 560;
const MAX_H_CAP = 780;
const EDGE = 14; // touch-friendly hit target
const MARGIN = 12;

/** @typedef {{ w: number, h: number, left?: number, top?: number, expanded?: boolean }} DockLayout */

function previewHeightForWidth(w) {
  return Math.round(BAR_H + w / PREVIEW_RATIO);
}

function defaultLayout() {
  const w = DEFAULT_W;
  return {
    w,
    h: previewHeightForWidth(w),
    expanded: false,
  };
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function viewportBounds() {
  return {
    vw: window.innerWidth,
    vh: window.innerHeight,
    maxW: Math.min(MAX_W_CAP, window.innerWidth - MARGIN * 2),
    maxH: Math.min(MAX_H_CAP, window.innerHeight - MARGIN * 2),
  };
}

/**
 * @param {DockLayout} layout
 * @param {{ lockAspect?: boolean }} [opts]
 */
function sanitizeLayout(layout, opts = {}) {
  const { maxW, maxH, vw, vh } = viewportBounds();
  const expanded = !!layout.expanded;
  const lockAspect = opts.lockAspect ?? !expanded;
  let w = clamp(layout.w || DEFAULT_W, MIN_W, maxW);
  let h;
  if (lockAspect) {
    h = previewHeightForWidth(w);
    if (h > maxH) {
      h = maxH;
      w = clamp(Math.round((h - BAR_H) * PREVIEW_RATIO), MIN_W, maxW);
      h = previewHeightForWidth(w);
      h = Math.min(h, maxH);
    }
    h = Math.max(h, MIN_PREVIEW_H);
  } else {
    h = clamp(layout.h || MIN_EXPANDED_H, MIN_EXPANDED_H, maxH);
  }

  let left = layout.left;
  let top = layout.top;
  if (typeof left !== 'number' || typeof top !== 'number') {
    left = vw - w - MARGIN;
    top = vh - h - MARGIN;
  }
  left = clamp(left, MARGIN, Math.max(MARGIN, vw - w - MARGIN));
  top = clamp(top, MARGIN, Math.max(MARGIN, vh - h - MARGIN));

  return { w, h, left, top, expanded };
}

async function loadLayout() {
  try {
    const data = await chrome.storage.local.get(LAYOUT_KEY);
    const raw = data[LAYOUT_KEY];
    if (!raw || typeof raw !== 'object') return sanitizeLayout(defaultLayout());
    return sanitizeLayout(raw);
  } catch {
    return sanitizeLayout(defaultLayout());
  }
}

/** @param {DockLayout} layout */
async function saveLayout(layout) {
  try {
    await chrome.storage.local.set({
      [LAYOUT_KEY]: {
        w: layout.w,
        h: layout.h,
        left: layout.left,
        top: layout.top,
        expanded: !!layout.expanded,
      },
    });
  } catch {
    /* ignore */
  }
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${DOCK_ID} {
      position: fixed;
      z-index: 2147483646;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      background: #0b3d3a;
      color: #f3ede3;
      border: 1px solid rgba(31, 92, 87, 0.95);
      border-radius: 12px;
      box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.06) inset,
        0 12px 40px rgba(0, 0, 0, 0.45);
      overflow: hidden;
      font-family: "Atkinson Hyperlegible", "Segoe UI", system-ui, sans-serif;
      touch-action: none;
      transition: box-shadow 160ms ease, border-color 160ms ease;
    }
    #${DOCK_ID}.is-resizing,
    #${DOCK_ID}.is-dragging {
      box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.08) inset,
        0 16px 48px rgba(0, 0, 0, 0.55);
      border-color: rgba(224, 138, 30, 0.55);
      user-select: none;
    }
    #${DOCK_ID}.is-resizing iframe,
    #${DOCK_ID}.is-dragging iframe {
      pointer-events: none;
    }
    #${DOCK_ID}.is-minimized {
      height: ${BAR_H}px !important;
      min-height: ${BAR_H}px;
    }
    #${DOCK_ID}.is-minimized iframe,
    #${DOCK_ID}.is-minimized .gnaa-dock-handle {
      display: none !important;
    }
    #${DOCK_ID} .gnaa-dock-bar {
      display: flex;
      align-items: center;
      gap: 6px;
      height: ${BAR_H}px;
      padding: 0 8px;
      background: linear-gradient(180deg, #0a3532 0%, #072e2c 100%);
      cursor: grab;
      user-select: none;
      flex: 0 0 auto;
      border-bottom: 1px solid rgba(31, 92, 87, 0.7);
    }
    #${DOCK_ID} .gnaa-dock-bar:active {
      cursor: grabbing;
    }
    #${DOCK_ID} .gnaa-dock-title {
      flex: 1;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.02em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #${DOCK_ID} .gnaa-dock-bar button {
      min-width: 28px;
      min-height: 28px;
      padding: 0 6px;
      border: 0;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.1);
      color: #f3ede3;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: background 140ms ease, color 140ms ease;
    }
    #${DOCK_ID} .gnaa-dock-bar button:hover {
      background: rgba(224, 138, 30, 0.9);
      color: #1a1408;
    }
    #${DOCK_ID} .gnaa-dock-bar button:focus-visible {
      outline: 2px solid #e08a1e;
      outline-offset: 2px;
    }
    #${DOCK_ID} iframe {
      flex: 1 1 auto;
      width: 100%;
      border: 0;
      background: #000;
      min-height: 0;
    }
    #${DOCK_ID} .gnaa-dock-handle {
      position: absolute;
      z-index: 2;
      background: transparent;
      border: 0;
      padding: 0;
      opacity: 0;
      transition: opacity 140ms ease, background 140ms ease;
    }
    #${DOCK_ID}:hover .gnaa-dock-handle,
    #${DOCK_ID}:focus-within .gnaa-dock-handle,
    #${DOCK_ID}.is-resizing .gnaa-dock-handle {
      opacity: 1;
    }
    #${DOCK_ID} .gnaa-dock-handle:focus-visible {
      opacity: 1;
      outline: 2px solid #e08a1e;
      outline-offset: -2px;
    }
    #${DOCK_ID} .gnaa-dock-handle-e {
      top: ${BAR_H}px;
      right: 0;
      width: ${EDGE}px;
      bottom: ${EDGE}px;
      cursor: ew-resize;
    }
    #${DOCK_ID} .gnaa-dock-handle-s {
      left: 0;
      right: ${EDGE}px;
      bottom: 0;
      height: ${EDGE}px;
      cursor: ns-resize;
    }
    #${DOCK_ID} .gnaa-dock-handle-se {
      right: 0;
      bottom: 0;
      width: 22px;
      height: 22px;
      cursor: nwse-resize;
      border-radius: 0 0 11px 0;
    }
    #${DOCK_ID} .gnaa-dock-handle-se::after {
      content: "";
      position: absolute;
      right: 5px;
      bottom: 5px;
      width: 10px;
      height: 10px;
      background:
        linear-gradient(135deg, transparent 45%, rgba(243, 237, 227, 0.35) 46%, rgba(243, 237, 227, 0.35) 54%, transparent 55%),
        linear-gradient(135deg, transparent 60%, rgba(243, 237, 227, 0.55) 61%, rgba(243, 237, 227, 0.55) 72%, transparent 73%);
      pointer-events: none;
    }
    #${DOCK_ID} .gnaa-dock-handle-e:hover,
    #${DOCK_ID} .gnaa-dock-handle-s:hover,
    #${DOCK_ID}.is-resizing .gnaa-dock-handle-e,
    #${DOCK_ID}.is-resizing .gnaa-dock-handle-s {
      background: rgba(224, 138, 30, 0.16);
    }
    #${DOCK_ID} .gnaa-dock-handle-se:hover,
    #${DOCK_ID}.is-resizing .gnaa-dock-handle-se {
      background: rgba(224, 138, 30, 0.22);
    }
    @media (hover: none) {
      #${DOCK_ID} .gnaa-dock-handle {
        opacity: 0.85;
      }
      #${DOCK_ID} .gnaa-dock-handle-e {
        width: 18px;
      }
      #${DOCK_ID} .gnaa-dock-handle-s {
        height: 18px;
      }
      #${DOCK_ID} .gnaa-dock-handle-se {
        width: 28px;
        height: 28px;
      }
    }
  `;
  (document.documentElement || document.head).appendChild(style);
}

function removeDock() {
  window.removeEventListener('resize', onViewportResize);
  document.getElementById(DOCK_ID)?.remove();
}

/** @type {(() => void)|null} */
let applyViewportClamp = null;

function onViewportResize() {
  applyViewportClamp?.();
}

/**
 * @param {HTMLElement} dock
 * @param {DockLayout} layout
 */
function applyGeometry(dock, layout) {
  const next = sanitizeLayout(layout, { lockAspect: !layout.expanded });
  dock.style.left = `${next.left}px`;
  dock.style.top = `${next.top}px`;
  dock.style.right = 'auto';
  dock.style.bottom = 'auto';
  dock.style.width = `${next.w}px`;
  if (!dock.classList.contains('is-minimized')) {
    dock.style.height = `${next.h}px`;
  }
  return next;
}

/**
 * @param {string} cameraUrl absolute URL to camera embed page
 */
async function showDock(cameraUrl) {
  ensureStyles();
  removeDock();

  let layout = await loadLayout();

  const dock = document.createElement('div');
  dock.id = DOCK_ID;
  dock.setAttribute('role', 'complementary');
  dock.setAttribute('aria-label', 'Game Night camera preview');
  dock.tabIndex = -1;
  if (layout.expanded) dock.classList.add('is-expanded');

  const bar = document.createElement('div');
  bar.className = 'gnaa-dock-bar';

  const title = document.createElement('span');
  title.className = 'gnaa-dock-title';
  title.textContent = layout.expanded ? 'Camera + gestures' : 'Camera preview';

  const btnMin = document.createElement('button');
  btnMin.type = 'button';
  btnMin.title = 'Minimize';
  btnMin.setAttribute('aria-label', 'Minimize camera preview');
  btnMin.textContent = '–';

  const btnExpand = document.createElement('button');
  btnExpand.type = 'button';
  btnExpand.title = layout.expanded ? 'Compact preview' : 'Show gesture controls';
  btnExpand.setAttribute(
    'aria-label',
    layout.expanded ? 'Switch to compact camera preview' : 'Expand camera for gesture setup'
  );
  btnExpand.setAttribute('aria-pressed', layout.expanded ? 'true' : 'false');
  btnExpand.textContent = '▣';

  const btnClose = document.createElement('button');
  btnClose.type = 'button';
  btnClose.title = 'Close';
  btnClose.setAttribute('aria-label', 'Close camera preview');
  btnClose.textContent = '×';

  const frame = document.createElement('iframe');
  frame.src = cameraUrl;
  frame.title = 'Game Night camera';
  frame.allow = 'camera; microphone';
  frame.setAttribute('allowfullscreen', 'false');

  const handleE = document.createElement('button');
  handleE.type = 'button';
  handleE.className = 'gnaa-dock-handle gnaa-dock-handle-e';
  handleE.setAttribute('aria-label', 'Resize camera overlay width');
  handleE.tabIndex = 0;
  handleE.dataset.edge = 'e';

  const handleS = document.createElement('button');
  handleS.type = 'button';
  handleS.className = 'gnaa-dock-handle gnaa-dock-handle-s';
  handleS.setAttribute('aria-label', 'Resize camera overlay height');
  handleS.tabIndex = 0;
  handleS.dataset.edge = 's';

  const handleSE = document.createElement('button');
  handleSE.type = 'button';
  handleSE.className = 'gnaa-dock-handle gnaa-dock-handle-se';
  handleSE.setAttribute('aria-label', 'Resize camera overlay');
  handleSE.title = 'Drag to resize';
  handleSE.tabIndex = 0;
  handleSE.dataset.edge = 'se';

  bar.append(title, btnMin, btnExpand, btnClose);
  dock.append(bar, frame, handleE, handleS, handleSE);
  document.documentElement.appendChild(dock);

  layout = applyGeometry(dock, layout);
  await saveLayout(layout);

  applyViewportClamp = () => {
    layout = applyGeometry(dock, layout);
    saveLayout(layout);
  };
  window.addEventListener('resize', onViewportResize);

  /** Drag title bar */
  let dragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragOrigLeft = 0;
  let dragOrigTop = 0;

  bar.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    if (e.button != null && e.button !== 0) return;
    dragging = true;
    dock.classList.add('is-dragging');
    bar.setPointerCapture(e.pointerId);
    const rect = dock.getBoundingClientRect();
    layout = applyGeometry(dock, {
      ...layout,
      left: rect.left,
      top: rect.top,
      w: rect.width,
      h: dock.classList.contains('is-minimized') ? layout.h : rect.height,
    });
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragOrigLeft = layout.left;
    dragOrigTop = layout.top;
  });
  bar.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const { vw, vh } = viewportBounds();
    const w = layout.w;
    const h = dock.classList.contains('is-minimized') ? BAR_H : layout.h;
    layout.left = clamp(dragOrigLeft + (e.clientX - dragStartX), MARGIN, Math.max(MARGIN, vw - w - MARGIN));
    layout.top = clamp(dragOrigTop + (e.clientY - dragStartY), MARGIN, Math.max(MARGIN, vh - h - MARGIN));
    dock.style.left = `${layout.left}px`;
    dock.style.top = `${layout.top}px`;
  });
  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    dock.classList.remove('is-dragging');
    saveLayout(layout);
  };
  bar.addEventListener('pointerup', endDrag);
  bar.addEventListener('pointercancel', endDrag);

  /** Resize via edge/corner handles */
  let resizing = false;
  /** @type {string} */
  let resizeEdge = 'se';
  let resizeStartX = 0;
  let resizeStartY = 0;
  let resizeOrigW = 0;
  let resizeOrigH = 0;
  let resizeOrigLeft = 0;
  let resizeOrigTop = 0;

  /**
   * @param {PointerEvent} e
   * @param {string} edge
   */
  function beginResize(e, edge) {
    if (dock.classList.contains('is-minimized')) return;
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    resizing = true;
    resizeEdge = edge;
    dock.classList.add('is-resizing');
    const target = /** @type {HTMLElement} */ (e.currentTarget);
    target.setPointerCapture(e.pointerId);
    const rect = dock.getBoundingClientRect();
    layout = applyGeometry(dock, {
      ...layout,
      left: rect.left,
      top: rect.top,
      w: rect.width,
      h: rect.height,
    });
    resizeStartX = e.clientX;
    resizeStartY = e.clientY;
    resizeOrigW = layout.w;
    resizeOrigH = layout.h;
    resizeOrigLeft = layout.left;
    resizeOrigTop = layout.top;
  }

  /**
   * @param {PointerEvent} e
   */
  function moveResize(e) {
    if (!resizing) return;
    const { maxW, maxH } = viewportBounds();
    const dx = e.clientX - resizeStartX;
    const dy = e.clientY - resizeStartY;
    const expanded = !!layout.expanded;
    let nextW = resizeOrigW;
    let nextH = resizeOrigH;

    if (resizeEdge === 'e' || resizeEdge === 'se') {
      nextW = resizeOrigW + dx;
    }
    if (resizeEdge === 's' || resizeEdge === 'se') {
      nextH = resizeOrigH + dy;
    }

    if (!expanded) {
      // Preview: width drives height (4:3 stage + chrome). Corner/east preferred.
      if (resizeEdge === 's') {
        nextH = clamp(nextH, MIN_PREVIEW_H, maxH);
        nextW = clamp(Math.round((nextH - BAR_H) * PREVIEW_RATIO), MIN_W, maxW);
        nextH = previewHeightForWidth(nextW);
      } else {
        nextW = clamp(nextW, MIN_W, maxW);
        nextH = previewHeightForWidth(nextW);
        if (nextH > maxH) {
          nextH = maxH;
          nextW = clamp(Math.round((nextH - BAR_H) * PREVIEW_RATIO), MIN_W, maxW);
          nextH = Math.min(previewHeightForWidth(nextW), maxH);
        }
      }
    } else {
      nextW = clamp(nextW, MIN_W, maxW);
      nextH = clamp(nextH, MIN_EXPANDED_H, maxH);
    }

    layout = sanitizeLayout({
      ...layout,
      w: nextW,
      h: nextH,
      left: resizeOrigLeft,
      top: resizeOrigTop,
      expanded,
    });
    dock.style.width = `${layout.w}px`;
    dock.style.height = `${layout.h}px`;
    dock.style.left = `${layout.left}px`;
    dock.style.top = `${layout.top}px`;
  }

  function endResize() {
    if (!resizing) return;
    resizing = false;
    dock.classList.remove('is-resizing');
    saveLayout(layout);
  }

  for (const handle of [handleE, handleS, handleSE]) {
    handle.addEventListener('pointerdown', (e) => beginResize(e, handle.dataset.edge || 'se'));
    handle.addEventListener('pointermove', moveResize);
    handle.addEventListener('pointerup', endResize);
    handle.addEventListener('pointercancel', endResize);
    handle.addEventListener('keydown', (e) => {
      if (dock.classList.contains('is-minimized')) return;
      const step = e.shiftKey ? 24 : 12;
      let dw = 0;
      let dh = 0;
      if (e.key === 'ArrowRight') dw = step;
      else if (e.key === 'ArrowLeft') dw = -step;
      else if (e.key === 'ArrowDown') dh = step;
      else if (e.key === 'ArrowUp') dh = -step;
      else return;
      e.preventDefault();
      const expanded = !!layout.expanded;
      const edge = handle.dataset.edge || 'se';
      let w = layout.w;
      let h = layout.h;
      if (!expanded) {
        if (edge === 's' || (edge === 'se' && !dw && dh)) {
          h = clamp(layout.h + dh, MIN_PREVIEW_H, viewportBounds().maxH);
          w = clamp(Math.round((h - BAR_H) * PREVIEW_RATIO), MIN_W, viewportBounds().maxW);
          h = previewHeightForWidth(w);
        } else {
          w = clamp(layout.w + (dw || (dh ? Math.round(dh * PREVIEW_RATIO) : 0)), MIN_W, viewportBounds().maxW);
          h = previewHeightForWidth(w);
        }
      } else {
        if (edge === 'e') w = layout.w + dw;
        else if (edge === 's') h = layout.h + dh;
        else {
          w = layout.w + dw;
          h = layout.h + dh;
        }
      }
      layout = applyGeometry(dock, { ...layout, w, h, expanded });
      saveLayout(layout);
    });
  }

  btnMin.addEventListener('click', () => {
    const minimized = dock.classList.toggle('is-minimized');
    if (minimized) {
      dock.style.height = `${BAR_H}px`;
      btnMin.textContent = '+';
      btnMin.title = 'Restore';
      btnMin.setAttribute('aria-label', 'Restore camera preview');
    } else {
      layout = applyGeometry(dock, layout);
      btnMin.textContent = '–';
      btnMin.title = 'Minimize';
      btnMin.setAttribute('aria-label', 'Minimize camera preview');
    }
  });

  btnExpand.addEventListener('click', () => {
    dock.classList.remove('is-minimized');
    btnMin.textContent = '–';
    btnMin.title = 'Minimize';
    btnMin.setAttribute('aria-label', 'Minimize camera preview');

    layout.expanded = !layout.expanded;
    if (layout.expanded) {
      const { maxW, maxH } = viewportBounds();
      layout.w = clamp(Math.max(layout.w, 320), MIN_W, maxW);
      layout.h = clamp(Math.max(layout.h, 420), MIN_EXPANDED_H, maxH);
      title.textContent = 'Camera + gestures';
      btnExpand.title = 'Compact preview';
      btnExpand.setAttribute('aria-label', 'Switch to compact camera preview');
      btnExpand.setAttribute('aria-pressed', 'true');
      dock.classList.add('is-expanded');
    } else {
      layout.h = previewHeightForWidth(layout.w);
      title.textContent = 'Camera preview';
      btnExpand.title = 'Show gesture controls';
      btnExpand.setAttribute('aria-label', 'Expand camera for gesture setup');
      btnExpand.setAttribute('aria-pressed', 'false');
      dock.classList.remove('is-expanded');
    }
    layout = applyGeometry(dock, layout);
    saveLayout(layout);
  });

  btnClose.addEventListener('click', () => {
    removeDock();
    chrome.runtime.sendMessage({ type: 'gnaa-camera-dock-closed' }).catch(() => {});
  });
}

function isDockOpen() {
  return !!document.getElementById(DOCK_ID);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || !msg.type) return;
  if (msg.type === 'gnaa-camera-dock') {
    (async () => {
      try {
        if (msg.action === 'hide' || (msg.action === 'toggle' && isDockOpen())) {
          removeDock();
          sendResponse({ ok: true, open: false });
          return;
        }
        if (!msg.url) {
          sendResponse({ ok: false, error: 'Missing camera URL' });
          return;
        }
        await showDock(msg.url);
        sendResponse({ ok: true, open: true });
      } catch (err) {
        sendResponse({ ok: false, error: String(err?.message || err) });
      }
    })();
    return true;
  }
  if (msg.type === 'gnaa-camera-dock-status') {
    sendResponse({ ok: true, open: isDockOpen() });
    return true;
  }
});
