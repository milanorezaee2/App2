#!/usr/bin/env node
/**
 * "The Russian course really speaks with the narrator that ships in the app."
 *
 * The Russian lessons used to ask the phone for a `ru-RU` voice. That breaks in
 * three quiet ways: the phone has no Russian voice at all (Firefox for Android),
 * the voice it has is male or robotic, or the shipped MP3 pack is stale. This
 * suite treats `config/russian-narrator.json` as the contract and checks:
 *
 *   - the pack on disk was built by that voice, for every one of the 69 lessons,
 *   - every sentence and every vocabulary word really has a clip,
 *   - every clip is surrounded by digital silence and both players stay inside it,
 *   - the app reads the same file, looks clips up with the same normalization
 *     (the course writes `Приве́т`, the pack stores `привет`), and falls back to
 *     the device voice only when a clip cannot start.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');
const preset = JSON.parse(fs.readFileSync(path.join(root, 'config/russian-narrator.json'), 'utf8'));
const narratorIds = preset.narrators.map(narrator => narrator.id);
const manifestOf = id => JSON.parse(fs.readFileSync(path.join(root, `public/audio/ru/${id}/manifest.json`), 'utf8'));

let checks = 0;
const check = (label, value) => { assert.ok(value, label); checks += 1; };

// --- the shipped pack ---------------------------------------------------------
const manifests = Object.fromEntries(narratorIds.map(id => [id, manifestOf(id)]));
check('the Russian narrator is configured and shipped',
  narratorIds.length >= 1 && fs.existsSync(path.join(root, 'public/audio/ru/voices.json')));
check('the voice is the female neural narrator chosen for the course',
  narratorIds.every(id => preset.narrators.find(n => n.id === id).voice === 'ru_RU-irina-medium'
    && manifests[id].engine.startsWith(`Piper neural ${preset.narrators.find(n => n.id === id).voice} `)));
check('the pack records which narrator produced it',
  narratorIds.every(id => manifests[id].narrator === id));
check('the pack speaks at the tempo written next to the narrator',
  narratorIds.every(id => Math.abs(Number(manifests[id].measuredWordsPerMinute)
    - preset.narrators.find(n => n.id === id).wordsPerMinute) <= 6));
check('the pack uses the neural speed setting from the config',
  narratorIds.every(id => manifests[id].lengthScale === preset.narrators.find(n => n.id === id).lengthScale));
check('the narrator list the app reads matches the config',
  JSON.parse(fs.readFileSync(path.join(root, 'public/audio/ru/voices.json'), 'utf8'))
    .narrators.map(n => n.id).join(',') === narratorIds.join(','));

// --- every clip stands alone --------------------------------------------------
const webPlayer = fs.readFileSync(path.join(root, 'lib/russianAudio.ts'), 'utf8');
const nativePlayer = fs.readFileSync(path.join(root, 'lib/russianAudioNative.native.ts'), 'utf8');
check('the pack keeps guard silence before and after every clip',
  narratorIds.every(id => manifests[id].leadInSeconds >= 0.3
    && manifests[id].sentenceGapSeconds >= 0.5 && manifests[id].wordGapSeconds >= 0.45
    && manifests[id].bitrate === 40));
check('the web player starts and stops inside that silence',
  /const PREROLL_SECONDS = 0\.25;/.test(webPlayer) && /const TAIL_SECONDS = 0\.15;/.test(webPlayer)
  && /Math\.max\(0, clip\.start - PREROLL_SECONDS\)/.test(webPlayer));
check('the Android player starts and stops inside that silence',
  /const PRE_ROLL_SECONDS = 0\.25;/.test(nativePlayer) && /const TAIL_SECONDS = 0\.15;/.test(nativePlayer));
check('the neural engine replaces the formant synthesizer',
  narratorIds.every(id => manifests[id].engine.startsWith('Piper neural'))
  && !/eSpeak/.test(fs.readFileSync(path.join(root, 'lib/russianAudio.ts'), 'utf8')));

let clips = 0;
let bytes = 0;
for (const narratorId of narratorIds) {
  const lessonIds = Object.keys(manifests[narratorId].lessons);
  check(`the ${narratorId} pack covers every Russian lesson`, lessonIds.length === 69);
  for (const id of lessonIds) {
    const entry = manifests[narratorId].lessons[id];
    for (const kind of ['sentences', 'words']) {
      const file = path.join(root, 'public/audio/ru', narratorId, entry[kind].file);
      const size = fs.existsSync(file) ? fs.statSync(file).size : 0;
      assert.ok(size > 2048, `missing or empty Russian clip: ${narratorId}/${entry[kind].file}`);
      bytes += size;
      clips += 1;
    }
  }
}
check('both clips of every lesson are shipped', clips === 138 * narratorIds.length);
check('the pack stays small enough to bundle', bytes < 20 * 1024 * 1024);

// --- the course text really has a clip ---------------------------------------
(async () => {
  const bundle = path.join(root, 'node_modules/.cache/russian-narrator-check.cjs');
  await esbuild.build({
    stdin: {
      contents: [
        "export * from './lib/languages/russian';",
        "export * from './lib/languages/russianNarrator';",
        "export * from './lib/russianAudio';",
      ].join('\n'),
      resolveDir: root,
    },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: bundle,
    logLevel: 'silent',
    plugins: [{
      name: 'russian-narrator-stubs',
      setup(build) {
        build.onResolve({ filter: /^\.\/supabase$/ }, args => args.importer.endsWith('/lib/createCourseProgressStore.ts')
          ? { path: 'supabase', namespace: 'russian-narrator-supabase' }
          : null);
        build.onLoad({ filter: /.*/, namespace: 'russian-narrator-supabase' }, () => ({
          contents: 'export const supabase = { auth: { async getSession() { return { data: { session: null } }; } } };',
          loader: 'js',
        }));
        build.onResolve({ filter: /^@react-native-async-storage\/async-storage$/ }, () => ({ path: 'storage', namespace: 'russian-narrator-storage' }));
        build.onLoad({ filter: /.*/, namespace: 'russian-narrator-storage' }, () => ({
          contents: 'const store = { async getItem() { return null; }, async setItem() {}, async removeItem() {} }; export default store;',
          loader: 'js',
        }));
        build.onResolve({ filter: /^react-native$/ }, () => ({ path: 'platform', namespace: 'russian-narrator-platform' }));
        build.onLoad({ filter: /.*/, namespace: 'russian-narrator-platform' }, () => ({
          contents: 'export const Platform = { OS: "web" };',
          loader: 'js',
        }));
        build.onResolve({ filter: /^\.\/russianAudioNative$/ }, () => ({ path: 'audio-native', namespace: 'russian-narrator-native' }));
        build.onLoad({ filter: /.*/, namespace: 'russian-narrator-native' }, () => ({
          contents: [
            'export function setNativeRussianVoice() {}',
            'export function stopNativeRussianClip() {}',
            'export async function playNativeRussianClip() { return false; }',
          ].join('\n'),
          loader: 'js',
        }));
      },
    }],
  });
  const app = require(bundle);

  // Normalization: the course text has a stress mark, the manifest key does not.
  check('the app strips the stress mark exactly like the generator',
    app.normalizeRussianClipText('Приве́т!') === 'привет!'
    && app.normalizeRussianClipText('  До́брое   у́тро! ') === 'доброе утро!');
  check('a sentence with a stress mark finds its stored clip',
    !!app.russianClipFor(manifests[narratorIds[0]], 'ru-l1-greetings', 'sentence', 'Приве́т!'));
  check('a vocabulary word with a stress mark finds its stored clip',
    !!app.russianClipFor(manifests[narratorIds[0]], 'ru-l1-greetings', 'word', 'привет'));
  check('the playback speed mapping keeps normal at 1x and slow below it',
    app.russianPlaybackRate(0.85) === 1 && app.russianPlaybackRate(0.78) === 0.85
    && app.russianPlaybackRate(0.5) === 0.75);
  check('an unknown narrator id falls back to the shipped one instead of breaking',
    app.findRussianNarrator('nope').id === preset.default && app.findRussianNarrator(null).id === preset.default);
  const faNumber = String(preset.narrators[0].wordsPerMinute)
    .replace(/[0-9]/g, digit => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);
  check('the label states the narrator and its measured tempo',
    app.russianNarratorLabel().includes(preset.narrators[0].nameFa)
    && app.russianNarratorLabel().includes(faNumber));

  // Every sentence and every word of the course has a clip in the pack.
  let missingSentences = 0;
  let missingWords = 0;
  let emptyWindows = 0;
  const manifest = manifests[preset.default];
  for (const lesson of app.RUSSIAN_LESSONS) {
    const entry = manifest.lessons[lesson.id];
    if (!entry) { missingSentences += lesson.sentences.length; continue; }
    for (const sentence of lesson.sentences) {
      const clip = app.russianClipFor(manifest, lesson.id, 'sentence', sentence.text);
      if (!clip) missingSentences += 1;
      else if (!(clip.end > clip.start + 0.05)) emptyWindows += 1;
      for (const word of sentence.vocabulary) {
        const wordClip = app.russianClipFor(manifest, lesson.id, 'word', word.word);
        if (!wordClip) missingWords += 1;
        else if (!(wordClip.end > wordClip.start + 0.05)) emptyWindows += 1;
      }
    }
  }
  check('every Russian sentence has its own clip', missingSentences === 0);
  check('every Russian vocabulary word has its own clip', missingWords === 0);
  check('every clip window is a positive interval, never an empty click', emptyWindows === 0);

  // The native asset map must cover the same files Metro has to bundle.
  const assets = fs.readFileSync(path.join(root, 'lib/russianAudioAssets.ts'), 'utf8');
  const required = [...assets.matchAll(/require\('\.\.\/public\/audio\/ru\/([^']+\.mp3)'\)/g)].map(match => match[1]).sort();
  check('the native asset map references every bundled Russian MP3 exactly once',
    required.length === clips && new Set(required).size === required.length);
  check('the native asset map embeds the same manifests the web build serves',
    narratorIds.every(id => assets.includes(`require('../public/audio/ru/${id}/manifest.json')`)));

  // The screens must ask the bundled narrator, with the device voice as cover.
  const home = fs.readFileSync(path.join(root, 'components/RussianHome.tsx'), 'utf8');
  const lesson = fs.readFileSync(path.join(root, 'components/RussianLesson.tsx'), 'utf8');
  const review = fs.readFileSync(path.join(root, 'components/RussianReview.tsx'), 'utf8');
  check('the Russian home reads the bundled narrator',
    /speakRussian\(/.test(home) && !/expo-speech/.test(home));
  check('the Russian lesson reads the bundled narrator',
    /speakRussian\(/.test(lesson) && !/expo-speech/.test(lesson) && /lessonId: lesson\.id/.test(lesson));
  check('the Russian review reads the bundled narrator from the card lesson',
    /speakRussian\(/.test(review) && !/expo-speech/.test(review) && /lessonId,/.test(review));
  const speech = fs.readFileSync(path.join(root, 'lib/russianSpeech.ts'), 'utf8');
  check('the device voice is only a failure cover, not a choice',
    /playRussianClip\(/.test(speech) && /deviceSpeak\(text, options, request, null\)/.test(speech)
    && /resolveSpeechOptions\(RUSSIAN_SPEECH_LOCALE\)/.test(speech));
  check('stopping always stops both the clip and the device voice',
    /export function stopRussianSpeech\(\): void \{[\s\S]*stopRussianClip\(\);[\s\S]*safeSpeechStop\(\);/.test(speech));

  console.log(`${checks} Russian narrator checks passed (one neural female voice, 69 lessons, guard silence, stress-mark lookup, bundled-first playback).`);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
