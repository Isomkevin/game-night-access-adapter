/**
 * User-editable voice phrases: each action has a list of phrases the user picks.
 * Saved per page in localStorage and registered with the toolkit VoiceCommands adapter via addCommand().
 */

export const LANGUAGES = [
  ['en-KE', 'English (Kenya)'],
  ['en-US', 'English (US)'],
  ['en-GB', 'English (UK)'],
  ['sw-KE', 'Kiswahili (Kenya)'],
];

const RESERVED = ['stop listening'];

export function normalizePhrase(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parsePhraseList(text) {
  return [...new Set(String(text || '').split(',').map(normalizePhrase).filter(Boolean))];
}

const storageKey = (id) => `gnaa.voice.${id}.v1`;

export function defaultSettings(actions, language) {
  const phrases = {};
  for (const [id, action] of Object.entries(actions)) phrases[id] = [...action.phrases];
  return { language, phrases };
}

export function loadSettings(id, actions, language) {
  const settings = defaultSettings(actions, language);
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(storageKey(id)) || 'null');
  } catch {
    saved = null;
  }
  if (!saved || typeof saved !== 'object') return settings;
  if (typeof saved.language === 'string' && saved.language) settings.language = saved.language;
  for (const action of Object.keys(actions)) {
    const list = saved.phrases?.[action];
    if (Array.isArray(list)) settings.phrases[action] = [...new Set(list.map(normalizePhrase).filter(Boolean))];
  }
  return settings;
}

export function saveSettings(id, settings) {
  try {
    localStorage.setItem(storageKey(id), JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

let builtins = null;
let registered = [];
let lastHeard = '';
let wrapped = false;

export function getBuiltinPhrases() {
  return builtins ? Object.keys(builtins) : [];
}

export function validateSettings(settings, actions) {
  const errors = [];
  const warnings = [];
  const owner = new Map();
  const builtinPhrases = getBuiltinPhrases();
  for (const [action, list] of Object.entries(settings.phrases)) {
    for (const phrase of list) {
      if (RESERVED.includes(phrase)) {
        errors.push(`"${phrase}" is reserved for turning voice off.`);
      } else if (owner.has(phrase)) {
        errors.push(`"${phrase}" is used for both "${actions[owner.get(phrase)].label}" and "${actions[action].label}".`);
      } else {
        owner.set(phrase, action);
      }
      if (builtinPhrases.includes(phrase) && !actions[action].phrases.includes(phrase)) {
        warnings.push(`"${phrase}" replaces the toolkit's built-in "${phrase}" command.`);
      }
    }
  }
  return { errors, warnings };
}

function wholeWord(phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\s)${escaped}(\\s|$)`);
}

/**
 * Replace the previously registered phrases with the ones in settings.
 * Longer phrases are registered first because the toolkit matches a phrase anywhere in what it heard,
 * and each phrase only fires as whole words ("go" does not fire on "good").
 */
export function applySettings(VoiceCommands, settings, actions) {
  if (!builtins) builtins = { ...VoiceCommands.commands };
  if (!wrapped) {
    const toolkitExecute = VoiceCommands.executeCommand.bind(VoiceCommands);
    VoiceCommands.executeCommand = (transcript) => {
      lastHeard = normalizePhrase(transcript);
      return toolkitExecute(transcript);
    };
    wrapped = true;
  }

  for (const phrase of registered) {
    if (phrase in builtins) VoiceCommands.commands[phrase] = builtins[phrase];
    else delete VoiceCommands.commands[phrase];
  }
  registered = [];

  const pairs = [];
  for (const [action, list] of Object.entries(settings.phrases)) {
    if (actions[action]) for (const phrase of list) pairs.push([phrase, action]);
  }
  pairs.sort((a, b) => b[0].length - a[0].length);

  for (const [phrase, action] of pairs) {
    const match = wholeWord(phrase);
    VoiceCommands.addCommand(phrase, () => {
      if (match.test(lastHeard)) actions[action].run();
    });
    registered.push(phrase);
  }
  VoiceCommands.settings.language = settings.language;
}
