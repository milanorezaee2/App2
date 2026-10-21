#!/usr/bin/env node
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const narrator = require(path.join(root, 'config/german-narrator.json'));

// Minimal browser stubs: the speech layer is exercised as it runs on web.
const storage = new Map();
const WEB_VOICES = [
  { voiceURI: 'Google Deutsch', name: 'Google Deutsch', lang: 'de-DE', localService: false, default: false },
  { voiceURI: 'Microsoft Hedda', name: 'Microsoft Hedda Desktop', lang: 'de-DE', localService: true, default: false },
  { voiceURI: 'Samantha', name: 'Samantha', lang: 'en-US', localService: true, default: true },
];
const spokenUtterances = [];
global.window = {
  localStorage: {
    getItem: key => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
  },
  speechSynthesis: {
    getVoices: () => WEB_VOICES,
    speak: utterance => {
      spokenUtterances.push(utterance);
      global.window.speechSynthesis.__speaking = true;
      setTimeout(() => { if (typeof utterance.onStart === 'function') utterance.onStart(); }, 5);
    },
    cancel: () => { global.window.speechSynthesis.__speaking = false; },
    resume: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    __speaking: false,
    get speaking() { return this.__speaking; },
    get pending() { return false; },
  },
};
class MockSpeechSynthesisUtterance {
  constructor(text) {
    this.text = text;
    this.voice = null;
    this.lang = '';
    this.rate = 1;
    this.pitch = 1;
    this.volume = 1;
  }
}
global.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
global.window.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));


