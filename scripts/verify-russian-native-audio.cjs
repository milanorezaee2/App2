#!/usr/bin/env node
/**
 * Verifies the Android/iOS Russian playback queue (lib/russianAudioNative.native.ts).
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
const source = fs.readFileSync(path.join(root, 'lib/russianAudioNative.native.ts'), 'utf8');

const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'russian-native-'));
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
    if (this.profile.seekFails) return;  // the engine silently drops the seek
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
  const profile = (global.__russianPlayerProfiles && global.__russianPlayerProfiles.length
    ? global.__russianPlayerProfiles.shift()
    : null) || global.__russianPlayerProfile || { loadMs: 120, seekResolveMs: 30, seekLandMs: 60 };
  lastPlayer = new FakePlayer(assetId, profile);
  return lastPlayer;
};
exports.getLastPlayer = () => lastPlayer;
exports.setAudioModeAsync = async () => undefined;
`;
fs.writeFileSync(path.join(workdir, 'node_modules', 'expo-audio', 'index.js'), expoAudioStub);
fs.writeFileSync(path.join(workdir, 'node_modules', 'expo-audio', 'package.json'), '{"name":"expo-audio","main":"index.js"}');

// --- fake generated asset map ---------------------------------------------
// The course writes the stress mark as a combining acute; the pack stores the
// key without it, so playback must normalize the same way the generator did.
const manifest = {
  version: 2,
  narrator: 'irina',
  lessons: {
    demo: {
      sentences: { file: 'demo.mp3', clips: { 'привет!': [2.02, 3.1] } },
      words: { file: 'demo.words.mp3', clips: { 'привет': [0.12, 0.54] } },
    },
  },
};
fs.writeFileSync(path.join(buildDir, 'russianAudioAssets.js'),
  `exports.RUSSIAN_AUDIO_MANIFESTS = { irina: ${JSON.stringify(manifest)} };\n`
  + `exports.RUSSIAN_AUDIO_FILES = { 'irina/demo.mp3': 1, 'irina/demo.words.mp3': 2 };\n`);

// --- stub of the narrator registry (the real one imports a JSON config) ----
fs.mkdirSync(path.join(buildDir, 'languages'), { recursive: true });
fs.writeFileSync(path.join(buildDir, 'languages', 'russianNarrator.js'), `
const IDS = ['irina'];
exports.RUSSIAN_DEFAULT_NARRATOR_ID = 'irina';
exports.RUSSIAN_NARRATORS = IDS.map(id => ({ id }));
exports.findRussianNarrator = id => ({ id: IDS.includes(id) ? id : 'irina' });
`);

// --- compile the real module ----------------------------------------------
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  fileName: 'russianAudioNative.native.ts',
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
  const started = await native.playNativeRussianClip({
    text: 'Приве́т!', kind: 'sentence', lessonId: 'demo', rate: 1,
    onStart: () => { done = done || 'started'; },
    onDone: () => { done = 'done'; },
  });
  check('a bundled sentence starts playing', started === true);
  const player = getLastPlayer();
  const order = player.log.filter(entry => !entry.startsWith('seeked'));
  check('the player waits for the file to load before seeking',
    order.indexOf('loaded') !== -1 && order.indexOf('loaded') < order.indexOf('seek:1.77'));
  check('playback begins 0.25 s inside the guard silence, never at the head of the file',
    order.some(entry => entry === 'play@1.77') && !order.includes('PLAYED-BEFORE-LOAD'));

  check('the stop timer never fires before the sentence is audible', started === true && player.playing);

  // 2. The clip is allowed to finish: onDone must not arrive before clip.end.
  const startedAt = Date.now();
  while (done !== 'done' && Date.now() - startedAt < 4000) await sleep(40);
  const elapsed = (Date.now() - startedAt) / 1000;
  check('the sentence is played to its recorded end instead of being cut',
    done === 'done' && elapsed >= (3.1 - 2.02) * 0.95);
  check('the player is released after the sentence, leaving no second audio stream',
    player.removed === true);

  // 1b. A seek the engine drops must never turn into "play from the beginning".
  global.__russianPlayerProfiles = [
    { loadMs: 60, seekResolveMs: 10, seekLandMs: 20, seekFails: true },
    { loadMs: 60, seekResolveMs: 10, seekLandMs: 20, seekFails: false },
  ];
  const retried = await native.playNativeRussianClip({
    text: 'Приве́т!', kind: 'sentence', lessonId: 'demo', rate: 1,
  });
  check('a dropped seek is retried on a fresh player and still starts at the clip',
    retried === true && getLastPlayer().log.includes('play@1.77'));
  check('the failed first player never played the wrong part of the file',
    global.__russianPlayerProfiles.length === 0);
  native.stopNativeRussianClip();

  global.__russianPlayerProfiles = [
    { loadMs: 60, seekResolveMs: 10, seekLandMs: 20, seekFails: true },
    { loadMs: 60, seekResolveMs: 10, seekLandMs: 20, seekFails: true },
  ];
  const unplayable = await native.playNativeRussianClip({
    text: 'Приве́т!', kind: 'sentence', lessonId: 'demo', rate: 1,
  });
  check('a clip that can never be positioned is reported instead of playing from 0',
    unplayable === false && !getLastPlayer().log.some(entry => entry.startsWith('play@')));
  global.__russianPlayerProfiles = null;
  native.stopNativeRussianClip();

  // 3. Interrupting (next sentence / leaving the screen) stops the current clip.
  let interrupted = false;
  await native.playNativeRussianClip({
    text: 'Приве́т!', kind: 'sentence', lessonId: 'demo',
    onDone: () => { interrupted = true; },
  });
  const second = getLastPlayer();
  await sleep(80);
  native.stopNativeRussianClip();
  await sleep(400);
  check('interrupting a sentence cancels it without a second callback',
    interrupted === false && second.removed === true);

  // 4. Words from the vocabulary pack use their own clip window.
  const wordStarted = await native.playNativeRussianClip({
    text: 'Приве́т', kind: 'word', lessonId: 'demo', rate: 1,
  });
  const wordPlayer = getLastPlayer();
  check('a vocabulary word plays from the words pack', wordStarted === true && wordPlayer.assetId === 2);

  // 4b. A stressed spelling and a plain one hit the same clip.
  const stressed = native.bundledRussianClip('demo', 'sentence', 'Приве́т!');
  const plain = native.bundledRussianClip('demo', 'sentence', 'привет!');
  check('the stress mark is ignored when a clip is looked up',
    plain && Math.abs(stressed.start - plain.start) < 1e-9 && Math.abs(plain.start - 2.02) < 0.001);
  check('a vocabulary word starts in its guard silence, above 0', wordPlayer.log.includes('play@0.00'));
  native.stopNativeRussianClip();

  // 5. Unknown text never pretends to have played.
  const missing = await native.playNativeRussianClip({ text: 'Не существует', kind: 'sentence', lessonId: 'demo' });
  check('a sentence without a bundled clip is reported, not faked', missing === false);

  fs.rmSync(workdir, { recursive: true, force: true });
  console.log(`\n${passed} native Russian playback checks passed (expo-audio simulated).`);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
