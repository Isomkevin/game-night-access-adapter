/**
 * In-tab voice control: Chrome speech recognition runs inside the game tab and
 * sends voice commands straight to the service worker, so no bridge or separate
 * voice page is needed. Idle until started from the popup, shortcut, or indicator.
 */

(() => {
  const PILL_ID = 'gnaa-voice-pill';
  const STEER_PULSE_MS = 300;
  const { matchVoiceCommands } = globalThis.gnaaVoicePhrases;

  /** @type {SpeechRecognition|null} */
  let recognition = null;
  let wanted = false;
  const held = new Set();
  /** Commands already run for each in-progress result, so interim + final don't repeat. */
  let firedPerResult = [];

  const KEEPALIVE_MS = 1000;
  let keepalive = null;
  let lastHeard = '';

  function describe(res) {
    if (!res?.ok) return res?.error || 'Command was not delivered.';
    if (res.target === 'adapter') {
      const keys = (res.keys || []).map((k) => k.toUpperCase()).join('+');
      return `${res.label} → ${keys} (desktop adapter)`;
    }
    return 'sent to the game tab';
  }

  function send(action, state, quiet = false) {
    chrome.runtime
      .sendMessage({ type: 'gnaa-voice-input', action, state })
      .then((res) => {
        if (!quiet && wanted) showPill(`“${lastHeard}”: ${describe(res)}`, true);
      })
      .catch(() => {});
  }

  // The desktop adapter drops holds that aren't refreshed, so a closed tab can't leave a key down.
  function refreshHolds() {
    if (!held.size) {
      clearInterval(keepalive);
      keepalive = null;
      return;
    }
    for (const action of held) send(action, 'down', true);
  }

  function hold(action) {
    if (held.has(action)) return;
    held.add(action);
    send(action, 'down');
    if (!keepalive) keepalive = setInterval(refreshHolds, KEEPALIVE_MS);
  }

  function release(action) {
    if (!held.delete(action)) return;
    send(action, 'up', true);
  }

  function releaseAll() {
    for (const action of [...held]) release(action);
  }

  const RUN = {
    go: () => {
      release('stop');
      hold('go');
    },
    stop: () => {
      release('go');
      hold('stop');
    },
    coast: () => {
      release('go');
      release('stop');
    },
    turnLeft: () => {
      send('turnLeft', 'down');
      setTimeout(() => send('turnLeft', 'up', true), STEER_PULSE_MS);
    },
    turnRight: () => {
      send('turnRight', 'down');
      setTimeout(() => send('turnRight', 'up', true), STEER_PULSE_MS);
    },
    gearUp: () => send('gearUp', 'pulse'),
    gearDown: () => send('gearDown', 'pulse'),
    boost: () => send('boost', 'pulse'),
    aero: () => send('aero', 'pulse'),
    restart: () => {
      releaseAll();
      send('restart', 'pulse');
    },
    pause: () => {
      releaseAll();
      send('pause', 'pulse');
    },
    stopListening: () => stop(),
  };

  function ensurePill() {
    let pill = document.getElementById(PILL_ID);
    if (pill) return pill;
    pill = document.createElement('div');
    pill.id = PILL_ID;
    pill.setAttribute('role', 'status');
    pill.setAttribute('aria-live', 'polite');
    Object.assign(pill.style, {
      position: 'fixed',
      zIndex: '2147483646',
      left: '16px',
      bottom: '16px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px 6px 6px 12px',
      background: '#0b3d3a',
      color: '#f3ede3',
      border: '1px solid #1f5c57',
      borderRadius: '999px',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
      font: '600 13px "Segoe UI", system-ui, sans-serif',
    });
    const text = document.createElement('span');
    text.className = 'gnaa-voice-text';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Stop voice control');
    btn.textContent = 'Stop';
    Object.assign(btn.style, {
      minHeight: '28px',
      padding: '0 12px',
      border: '0',
      borderRadius: '999px',
      background: '#e08a1e',
      color: '#1a1208',
      font: 'inherit',
      cursor: 'pointer',
    });
    btn.addEventListener('click', () => (wanted ? stop() : start()));
    pill.append(text, btn);
    document.documentElement.appendChild(pill);
    return pill;
  }

  function showPill(message, listening) {
    const pill = ensurePill();
    pill.querySelector('.gnaa-voice-text').textContent = message;
    const btn = pill.querySelector('button');
    btn.textContent = listening ? 'Stop' : 'Start';
    btn.setAttribute('aria-label', listening ? 'Stop voice control' : 'Start voice control');
  }

  function reportState() {
    chrome.runtime.sendMessage({ type: 'gnaa-voice-state', listening: wanted }).catch(() => {});
  }

  function onResult(ev) {
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const result = ev.results[i];
      const transcript = result[0]?.transcript || '';
      const commands = matchVoiceCommands(transcript);
      const already = firedPerResult[i] || 0;
      if (commands.length > already) lastHeard = transcript.trim();
      for (const command of commands.slice(already)) {
        RUN[command]?.();
        if (!wanted) return;
      }
      firedPerResult[i] = Math.max(already, commands.length);
      if (result.isFinal && transcript.trim() && !commands.length) {
        showPill(`Not a command: “${transcript.trim()}”`, true);
      }
    }
  }

  function start() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      showPill('Voice recognition is not available in this browser.', false);
      return { ok: false, error: 'Voice recognition is not available in this browser. Use Google Chrome.' };
    }
    if (!window.isSecureContext) {
      showPill('This page cannot use the microphone (needs https or localhost).', false);
      return { ok: false, error: 'This game page is not https or localhost, so Chrome blocks the microphone.' };
    }
    if (wanted) return { ok: true, listening: true };
    wanted = true;
    firedPerResult = [];
    const rec = new SR();
    recognition = rec;
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.onresult = onResult;
    rec.onstart = () => showPill('Listening — say “go”, “left”, “brake”…', true);
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        stop('Microphone blocked — allow it in the address bar, then press Start.');
      } else if (e.error === 'audio-capture') {
        stop('No microphone found.');
      } else if (e.error !== 'aborted' && e.error !== 'no-speech') {
        showPill(`Speech issue: ${e.error}. Retrying…`, true);
      }
    };
    rec.onend = () => {
      if (!wanted || recognition !== rec) return;
      firedPerResult = [];
      try {
        rec.start();
      } catch {
        setTimeout(() => {
          if (wanted && recognition === rec) rec.start();
        }, 400);
      }
    };
    try {
      rec.start();
    } catch (err) {
      stop(`Could not start the microphone: ${err?.message || err}`);
      return { ok: false, error: String(err?.message || err) };
    }
    showPill('Starting microphone… allow it if Chrome asks.', true);
    reportState();
    return { ok: true, listening: true };
  }

  function stop(message = 'Voice control off') {
    wanted = false;
    releaseAll();
    const rec = recognition;
    recognition = null;
    if (rec) {
      rec.onend = null;
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
    }
    showPill(message, false);
    if (message === 'Voice control off') {
      setTimeout(() => {
        if (!wanted) document.getElementById(PILL_ID)?.remove();
      }, 2500);
    }
    reportState();
    return { ok: true, listening: false };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type !== 'gnaa-voice') return;
    if (msg.action === 'status') {
      sendResponse({ ok: true, listening: wanted });
    } else if (msg.action === 'stop' || (msg.action === 'toggle' && wanted)) {
      sendResponse(stop());
    } else {
      sendResponse(start());
    }
    return true;
  });

  window.addEventListener('pagehide', () => {
    if (wanted) stop();
  });
})();
