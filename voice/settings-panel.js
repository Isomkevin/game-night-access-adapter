/**
 * Voice settings dialog: pick the recognition language and the phrases for each action.
 * Works on any page (inside the game tab or on the bridge voice page); styles are injected.
 */
import {
  LANGUAGES,
  defaultSettings,
  normalizePhrase,
  parsePhraseList,
  saveSettings,
  validateSettings,
} from './command-settings.js';

const STYLE_ID = 'gnaa-voice-settings-style';

const CSS = `
.gnaa-vs{width:min(680px,94vw);max-height:88vh;overflow:auto;padding:20px 22px;border:0;border-radius:12px;
  background:#fff;color:#111827;font:15px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 20px 50px rgba(0,0,0,.45)}
.gnaa-vs::backdrop{background:rgba(0,0,0,.55)}
.gnaa-vs h2{margin:0 0 4px;font-size:1.3rem;color:#111827}
.gnaa-vs p{margin:0 0 12px;color:#4b5563}
.gnaa-vs fieldset{border:1px solid #e5e7eb;border-radius:8px;margin:0 0 12px;padding:8px 12px 4px}
.gnaa-vs legend{font-weight:700;padding:0 4px}
.gnaa-vs-row{display:grid;grid-template-columns:minmax(140px,1fr) 2fr auto;gap:8px;align-items:center;margin:0 0 8px}
.gnaa-vs-lang{display:flex;gap:8px;align-items:center;margin:0 0 12px}
.gnaa-vs input[type=text],.gnaa-vs select{width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid #9ca3af;
  border-radius:6px;font:inherit;color:#111827;background:#fff}
.gnaa-vs-lang select{width:auto}
.gnaa-vs button{padding:6px 12px;border:1px solid #9ca3af;border-radius:6px;background:#f3f4f6;color:#111827;font:inherit;cursor:pointer}
.gnaa-vs button:disabled{opacity:.6;cursor:default}
.gnaa-vs button.gnaa-vs-primary{background:#0f766e;border-color:#0f766e;color:#fff}
.gnaa-vs button:focus-visible,.gnaa-vs input:focus-visible,.gnaa-vs select:focus-visible{outline:3px solid #f59e0b;outline-offset:1px}
.gnaa-vs-msg{min-height:1.4em;margin:8px 0}
.gnaa-vs-msg p{margin:2px 0}
.gnaa-vs-msg .err{color:#b91c1c}.gnaa-vs-msg .warn{color:#92400e}.gnaa-vs-msg .ok{color:#047857}
.gnaa-vs-footer{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.gnaa-vs-launcher{position:fixed;left:12px;bottom:12px;z-index:2147483646;padding:8px 14px;border-radius:999px;
  border:1px solid #0f766e;background:#0f766e;color:#fff;font:600 13px system-ui,sans-serif;cursor:pointer;opacity:.9}
.gnaa-vs-launcher:focus-visible{outline:3px solid #f59e0b;outline-offset:2px}
@media (max-width:540px){.gnaa-vs-row{grid-template-columns:1fr auto}.gnaa-vs-row label{grid-column:1/-1}}
`;

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
}

function recordOnce(language) {
  return new Promise((resolve, reject) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      reject(new Error('not-supported'));
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = language;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    let done = false;
    recognition.onresult = (event) => {
      done = true;
      resolve(normalizePhrase(event.results[0][0].transcript));
    };
    recognition.onerror = (event) => {
      if (done) return;
      done = true;
      reject(new Error(event.error));
    };
    recognition.onend = () => {
      if (done) return;
      done = true;
      resolve('');
    };
    recognition.start();
  });
}

/**
 * @param {object} options
 * @param {string} options.id               storage id for this page's settings
 * @param {object} options.actions          { actionId: { label, group?, phrases, run } }
 * @param {string} options.defaultLanguage
 * @param {() => object} options.getSettings
 * @param {(settings: object) => void} options.onSave
 * @param {() => void} [options.pause]      stop listening while the dialog is open
 * @param {() => void} [options.resume]
 * @param {boolean} [options.launcher]      add a floating "Voice settings" button
 */