(async () => {
await require('esbuild').build({
  stdin: {
    contents: `
      export * from './lib/speechLanguage';
      export * from './lib/germanSpeech';
      export * from './lib/languages/germanSentenceCourse';
      export * from './lib/languages/russian';
      export * from './lib/languages/germanLessonChecks';
      export * from './lib/languages/germanStudyState';
    `,
    resolveDir: root,
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: path.join(root, 'node_modules/.cache/german-lesson-flow.cjs'),
  logLevel: 'silent',
  plugins: [{
    name: 'rn-stubs',
    setup(build) {
      build.onResolve({ filter: /^react-native$/ }, () => ({ path: 'react-native', namespace: 'stub' }));
      build.onResolve({ filter: /^expo-speech$/ }, () => ({ path: 'expo-speech', namespace: 'stub' }));
      build.onResolve({ filter: /^@react-native-async-storage\/async-storage$/ }, () => ({ path: 'async-storage', namespace: 'stub' }));
      build.onLoad({ filter: /.*/, namespace: 'stub' }, args => {
        if (args.path === 'react-native') return { contents: `export const Platform={OS:'web'};`, loader: 'js' };
        if (args.path === 'expo-speech') return { contents: `
          export function speak(text, options = {}) {
            globalThis.__expoSpoken = globalThis.__expoSpoken || [];
            globalThis.__expoSpoken.push({ text, ...options });
            globalThis.__expoEvents = globalThis.__expoEvents || [];
            globalThis.__expoEvents.push('speak:' + text);
            if (globalThis.window && globalThis.window.speechSynthesis) globalThis.window.speechSynthesis.__speaking = true;
            if (typeof options.onStart === 'function') setTimeout(() => options.onStart(), 0);
          }
          export async function stop() {
            globalThis.__expoStops = (globalThis.__expoStops || 0) + 1;
            globalThis.__expoEvents = globalThis.__expoEvents || [];
            globalThis.__expoEvents.push('stop');
            if (globalThis.window && globalThis.window.speechSynthesis) globalThis.window.speechSynthesis.__speaking = false;
          }
          export async function getAvailableVoicesAsync() { return []; }
        `, loader: 'js' };
        return { contents: `const m=new Map(); export default { getItem:async k=>m.has(k)?m.get(k):null, setItem:async(k,v)=>{m.set(k,String(v));}, removeItem:async k=>{m.delete(k);} };`, loader: 'js' };
      });
    },
  }],
});
  const app = require(path.join(root, 'node_modules/.cache/german-lesson-flow.cjs'));
  let checks = 0;
  const check = (label, value) => { assert.ok(value, label); checks += 1; };

  check('German and Russian lesson flows expose the same nine English stage labels',
    app.GERMAN_SENTENCE_STAGES.map(stage => stage.labelEn).join('|') === app.RUSSIAN_LESSON_STAGES.map(stage => stage.labelEn).join('|'));
  check('German lesson stages are nine ordered Persian/English pairs',
    app.GERMAN_SENTENCE_STAGES.length === 9 && app.GERMAN_SENTENCE_STAGES.every((stage, index) => stage.id && stage.labelFa && app.GERMAN_SENTENCE_STAGES.findIndex(item => item.id === stage.id) === index));

  // The original bug: Chrome's excellent network German voice was rejected.
  const allWebVoices = global.window.speechSynthesis.getVoices;
  global.window.speechSynthesis.getVoices = () => allWebVoices().filter(voice => voice.lang === 'de-DE' && !voice.localService);
  const networkOnlyGerman = await app.resolveRequiredSpeechOptions('de-DE');
  check('a network-only German voice is accepted instead of leaving the lesson silent', networkOnlyGerman?.voice === 'Google Deutsch' && networkOnlyGerman.language === 'de-DE');
  global.window.speechSynthesis.getVoices = allWebVoices;
  const preferredGerman = await app.resolveSpeechOptions('de-DE');
  check('ordinary German speech resolves a declared German voice', preferredGerman.voice === 'Microsoft Hedda' || preferredGerman.voice === 'Google Deutsch');
  check('English is never offered for a German request', app.scoreVoiceForLocale({ identifier: 'Samantha', name: 'Samantha', language: 'en-US' }, 'de-DE') === -1);
  check('Austrian and Swiss German voices still count as German', app.voicesForLocale([
    { identifier: 'de-AT', name: 'Österreich', language: 'de-AT' },
    { identifier: 'de-CH', name: 'Schweiz', language: 'de-CH' },
    { identifier: 'en-GB', name: 'English', language: 'en-GB' },
  ], 'de-DE').length === 2);
  const unsupported = await app.resolveRequiredSpeechOptions('fr-FR');
  check('a language with no declared voice returns null instead of the English default', unsupported === null);

  // Exercise the real playback path: German must go through expo-speech exactly
  // like the Russian lesson does, instead of a private speechSynthesis shortcut.
  globalThis.__expoSpoken = [];
  const germanList = await app.listGermanVoices();
  check('the German voice list only contains German voices', germanList.length === 2 && germanList.every(voice => voice.language.toLowerCase().startsWith('de')));

  app.setGermanVoicePreference('Google Deutsch');
  app.speakGerman({ text: 'Guten Morgen!', rate: 0.55 });
  await wait(160);
  const first = globalThis.__expoSpoken.at(-1);
  check('German speech reaches expo-speech, the same engine the Russian lesson uses', first?.text === 'Guten Morgen!' && globalThis.__expoSpoken.length === 1);
  check('the learner-selected German voice is passed to the engine', first?.voice === 'Google Deutsch');
  check('the request carries the German language tag', String(first?.language || '').toLowerCase().startsWith('de'));
  check('slow replay keeps its slow rate', first?.rate === narrator.deviceSlowRate);

  app.setGermanVoicePreference(null);
  app.speakGerman({ text: 'Wie geht es dir?' });
  await wait(160);
  const second = globalThis.__expoSpoken.at(-1);
  check('without a preference an installed German voice is preferred', second?.voice === 'Microsoft Hedda');
  check('natural speech is read at the chosen narrator tempo so it flows',
    second?.rate === narrator.deviceRate);
  const events = globalThis.__expoEvents || [];
  const secondSpeak = events.lastIndexOf('speak:Wie geht es dir?');
  check('a sentence that is still speaking is stopped before the next one starts',
    secondSpeak > 0 && events.slice(0, secondSpeak).includes('stop'));

  // Parity with Russian: when the platform lists no German voice at all, the
  // lesson still asks for German. Russian never refuses in this situation, and
  // refusing was exactly what made the German section silent.
  const originalVoices = global.window.speechSynthesis.getVoices;
  global.window.speechSynthesis.getVoices = () => WEB_VOICES.filter(voice => voice.lang === 'en-US');
  globalThis.__expoSpoken = [];
  let missingVoiceReason = null;
  app.speakGerman({ text: 'Hallo', onError: reason => { missingVoiceReason = reason; } });
  await wait(400);
  const fallback = globalThis.__expoSpoken.at(-1);
  check('with no listed German voice the lesson still speaks German like Russian does', fallback?.text === 'Hallo' && String(fallback?.language || '').toLowerCase().startsWith('de'));
  check('the fallback never forwards an English voice identifier', !fallback?.voice || !/english|samantha/i.test(String(fallback.voice)));
  check('a missing voice entry is not reported as an error', missingVoiceReason === null);
  check('the speech layer reports that the device has no German voice',
    app.getGermanVoiceStatus().checked === true && app.getGermanVoiceStatus().german === false);
  global.window.speechSynthesis.getVoices = originalVoices;
  app.setGermanVoicePreference(null);
  check('choosing the automatic voice clears the stored preference', (storage.get('german_voice_preference_v1') ?? null) === null);
  app.speakGerman({ text: 'Tschüss' });
  await wait(200);
  check('after the German voices come back the speech layer reports a German voice again',
    app.getGermanVoiceStatus().german === true && !!app.getGermanVoiceStatus().voiceName);

  // The German voice that ships with the app: every sentence and every word of
  // every lesson must have a clip, and the referenced files must exist.
  const fs = require('node:fs');
  const audioDir = path.join(root, 'public/audio/de');
  const manifest = JSON.parse(fs.readFileSync(path.join(audioDir, 'manifest.json'), 'utf8'));
  const lessonsWithAudio = Object.keys(manifest.lessons).length;
  check('the German audio pack covers every lesson', lessonsWithAudio === app.GERMAN_SENTENCE_LESSONS.length);
  let missingSentences = 0;
  let missingWords = 0;
  let badRanges = 0;
  let missingFiles = 0;
  const checkedFiles = new Set();
  for (const lesson of app.GERMAN_SENTENCE_LESSONS) {
    const entry = manifest.lessons[lesson.id];
    if (!entry) { missingSentences += lesson.sentences.length; continue; }
    for (const [kind, pack, texts] of [
      ['sentences', entry.sentences, lesson.sentences.map(item => item.text)],
      ['words', entry.words, lesson.sentences.flatMap(item => item.vocabulary.map(word => word.word))],
    ]) {
      const file = path.join(audioDir, pack.file);
      if (!checkedFiles.has(pack.file)) {
        checkedFiles.add(pack.file);
        if (!fs.existsSync(file) || fs.statSync(file).size < 20000) missingFiles += 1;
      }
      for (const text of texts) {
        const key = text.trim().toLowerCase().replace(/\s+/g, ' ');
        const range = pack.clips[key];
        if (!range) { if (kind === 'sentences') missingSentences += 1; else missingWords += 1; continue; }
        if (!(range[1] > range[0] + 0.15)) badRanges += 1;
      }
    }
  }
  check('every German sentence has its own clip in the shipped audio pack', missingSentences === 0);
  check('every German vocabulary word has its own clip in the shipped audio pack', missingWords === 0);
  check('every clip range is a positive, non-empty interval', badRanges === 0);
  check('every referenced audio file is present and non-trivial', missingFiles === 0 && checkedFiles.size === app.GERMAN_SENTENCE_LESSONS.length * 2);
  check('the audio pack records which engine produced it', /eSpeak NG/.test(String(manifest.engine)));

  // The Android/iOS build cannot fetch the audio over HTTP: every clip must be
  // referenced with a static require so Metro copies it into the APK/IPA.
  const assetsFile = path.join(root, 'lib/germanAudioAssets.ts');
  const assetsSource = fs.readFileSync(assetsFile, 'utf8');
  const audioFilesOnDisk = fs.readdirSync(audioDir).filter(name => name.endsWith('.mp3')).sort();
  const requiredFiles = [...assetsSource.matchAll(/require\('\.\.\/public\/audio\/de\/([^']+\.mp3)'\)/g)].map(match => match[1]).sort();
  check('the native asset map references every bundled MP3 exactly once',
    requiredFiles.length === audioFilesOnDisk.length
    && new Set(requiredFiles).size === requiredFiles.length
    && requiredFiles.every((file, index) => file === audioFilesOnDisk[index]));
  check('the native asset map is generated for all lessons, not a subset',
    Number((assetsSource.match(/GERMAN_AUDIO_FILE_COUNT = (\d+)/) || [])[1]) === audioFilesOnDisk.length);
  check('the native asset map embeds the same manifest the web build serves',
    assetsSource.includes("require('../public/audio/de/manifest.json')"));

  // The native bridge must really use expo-audio and honour clip offsets.
  const nativeBridge = fs.readFileSync(path.join(root, 'lib/germanAudioNative.native.ts'), 'utf8');
  check('native playback uses expo-audio', /from 'expo-audio'/.test(nativeBridge) && /createAudioPlayer/.test(nativeBridge));
  check('native playback waits for the file to load before it seeks',
    /waitForLoaded\(created/.test(nativeBridge) && /isLoaded/.test(nativeBridge));
  check('native playback seeks to the recorded clip start',
    /seekAndSettle\(created, clip\.start\)/.test(nativeBridge) && /\.seekTo\(/.test(nativeBridge));
  check('native playback stops at the recorded clip end', /clip\.end - clip\.start/.test(nativeBridge));
  check('the web build keeps using the Audio element, not expo-audio',
    !/from 'expo-audio'/.test(fs.readFileSync(path.join(root, 'lib/germanAudio.ts'), 'utf8'))
    && !/expo-audio/.test(fs.readFileSync(path.join(root, 'lib/germanAudioNative.ts'), 'utf8')));

  check('speech boundary indexes map to the word being read', app.wordIndexAt('Guten Morgen, wie geht es dir?', 6) === 1 && app.wordIndexAt('Guten Morgen', 0) === 0 && app.wordIndexAt('Guten Morgen', 11) === 1);

  const lessons = app.GERMAN_SENTENCE_LESSONS;
  let generated = 0;
  for (const lesson of lessons) {
    const first = app.buildGermanLessonChecks(lesson);
    const second = app.buildGermanLessonChecks(lesson);
    check(`${lesson.id}: lesson checks are deterministic`, JSON.stringify(first) === JSON.stringify(second));
    check(`${lesson.id}: lesson ends with readable self-study questions`, first.length >= 3);
    for (const question of first) {
      generated += 1;
      check(`${lesson.id}: every question has three distinct choices`, question.choices.length === 3 && new Set(question.choices).size === 3);
      check(`${lesson.id}: one valid correct choice`, Number.isInteger(question.correctIndex) && question.correctIndex >= 0 && question.correctIndex < 3);
      check(`${lesson.id}: every question explains its answer`, !!question.promptFa && !!question.explanationFa);
    }
    const allowed = new Set([...lesson.sentences.map(sentence => sentence.text), ...lesson.sentences.map(sentence => sentence.fa), ...lesson.sentences.flatMap(sentence => sentence.vocabulary.map(word => word.meaning))]);
    check(`${lesson.id}: no question choice is invented outside this lesson`, first.every(question => question.choices.every(choice => allowed.has(choice))));
  }
  check('all German lessons generate a substantial self-check set', generated >= lessons.length * 3);

  const sample = lessons[0];
  const sampleSession = app.freshGermanLessonSession();
  await app.saveGermanLessonSession(sample.id, { ...sampleSession, stage: 8, answers: { 0: 1 }, showCheckAnswers: true });
  check('saved nine-stage German session restores exactly', JSON.stringify(await app.loadGermanLessonSession(sample.id)) === JSON.stringify({ ...sampleSession, stage: 8, answers: { 0: 1 }, showCheckAnswers: true }));
  let rejectedStage = false;
  try { await app.saveGermanLessonSession(sample.id, { ...sampleSession, stage: 9 }); } catch { rejectedStage = true; }
  check('out-of-range German stage is rejected', rejectedStage);
  let rejectedPage = false;
  try { await app.saveGermanLessonSession(sample.id, { ...sampleSession, stage: 2, sentenceIndex: 999 }); } catch { rejectedPage = true; }
  check('out-of-range German listening page is rejected', rejectedPage);
  await app.clearGermanLessonSession(sample.id);
  check('German lesson session clears after completion', JSON.stringify(await app.loadGermanLessonSession(sample.id)) === JSON.stringify(sampleSession));

  console.log(`${checks} German nine-stage lesson, German speech-resilience and self-check checks passed (${lessons.length} lessons, ${generated} generated questions; no microphone recording or online speech service).`);
})().catch(error => { console.error(error); process.exit(1); });
