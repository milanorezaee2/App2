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
const narratorIds = preset.narrators.map(narrator => narrator.id);
const manifestOf = id => JSON.parse(fs.readFileSync(path.join(root, `public/audio/de/${id}/manifest.json`), 'utf8'));

let checks = 0;
const check = (label, value) => { assert.ok(value, label); checks += 1; };

// --- the shipped packs --------------------------------------------------------
const manifests = Object.fromEntries(narratorIds.map(id => [id, manifestOf(id)]));
// The config decides how many voices ship. One is the size-conscious build (a
// 40 kbps pack per voice is ~95 MB); adding a voice is a config entry plus a
// render, and this suite then covers the extra pack automatically.
check('every configured narrator ships with its own pack',
  narratorIds.length >= 1
  && fs.readFileSync(path.join(root, 'public/audio/de/voices.json'), 'utf8').includes('"narrators"')
  && JSON.parse(fs.readFileSync(path.join(root, 'public/audio/de/voices.json'), 'utf8'))
    .narrators.map(n => n.id).join(',') === narratorIds.join(','));
check('every pack was built by its own neural voice',
  narratorIds.every(id => manifests[id].engine.startsWith(`Piper neural ${preset.narrators.find(n => n.id === id).voice} `)));
check('every pack records its narrator id', narratorIds.every(id => manifests[id].narrator === id));
check('every pack speaks at the tempo written next to it',
  narratorIds.every(id => Math.abs(Number(manifests[id].measuredWordsPerMinute)
    - preset.narrators.find(n => n.id === id).wordsPerMinute) <= 6));
check('every pack uses the neural speed setting from the config',
  narratorIds.every(id => manifests[id].lengthScale === preset.narrators.find(n => n.id === id).lengthScale));

// --- every clip stands alone --------------------------------------------------
// The generator surrounds each sentence and word with digital silence, and the
// players start and stop inside that silence. Together they make it impossible
// to hear a fragment of the previous or the next clip.
const webPlayer = fs.readFileSync(path.join(root, 'lib/germanAudio.ts'), 'utf8');
const nativePlayer = fs.readFileSync(path.join(root, 'lib/germanAudioNative.native.ts'), 'utf8');
check('every pack keeps guard silence before and after every clip',
  narratorIds.every(id => manifests[id].leadInSeconds >= 0.3
    && manifests[id].sentenceGapSeconds >= 0.5 && manifests[id].wordGapSeconds >= 0.45));
check('the web player starts and stops inside that silence',
  /const PREROLL_SECONDS = 0\.25;/.test(webPlayer) && /const TAIL_SECONDS = 0\.15;/.test(webPlayer)
  && /Math\.max\(0, clip\.start - PREROLL_SECONDS\)/.test(webPlayer));
check('the Android player starts and stops inside that silence',
  /const PRE_ROLL_SECONDS = 0\.25;/.test(nativePlayer) && /const TAIL_SECONDS = 0\.15;/.test(nativePlayer));
check('the neural engine replaces the formant synthesizer everywhere',
  narratorIds.every(id => manifests[id].engine.startsWith('Piper neural'))
  && !/eSpeak/.test(fs.readFileSync(path.join(root, 'app/learn/[language]/audio-check.tsx'), 'utf8')));

let clips = 0;
for (const narratorId of narratorIds) {
  const lessonIds = Object.keys(manifests[narratorId].lessons);
  check(`the ${narratorId} pack covers every German lesson`, lessonIds.length === 95);
  for (const id of lessonIds) {
    const entry = manifests[narratorId].lessons[id];
    for (const kind of ['sentences', 'words']) {
      const file = path.join(root, 'public/audio/de', narratorId, entry[kind].file);
      const size = fs.existsSync(file) ? fs.statSync(file).size : 0;
      assert.ok(size > 2048, `missing or empty German clip: ${narratorId}/${entry[kind].file}`);
      clips += 1;
    }
  }
}
check('both clips of every lesson are shipped for every narrator', clips === 190 * narratorIds.length);

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

  check('the app lists exactly the three shipped narrators',
    app.GERMAN_NARRATORS.map(item => item.id).join(',') === narratorIds.join(','));
  check('the default narrator is one of the three',
    app.GERMAN_NARRATORS.some(item => item.id === app.GERMAN_DEFAULT_NARRATOR_ID));
  check('every narrator in the app has a pack', narratorIds.every(id => manifests[id]));
  check('an unknown or missing choice falls back to the default instead of breaking',
    app.findGermanNarrator('nope').id === app.GERMAN_DEFAULT_NARRATOR_ID && app.findGermanNarrator(null).id === app.GERMAN_DEFAULT_NARRATOR_ID);
  check('each narrator keeps its own device tempo',
    narratorIds.every(id => {
      const item = preset.narrators.find(n => n.id === id);
      return app.germanDeviceRate(undefined, id) === item.deviceRate
        && app.germanDeviceRate(0.75, id) === item.deviceShadowRate
        && app.germanDeviceRate(0.55, id) === item.deviceSlowRate;
    }));
  check('the slow replay stays the slowest option for every narrator',
    narratorIds.every(id => {
      const item = preset.narrators.find(n => n.id === id);
      return item.deviceSlowRate < item.deviceShadowRate && item.deviceShadowRate < item.deviceRate;
    }));
  const faNumber = value => String(value).replace(/[0-9]/g, digit => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);
  check('the label states the narrator and its measured tempo',
    narratorIds.every(id => {
      const item = preset.narrators.find(n => n.id === id);
      const label = app.germanNarratorLabel(id);
      return label.includes(item.nameFa) && label.includes(faNumber(item.wordsPerMinute));
    }));

  // The speech layer must ask for that rate instead of hard-coding 1.
  const speech = fs.readFileSync(path.join(root, 'lib/germanSpeech.ts'), 'utf8');
  check('German speech resolves the device rate from the chosen narrator',
    /rate:\s*germanDeviceRate\(options\.rate, activeNarratorId\)/.test(speech));
  check('the chosen narrator is saved and applied on the German screens',
    /NARRATOR_KEY/.test(speech) && /loadGermanNarratorPreference/.test(speech)
    && /setGermanAudioVoice\(activeNarratorId\)/.test(speech));
  check('German speech no longer freezes every sentence at rate 1', !/requestedRate >= 0\.85 \? 1/.test(speech));

  console.log(`${checks} German narrator checks passed (${narratorIds.length} pack(s), guard silence, the saved choice and both players follow config/german-narrator.json).`);
})().catch(error => { console.error(error); process.exit(1); });
