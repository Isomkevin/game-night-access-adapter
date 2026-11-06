"use client";

/**
 * OPTIONAL / NOT SUPPORTED for product path.
 * In-tab voice that would require patching LibreCorsa (see voice/game.patch).
 * Do not use — prefer the bridge page at /voice/ (toolkit-voice.js) so the game stays unmodified.
 */
import { VoiceCommands } from "../toolkit/tools/adapters/voice-commands.js";
import { applySettings, loadSettings } from "./command-settings.js";
import { mountVoiceSettings } from "./settings-panel.js";

const SETTINGS_ID = "librecorsa-ingame";
const DEFAULT_LANGUAGE = "en-KE";
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

let panel = null;

const ACTIONS = {
  select: { group: "Menus", label: "Start / select (Enter)", phrases: ["start", "okay", "yes"], run: () => tap("Enter") },
  back: {
    group: "Menus",
    label: "Back / pause (Esc)",
    phrases: ["go back", "back", "pause"],
    run: () => { releaseAll(); tap("Escape"); },
  },
  menuUp: { group: "Menus", label: "Up (↑)", phrases: ["up"], run: () => tap("ArrowUp") },
  menuDown: { group: "Menus", label: "Down (↓)", phrases: ["down"], run: () => tap("ArrowDown") },

  throttle: {
    group: "Driving",
    label: "Throttle on (holds W)",
    phrases: ["drive", "go"],
    run: () => { release("KeyS"); release("KeyF"); hold("KeyW"); },
  },
  brake: {
    group: "Driving",
    label: "Brake on (holds S)",
    phrases: ["stop", "brake"],
    run: () => { release("KeyW"); release("KeyF"); hold("KeyS"); },
  },
  halfThrottle: {
    group: "Driving",
    label: "Half throttle (holds F)",
    phrases: ["easy"],
    run: () => { release("KeyS"); release("KeyW"); hold("KeyF"); },
  },
  coast: {
    group: "Driving",
    label: "Release throttle and brake",
    phrases: ["free"],
    run: () => { release("KeyW"); release("KeyF"); release("KeyS"); },
  },
  steerLeft: { group: "Driving", label: "Steer left (← 0.3 s)", phrases: ["left"], run: () => tap("ArrowLeft", STEER_PULSE_MS) },
  steerRight: { group: "Driving", label: "Steer right (→ 0.3 s)", phrases: ["right"], run: () => tap("ArrowRight", STEER_PULSE_MS) },
  bigLeft: { group: "Driving", label: "Big left (← 0.6 s)", phrases: ["big left"], run: () => tap("ArrowLeft", STEER_PULSE_MS * 2) },
  bigRight: { group: "Driving", label: "Big right (→ 0.6 s)", phrases: ["big right"], run: () => tap("ArrowRight", STEER_PULSE_MS * 2) },
  shiftUp: { group: "Driving", label: "Gear up (E)", phrases: ["gear up"], run: () => tap("KeyE") },
  shiftDown: { group: "Driving", label: "Gear down (Q)", phrases: ["gear down"], run: () => tap("KeyQ") },
  boost: { group: "Driving", label: "Boost on / off (B)", phrases: ["boost"], run: () => tap("KeyB") },
  aero: { group: "Driving", label: "Active aero (X)", phrases: ["wing"], run: () => tap("KeyX") },
  autopilot: { group: "Driving", label: "Autopilot on / off (P)", phrases: ["auto"], run: () => tap("KeyP") },
  restart: {
    group: "Driving",
    label: "Restart race (Backspace)",
    phrases: ["restart", "again"],
    run: () => { releaseAll(); tap("Backspace"); },
  },

  camera: { group: "Display", label: "Change camera (C)", phrases: ["camera"], run: () => tap("KeyC") },
  racingLine: { group: "Display", label: "Racing line (R)", phrases: ["line"], run: () => tap("KeyR") },
  replay: { group: "Display", label: "Instant replay (T)", phrases: ["replay"], run: () => tap("KeyT") },
  mute: { group: "Display", label: "Sound on / off (M)", phrases: ["mute"], run: () => tap("KeyM") },
  nextPage: { group: "Display", label: "Next MFD page (I)", phrases: ["next"], run: () => tap("KeyI") },

  settings: { group: "Voice", label: "Open voice settings", phrases: ["voice settings"], run: () => panel?.open() },
};

if (typeof window !== "undefined" && !window.__gnaaGameVoice) {
  window.__gnaaGameVoice = true;

  let settings = loadSettings(SETTINGS_ID, ACTIONS, DEFAULT_LANGUAGE);
  applySettings(VoiceCommands, settings, ACTIONS);

  const toolkitDisable = VoiceCommands.disable.bind(VoiceCommands);
  VoiceCommands.disable = () => {
    releaseAll();
    toolkitDisable();
  };

  let wasListening = false;
  const mountPanel = () => {
    panel = mountVoiceSettings({
      id: SETTINGS_ID,
      actions: ACTIONS,
      defaultLanguage: DEFAULT_LANGUAGE,
      getSettings: () => settings,
      onSave: (next) => {
        settings = next;
        applySettings(VoiceCommands, settings, ACTIONS);
      },
      pause: () => {
        wasListening = VoiceCommands.enabled;
        if (wasListening) VoiceCommands.disable();
      },
      resume: () => {
        if (wasListening) VoiceCommands.enable({ language: settings.language });
      },
      launcher: true,
    });
  };
  if (document.readyState === "complete") mountPanel();
  else window.addEventListener("load", mountPanel, { once: true });

  window.addEventListener("blur", releaseAll);
  VoiceCommands.enable({ language: settings.language });
}

export default function GameVoice() {
  return null;
}
