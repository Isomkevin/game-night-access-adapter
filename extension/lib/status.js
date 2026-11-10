/**
 * Plain-language status helpers for popup + options.
 * Keep technical URLs / worker jargon out of primary UI.
 */

/** Default LibreCorsa demo hosts (fallback when no tab is pinned). */
export const GAME_TAB_URLS = [
  'http://localhost:3000/*',
  'http://127.0.0.1:3000/*',
  'https://khazp.github.io/librecorsa/*',
];

export const GAME_OPEN_URL = 'http://localhost:3000/';

export const METHOD_META = Object.freeze({
  demo: {
    id: 'demo',
    title: 'On-screen controls',
    blurb: 'Large buttons in the extension popup. No phone or camera needed.',
    needs: 'Chrome extension and the game focused while driving.',
    readiness: 'available',
    readinessLabel: 'Available',
  },
  phone: {
    id: 'phone',
    title: 'Phone controller',
    blurb: 'Use your smartphone as a wireless controller over Wi‑Fi.',
    needs: 'Phone and computer on the same Wi‑Fi. Access bridge running.',
    readiness: 'available',
    readinessLabel: 'Available',
  },
  camera: {
    id: 'camera',
    title: 'Head & vision',
    blurb: 'Control the car with head, face, or hand movements using your webcam.',
    needs: 'Webcam permission and the access bridge running.',
    readiness: 'experimental',
    readinessLabel: 'Experimental',
  },
  voice: {
    id: 'voice',
    title: 'Voice commands',
    blurb: 'Speak commands right in the game tab — “go”, “brake”, “left”, “boost”.',
    needs: 'Google Chrome and microphone permission. No bridge needed.',
    readiness: 'experimental',
    readinessLabel: 'Experimental',
  },
  custom: {
    id: 'custom',
    title: 'Custom controls',
    blurb: 'Choose how each input maps to a game action. Fully remappable.',
    needs: 'None beyond this setup page.',
    readiness: 'available',
    readinessLabel: 'Available',
  },
});

export const SOURCE_GROUP_LABELS = Object.freeze({
  demo: 'On-screen controls',
  camera: 'Head & vision',
  voice: 'Voice commands',
  phone: 'Phone controller',
});

/**
 * Short label for a pinned game tab.
 * @param {{ targetTabTitle?: string, targetTabHost?: string, targetTabUrl?: string }|null|undefined} s
 */
export function describePinnedTab(s) {
  if (!s) return '';
  if (s.targetTabHost) return s.targetTabHost;
  if (s.targetTabTitle) return s.targetTabTitle;
  if (s.targetTabUrl) {
    try {
      return new URL(s.targetTabUrl).host || s.targetTabUrl;
    } catch {
      return s.targetTabUrl;
    }
  }
  return '';
}

/**
 * @param {{ bridgeStatus?: string, gameTabOpen?: boolean, workerOk?: boolean }} s
 */
export function describeConnection(s) {
  if (s.workerOk === false) {
    return {
      tone: 'danger',
      title: 'Extension stopped',
      detail: 'Open chrome://extensions, find Game Night Access Adapter, and click Reload.',
    };
  }
  if (s.bridgeStatus === 'connected') {
    return {
      tone: 'ok',
      title: 'Access inputs connected',
      detail: 'Phone, camera, and voice can reach the game.',
    };
  }
  if (s.bridgeStatus === 'connecting') {
    return {
      tone: 'warn',
      title: 'Connecting access inputs…',
      detail: 'If this stays, start the access bridge or use on-screen controls.',
    };
  }
  return {
    tone: 'warn',
    title: 'Access inputs offline',
    detail: 'On-screen controls still work. Start the access bridge for phone, camera, or voice.',
  };
}

/**
 * @param {{
 *   gameTabOpen?: boolean,
 *   targetTabId?: number|null,
 *   targetTabTitle?: string,
 *   targetTabHost?: string,
 *   targetTabUrl?: string,
 * }} s
 */
export function describeGame(s) {
  const pin = describePinnedTab(s);
  if (s.targetTabId && pin) {
    return {
      tone: 'ok',
      title: `Playing: ${pin}`,
      detail: 'Click the game so it can receive controls, then keep that tab focused.',
    };
  }
  if (s.gameTabOpen) {
    return {
      tone: 'ok',
      title: 'Game is open',
      detail: 'Click the race so the game can receive controls, then start driving.',
    };
  }
  return {
    tone: 'warn',
    title: 'No game tab pinned',
    detail: 'Open your game, then click Use this tab — or Open game for the LibreCorsa demo.',
  };
}

/**
 * @param {'demo'|'phone'|'camera'|'voice'|string} method
 * @param {{ bridgeStatus?: string }} s
 */
export function describeMethodReady(method, s) {
  if (method === 'voice') {
    return {
      tone: 'ok',
      title: 'Voice commands ready',
      detail: 'Click Voice control in the popup (or press Alt+Shift+V) on the game tab.',
    };
  }
  if (!method || method === 'demo' || method === 'custom') {
    return {
      tone: 'ok',
      title: 'On-screen controls ready',
      detail: 'Use the extension popup buttons while the game is focused and driving.',
    };
  }
  if (s.bridgeStatus === 'connected') {
    return {
      tone: 'ok',
      title: `${METHOD_META[method]?.title || 'Controls'} ready`,
      detail: 'Access inputs are connected. Keep the control page open.',
    };
  }
  return {
    tone: 'warn',
    title: 'Selected controls need the access bridge',
    detail: 'Start the bridge, then open the phone, camera, or voice page from Setup.',
  };
}

/** Badge text for the toolbar icon */
export function badgeForBridge(bridgeStatus) {
  if (bridgeStatus === 'connected') return { text: 'ON', color: '#1f7a4c' };
  if (bridgeStatus === 'connecting') return { text: '…', color: '#9a6700' };
  return { text: 'OFF', color: '#5a6574' };
}