export function mountVoiceSettings({ id, actions, defaultLanguage, getSettings, onSave, pause, resume, launcher = false }) {
  if (!document.getElementById(STYLE_ID)) {
    document.head.append(el('style', { id: STYLE_ID, textContent: CSS }));
  }

  const dialog = el('dialog', { className: 'gnaa-vs' });
  dialog.setAttribute('aria-labelledby', 'gnaa-vs-title');
  // Keep typing in the dialog away from the game's key handlers on window.
  for (const type of ['keydown', 'keyup', 'keypress']) dialog.addEventListener(type, (e) => e.stopPropagation());
  document.body.append(dialog);

  let launcherBtn = null;
  if (launcher) {
    launcherBtn = el('button', { type: 'button', className: 'gnaa-vs-launcher', textContent: 'Voice settings' });
    launcherBtn.addEventListener('mousedown', (e) => e.preventDefault());
    launcherBtn.addEventListener('click', open);
    document.body.append(launcherBtn);
  }

  let inputs = {};
  let languageSelect = null;
  let msg = null;
  let recording = false;

  function showMessages(lines) {
    msg.replaceChildren(...lines.map(([kind, text]) => el('p', { className: kind, textContent: text })));
  }

  function read() {
    const phrases = {};
    for (const action of Object.keys(actions)) phrases[action] = parsePhraseList(inputs[action].value);
    return { language: languageSelect.value, phrases };
  }

  async function record(action, button) {
    if (recording) return;
    recording = true;
    const label = button.textContent;
    button.textContent = 'Listening…';
    for (const b of dialog.querySelectorAll('button')) b.disabled = true;
    showMessages([['ok', `Say the phrase for "${actions[action].label}" now.`]]);
    try {
      const phrase = await recordOnce(languageSelect.value);
      if (!phrase) {
        showMessages([['warn', "Didn't catch that. Try again."]]);
      } else {
        const list = parsePhraseList(inputs[action].value);
        if (!list.includes(phrase)) list.push(phrase);
        inputs[action].value = list.join(', ');
        showMessages([['ok', `Heard "${phrase}" and added it to "${actions[action].label}". Press Save to keep it.`]]);
      }
    } catch (err) {
      const blocked = ['not-allowed', 'service-not-allowed', 'audio-capture'].includes(err.message);
      showMessages([[
        'err',
        err.message === 'not-supported'
          ? 'This browser has no speech recognition. Use Chrome, or type the phrase.'
          : blocked
            ? 'The microphone is blocked. Allow it for this page, or type the phrase.'
            : `Could not record (${err.message}). Type the phrase instead.`,
      ]]);
    } finally {
      for (const b of dialog.querySelectorAll('button')) b.disabled = false;
      button.textContent = label;
      recording = false;
    }
  }

  function build(settings) {
    inputs = {};
    languageSelect = el('select', { id: 'gnaa-vs-language' });
    const known = LANGUAGES.some(([code]) => code === settings.language);
    for (const [code, name] of known ? LANGUAGES : [...LANGUAGES, [settings.language, settings.language]]) {
      languageSelect.append(el('option', { value: code, textContent: name, selected: code === settings.language }));
    }

    const groups = new Map();
    for (const [action, def] of Object.entries(actions)) {
      const group = def.group || 'Commands';
      if (!groups.has(group)) groups.set(group, el('fieldset', {}, [el('legend', { textContent: group })]));
      const inputId = `gnaa-vs-${action}`;
      const input = el('input', {
        type: 'text',
        id: inputId,
        value: (settings.phrases[action] || []).join(', '),
        placeholder: 'off',
        autocomplete: 'off',
        spellcheck: false,
      });
      inputs[action] = input;
      const recordBtn = el('button', { type: 'button', textContent: 'Record' });
      recordBtn.setAttribute('aria-label', `Record a phrase for ${def.label}`);
      recordBtn.addEventListener('click', () => record(action, recordBtn));
      groups.get(group).append(
        el('div', { className: 'gnaa-vs-row' }, [el('label', { htmlFor: inputId, textContent: def.label }), input, recordBtn])
      );
    }

    msg = el('div', { className: 'gnaa-vs-msg' });
    msg.setAttribute('role', 'status');
    msg.setAttribute('aria-live', 'polite');

    const saveBtn = el('button', { type: 'submit', className: 'gnaa-vs-primary', textContent: 'Save' });
    const resetBtn = el('button', { type: 'button', textContent: 'Reset to defaults' });
    const closeBtn = el('button', { type: 'button', textContent: 'Close' });
    resetBtn.addEventListener('click', () => {
      build(defaultSettings(actions, defaultLanguage));
      showMessages([['warn', 'Defaults loaded. Press Save to keep them.']]);
    });
    closeBtn.addEventListener('click', () => dialog.close());

    const form = el('form', {}, [
      el('h2', { id: 'gnaa-vs-title', textContent: 'Voice commands' }),
      el('p', {
        textContent:
          'Choose the words you want to say for each action. Separate phrases with commas. ' +
          'Record saves exactly what the microphone hears, which works best for your accent. Leave a box empty to turn an action off.',
      }),
      el('div', { className: 'gnaa-vs-lang' }, [el('label', { htmlFor: 'gnaa-vs-language', textContent: 'Language' }), languageSelect]),
      ...groups.values(),
      msg,
      el('div', { className: 'gnaa-vs-footer' }, [resetBtn, closeBtn, saveBtn]),
    ]);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const next = read();
      const { errors, warnings } = validateSettings(next, actions);
      if (errors.length) {
        showMessages(errors.map((text) => ['err', text]));
        return;
      }
      const stored = saveSettings(id, next);
      onSave(next);
      showMessages([
        stored ? ['ok', 'Saved.'] : ['warn', 'Applied, but this browser would not store it. It resets when the page reloads.'],
        ...warnings.map((text) => ['warn', text]),
      ]);
    });

    dialog.replaceChildren(form);
  }

  function open() {
    if (dialog.open) return;
    pause?.();
    build(getSettings());
    dialog.showModal();
    inputs[Object.keys(actions)[0]]?.focus();
  }

  dialog.addEventListener('close', () => {
    if (launcherBtn && document.activeElement === launcherBtn) launcherBtn.blur();
    resume?.();
  });

  return { open, close: () => dialog.close() };
}
