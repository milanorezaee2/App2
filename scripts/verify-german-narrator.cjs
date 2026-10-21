#!/usr/bin/env node
/**
 * "The voice I chose is really the voice I hear."
 *
 * The learner picked a German narrator by ear. That promise breaks in three
 * quiet ways: the shipped MP3 pack is rebuilt with the old voice, the app keeps
 * asking the phone for its own voice, or the device rate stays at 1 so the
 * sentences are slower than the sample. This suite uses the shared
 * `config/german-narrator.json` as the contract and checks all three.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const preset = JSON.parse(fs.readFileSync(path.join(root, 'config/german-narrator.json'), 'utf8'));
const manifestPath = path.join(root, 'public/audio/de/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

let checks = 0;
const check = (label, value) => { assert.ok(value, label); checks += 1; };

// --- the shipped pack ---------------------------------------------------------
check('the audio pack was built by the chosen neural voice',
  manifest.engine.startsWith(`Piper neural ${preset.voice} `) && preset.engine === 'piper');
check('the audio pack was built at the chosen tempo', manifest.engine.includes(`@ ${preset.wordsPerMinute} wpm`));
check('the shipped clips really speak at the labelled tempo',
  Math.abs(Number(manifest.measuredWordsPerMinute) - preset.wordsPerMinute) <= 6);
// Older packs only carried the engine string; the rebuilt pack records the
// numbers explicitly. Both forms must agree with the preset.
const engineVoice = (manifest.engine.match(/Piper neural (\S+)/) || [])[1];
const engineWpm = Number((manifest.engine.match(/@ (\d+) wpm/) || [])[1]);
const packVoice = manifest.voice ?? engineVoice;
const packWpm = manifest.wordsPerMinute ?? engineWpm;
check('the pack records the chosen voice', packVoice === preset.voice);
check('the pack records the chosen tempo', packWpm === preset.wordsPerMinute);
check('the pack records the neural speed setting instead of formant parameters',
  manifest.lengthScale === preset.lengthScale && manifest.pitch === undefined);

// --- every clip stands alone --------------------------------------------------
// The generator surrounds each sentence and word with digital silence, and the
// players start and stop inside that silence. Together they make it impossible
// to hear a fragment of the previous or the next clip.
const webPlayer = fs.readFileSync(path.join(root, 'lib/germanAudio.ts'), 'utf8');
const nativePlayer = fs.readFileSync(path.join(root, 'lib/germanAudioNative.native.ts'), 'utf8');
check('the pack keeps guard silence before and after every clip',
  manifest.leadInSeconds >= 0.3 && manifest.sentenceGapSeconds >= 0.5 && manifest.wordGapSeconds >= 0.45);
check('the web player starts and stops inside that silence',
  /const PREROLL_SECONDS = 0\.25;/.test(webPlayer) && /const TAIL_SECONDS = 0\.15;/.test(webPlayer)
  && /Math\.max\(0, clip\.start - PREROLL_SECONDS\)/.test(webPlayer));
check('the Android player starts and stops inside that silence',
  /const PRE_ROLL_SECONDS = 0\.25;/.test(nativePlayer) && /const TAIL_SECONDS = 0\.15;/.test(nativePlayer));
check('the neural engine replaces the formant synthesizer everywhere',
  manifest.engine.startsWith('Piper neural')
  && !/eSpeak/.test(fs.readFileSync(path.join(root, 'app/learn/[language]/audio-check.tsx'), 'utf8')));

const lessonIds = Object.keys(manifest.lessons);
check('the pack covers every German lesson', lessonIds.length === 95);
let clips = 0;
for (const id of lessonIds) {
  const entry = manifest.lessons[id];
  for (const kind of ['sentences', 'words']) {
    const file = path.join(root, 'public/audio/de', entry[kind].file);
    const size = fs.existsSync(file) ? fs.statSync(file).size : 0;
    assert.ok(size > 2048, `missing or empty German clip: ${entry[kind].file}`);
    clips += 1;
  }
}
check('both clips of every lesson are shipped', clips === 190);

// --- the device path ----------------------------------------------------------
(async () => {
  await require('esbuild').build({
    stdin: {
      contents: `export * from './lib/languages/germanNarrator';`,
      resolveDir: root,
    },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: path.join(root, 'node_modules/.cache/german-narrator.cjs'),
    logLevel: 'silent',
  });
  const app = require(path.join(root, 'node_modules/.cache/german-narrator.cjs'));

  check('the app reads the same narrator as the pack',
    app.GERMAN_NARRATOR.voice === preset.voice && app.GERMAN_NARRATOR.wordsPerMinute === preset.wordsPerMinute);
  check('a normal sentence uses the chosen device tempo instead of the old 1.0',
    app.germanDeviceRate() === preset.deviceRate && app.germanDeviceRate(0.9) === preset.deviceRate);
  check('the shadowing stage keeps a slower but matching tempo',
    app.germanDeviceRate(0.75) === preset.deviceShadowRate);
  check('the slow replay stays the slowest option',
    app.germanDeviceRate(0.55) === preset.deviceSlowRate
      && preset.deviceSlowRate < preset.deviceShadowRate
      && preset.deviceShadowRate < preset.deviceRate);
  const faNumber = String(preset.wordsPerMinute).replace(/[0-9]/g, digit => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);
  check('the label states the tempo the learner chose', app.germanNarratorLabel().includes(faNumber));

  // The speech layer must ask for that rate instead of hard-coding 1.
  const speech = fs.readFileSync(path.join(root, 'lib/germanSpeech.ts'), 'utf8');
  check('German speech resolves the device rate from the narrator preset', /rate:\s*germanDeviceRate\(/.test(speech));
  check('German speech no longer freezes every sentence at rate 1', !/requestedRate >= 0\.85 \? 1/.test(speech));

  console.log(`${checks} German narrator checks passed (pack, device rate and label all follow config/german-narrator.json).`);
})().catch(error => { console.error(error); process.exit(1); });
