"use client";

/**
 * Voice control inside the LibreCorsa tab, using the toolkit's VoiceCommands adapter as-is.
 * Driving phrases are registered with addCommand() and pressed as the game's default keys.
 * Loaded by game/src/app/layout.tsx in dev mode (see voice/game.patch).
 */
import { VoiceCommands } from "../toolkit/tools/adapters/voice-commands.js";

const STEER_PULSE_MS = 300;
const TAP_MS = 80;

const held = new Set();

function send(type, code) {
  window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
}

function hold(code) {
  if (held.has(code)) return;
  held.add(code);
  send("keydown", code);
}

function release(code) {
  if (!held.delete(code)) return;
  send("keyup", code);
}

function releaseAll() {
  for (const code of [...held]) release(code);
}

function tap(code, ms = TAP_MS) {
  send("keydown", code);
  setTimeout(() => send("keyup", code), ms);
}

// Short, clearly different words. Longer phrases come first because the toolkit matches a
// phrase anywhere in what was heard ("restart" before "start", "big left" before "left").
const go = () => { release("KeyS"); release("KeyF"); hold("KeyW"); };
const stop = () => { release("KeyW"); release("KeyF"); hold("KeyS"); };
const back = () => { releaseAll(); tap("Escape"); };

let lastHeard = "";
const onlyWord = (word, action) => () => {
  if (new RegExp(`\\b${word}\\b`).test(lastHeard)) action();
};

const DRIVING_COMMANDS = {
  restart: () => { releaseAll(); tap("Backspace"); },
  again: () => { releaseAll(); tap("Backspace"); },
  start: () => tap("Enter"),
  okay: () => tap("Enter"),
  yes: () => tap("Enter"),
  "go back": back,
  back,
  pause: back,
  drive: go,
  go: onlyWord("go", go),
  stop,
  brake: stop,
  easy: () => { release("KeyS"); release("KeyW"); hold("KeyF"); },
  free: () => { release("KeyW"); release("KeyF"); release("KeyS"); },
  "big left": () => tap("ArrowLeft", STEER_PULSE_MS * 2),
  "big right": () => tap("ArrowRight", STEER_PULSE_MS * 2),
  left: () => tap("ArrowLeft", STEER_PULSE_MS),
  right: () => tap("ArrowRight", STEER_PULSE_MS),
  "gear up": () => tap("KeyE"),
  "gear down": () => tap("KeyQ"),
  up: () => tap("ArrowUp"),
  down: () => tap("ArrowDown"),
  boost: () => tap("KeyB"),
  wing: () => tap("KeyX"),
  camera: () => tap("KeyC"),
  line: () => tap("KeyR"),
  auto: () => tap("KeyP"),
  replay: () => tap("KeyT"),
  mute: () => tap("KeyM"),
  next: () => tap("KeyI"),
};

if (typeof window !== "undefined" && !window.__gnaaGameVoice) {
  window.__gnaaGameVoice = true;
  for (const [phrase, action] of Object.entries(DRIVING_COMMANDS)) VoiceCommands.addCommand(phrase, action);

  const toolkitExecute = VoiceCommands.executeCommand.bind(VoiceCommands);
  VoiceCommands.executeCommand = (transcript) => {
    lastHeard = String(transcript || "").toLowerCase();
    return toolkitExecute(transcript);
  };

  const toolkitDisable = VoiceCommands.disable.bind(VoiceCommands);
  VoiceCommands.disable = () => {
    releaseAll();
    toolkitDisable();
  };

  window.addEventListener("blur", releaseAll);
  VoiceCommands.enable({ language: "en-KE" });
}

export default function GameVoice() {
  return null;
}
