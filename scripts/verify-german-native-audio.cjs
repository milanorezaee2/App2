#!/usr/bin/env node
/**
 * Verifies the Android/iOS German playback queue (lib/germanAudioNative.native.ts).
 *
 * A phone has no `Audio` element: the bundled MP3 is opened with expo-audio, the
 * player seeks to the sentence offset and plays. The original implementation
 * called `play()` immediately after `seekTo()`, so the seek was dropped while the
 * file was still loading and the safety timer started before any sound was made.
 * The listener heard the head of another sentence and then a hard cut — the
 * "choppy, interrupted German" report.
 *
 * This test compiles the real module with the TypeScript compiler and runs it
 * against a fake player, then asserts the exact order of operations.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'lib/germanAudioNative.native.ts'), 'utf8');

const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'german-native-'));
const buildDir = path.join(workdir, 'build');
fs.mkdirSync(path.join(workdir, 'node_modules', 'expo-audio'), { recursive: true });
fs.mkdirSync(buildDir, { recursive: true });

// --- fake expo-audio -------------------------------------------------------
let lastPlayer = null;
const expoAudioStub = `
let lastPlayer = null;
class FakePlayer {
  constructor(assetId, profile) {
    this.assetId = assetId;
    this.profile = profile;
    this.isLoaded = false;
    this.currentTime = 0;
    this.duration = 120;
    this.playbackRate = 1;
    this.volume = 1;
    this.playing = false;
    this.removed = false;
    this.log = [];
    this.listeners = [];
    setTimeout(() => {
      if (this.removed) return;
      this.isLoaded = true;
      this.log.push('loaded');
    }, profile.loadMs);
  }
  addListener(name, handler) {
    this.listeners.push({ name, handler });
    return { remove: () => { this.listeners = this.listeners.filter(l => l.handler !== handler); } };
  }
  emit() {
    for (const { name, handler } of this.listeners) handler({
      id: 1, currentTime: this.currentTime, playbackState: this.playing ? 'playing' : 'paused',
      timeControlStatus: this.playing ? 'playing' : 'paused', reasonForWaitingToPlay: '',
      mute: false, duration: this.duration, playing: this.playing, loop: false,
      didJustFinish: false, isBuffering: false, isLoaded: this.isLoaded,
      playbackRate: this.playbackRate, shouldCorrectPitch: false,
    });
  }
  async seekTo(seconds) {
    this.log.push('seek:' + seconds.toFixed(2));
    await new Promise(resolve => setTimeout(resolve, this.profile.seekResolveMs));
    this.seekTarget = seconds;
    setTimeout(() => { this.currentTime = this.seekTarget; this.log.push('seeked:' + seconds.toFixed(2)); }, this.profile.seekLandMs);
  }
  play() {
    this.log.push('play@' + this.currentTime.toFixed(2));
    if (!this.isLoaded) this.log.push('PLAYED-BEFORE-LOAD');
    this.playing = true;
    const tick = () => {
      if (this.removed || !this.playing) return;
      this.currentTime += 0.025 * this.playbackRate;
      this.emit();
      this.tickTimer = setTimeout(tick, 25);
    };
    tick();
  }
  pause() { this.log.push('pause'); this.playing = false; clearTimeout(this.tickTimer); }
  remove() { this.log.push('remove'); this.removed = true; this.playing = false; clearTimeout(this.tickTimer); }
}
exports.createAudioPlayer = (assetId) => {
  lastPlayer = new FakePlayer(assetId, global.__germanPlayerProfile || { loadMs: 120, seekResolveMs: 30, seekLandMs: 60 });
  return lastPlayer;
};
exports.getLastPlayer = () => lastPlayer;
exports.setAudioModeAsync = async () => undefined;
`;
fs.writeFileSync(path.join(workdir, 'node_modules', 'expo-audio', 'index.js'), expoAudioStub);
fs.writeFileSync(path.join(workdir, 'node_modules', 'expo-audio', 'package.json'), '{"name":"expo-audio","main":"index.js"}');

// --- fake generated asset map ---------------------------------------------
const manifest = {
  version: 3,
  lessons: {
    demo: {
      sentences: { file: 'demo.mp3', clips: { 'hallo!': [2.02, 3.1] } },
      words: { file: 'demo.words.mp3', clips: { hallo: [0.12, 0.54] } },
    },
  },
};
fs.writeFileSync(path.join(buildDir, 'germanAudioAssets.js'),
  `exports.GERMAN_AUDIO_MANIFEST = ${JSON.stringify(manifest)};\n`
  + `exports.GERMAN_AUDIO_FILES = { 'demo.mp3': 1, 'demo.words.mp3': 2 };\n`);

// --- compile the real module ----------------------------------------------
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  fileName: 'germanAudioNative.native.ts',
}).outputText;
const modulePath = path.join(buildDir, 'germanAudioNative.native.js');
fs.writeFileSync(modulePath, output);

const native = require(modulePath);
const { getLastPlayer } = require(path.join(workdir, 'node_modules', 'expo-audio', 'index.js'));

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let passed = 0;
function check(name, condition) {
  assert.ok(condition, name);
  passed += 1;
  console.log(`PASS ${name}`);
}

(async () => {
  // 1. A sentence is not started before the file is loaded and seeked.
  let done = null;
  const started = await native.playNativeGermanClip({
    text: 'Hallo!', kind: 'sentence', lessonId: 'demo', rate: 1,
    onStart: () => { done = done || 'started'; },
    onDone: () => { done = 'done'; },
  });
  check('a bundled sentence starts playing', started === true);
  const player = getLastPlayer();
  const order = player.log.filter(entry => !entry.startsWith('seeked'));
  check('the player waits for the file to load before seeking',
    order.indexOf('loaded') !== -1 && order.indexOf('loaded') < order.indexOf('seek:2.02'));
  check('playback begins exactly at the clip start, never at the head of the file',
    order.some(entry => entry === 'play@2.02') && !order.includes('PLAYED-BEFORE-LOAD'));
  check('the stop timer never fires before the sentence is audible', started === true && player.playing);

  // 2. The clip is allowed to finish: onDone must not arrive before clip.end.
  const startedAt = Date.now();
  while (done !== 'done' && Date.now() - startedAt < 4000) await sleep(40);
  const elapsed = (Date.now() - startedAt) / 1000;
  check('the sentence is played to its recorded end instead of being cut',
    done === 'done' && elapsed >= (3.1 - 2.02) * 0.95);
  check('the player is released after the sentence, leaving no second audio stream',
    player.removed === true);

  // 3. Interrupting (next sentence / leaving the screen) stops the current clip.
  let interrupted = false;
  await native.playNativeGermanClip({
    text: 'Hallo!', kind: 'sentence', lessonId: 'demo',
    onDone: () => { interrupted = true; },
  });
  const second = getLastPlayer();
  await sleep(80);
  native.stopNativeGermanClip();
  await sleep(400);
  check('interrupting a sentence cancels it without a second callback',
    interrupted === false && second.removed === true);

  // 4. Words from the vocabulary pack use their own clip window.
  const wordStarted = await native.playNativeGermanClip({
    text: 'Hallo', kind: 'word', lessonId: 'demo', rate: 1,
  });
  const wordPlayer = getLastPlayer();
  check('a vocabulary word plays from the words pack', wordStarted === true && wordPlayer.assetId === 2);
  check('a vocabulary word starts at its own offset', wordPlayer.log.includes('play@0.12'));
  native.stopNativeGermanClip();

  // 5. Unknown text never pretends to have played.
  const missing = await native.playNativeGermanClip({ text: 'Nicht vorhanden', kind: 'sentence', lessonId: 'demo' });
  check('a sentence without a bundled clip is reported, not faked', missing === false);

  fs.rmSync(workdir, { recursive: true, force: true });
  console.log(`\n${passed} native German playback checks passed (expo-audio simulated).`);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
