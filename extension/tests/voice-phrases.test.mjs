import test from 'node:test';
import assert from 'node:assert/strict';
import '../content/voice-phrases.js';

const { matchVoiceCommands } = globalThis.gnaaVoicePhrases;

test('single phrases map to their commands', () => {
  assert.deepEqual(matchVoiceCommands('go'), ['go']);
  assert.deepEqual(matchVoiceCommands('Brake!'), ['stop']);
  assert.deepEqual(matchVoiceCommands('turn left'), ['turnLeft']);
  assert.deepEqual(matchVoiceCommands('gear up'), ['gearUp']);
});

test('longer phrases win over their first word', () => {
  assert.deepEqual(matchVoiceCommands('stop listening'), ['stopListening']);
  assert.deepEqual(matchVoiceCommands('turn right'), ['turnRight']);
});

test('several commands in one utterance run in spoken order', () => {
  assert.deepEqual(matchVoiceCommands('go left boost'), ['go', 'turnLeft', 'boost']);
  assert.deepEqual(matchVoiceCommands('brake and then coast'), ['stop', 'coast']);
});

test('words inside other words and unknown speech do not match', () => {
  assert.deepEqual(matchVoiceCommands('gopher leftover'), []);
  assert.deepEqual(matchVoiceCommands(''), []);
  assert.deepEqual(matchVoiceCommands('hello there'), []);
});
