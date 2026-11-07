/**
 * Spoken phrase → voice command matching for the in-tab voice listener.
 * Plain script (content scripts can't be modules); also loaded by the Node tests.
 */

(() => {
  const VOICE_PHRASES = Object.freeze({
    stopListening: ['stop listening'],
    go: ['go', 'drive', 'accelerate', 'throttle'],
    stop: ['stop', 'brake'],
    coast: ['coast', 'free', 'easy'],
    turnLeft: ['left', 'turn left'],
    turnRight: ['right', 'turn right'],
    gearUp: ['gear up'],
    gearDown: ['gear down'],
    boost: ['boost'],
    aero: ['wing', 'aero'],
    restart: ['restart', 'again'],
    pause: ['pause'],
  });

  // Longest phrases first, so "turn left" wins over "left" and "stop listening" over "stop".
  const ENTRIES = Object.entries(VOICE_PHRASES)
    .flatMap(([command, phrases]) => phrases.map((p) => ({ command, words: p.split(' ') })))
    .sort((a, b) => b.words.length - a.words.length);

  /**
   * Commands spoken in a transcript, in the order they were said.
   * @param {string} transcript
   * @returns {string[]}
   */
  function matchVoiceCommands(transcript) {
    const words = String(transcript || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s']/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
    const commands = [];
    let i = 0;
    while (i < words.length) {
      const hit = ENTRIES.find((e) => e.words.every((w, j) => words[i + j] === w));
      if (hit) {
        commands.push(hit.command);
        i += hit.words.length;
      } else {
        i += 1;
      }
    }
    return commands;
  }

  globalThis.gnaaVoicePhrases = { VOICE_PHRASES, matchVoiceCommands };
})();
