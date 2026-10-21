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
check('the audio pack was built by the chosen voice', manifest.engine.startsWith(`eSpeak NG ${preset.voice} `));
check('the audio pack was built at the chosen tempo', manifest.engine.includes(`@ ${preset.wordsPerMinute} wpm`));
// Older packs only carried the engine string; the rebuilt pack records the
// numbers explicitly. Both forms must agree with the preset.
const engineVoice = (manifest.engine.match(/eSpeak NG (\S+)/) || [])[1];
const engineWpm = Number((manifest.engine.match(/@ (\d+) wpm/) || [])[1]);
const packVoice = manifest.voice ?? engineVoice;
const packWpm = manifest.wordsPerMinute ?? engineWpm;
check('the pack records the chosen voice', packVoice === preset.voice);
check('the pack records the chosen tempo', packWpm === preset.wordsPerMinute);
check('the pack records the chosen pitch',
  (manifest.pitch === undefined && manifest.range === undefined)
    || (manifest.pitch === preset.pitch && manifest.range === preset.range));

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
