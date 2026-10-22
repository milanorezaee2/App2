#!/usr/bin/env node
/**
 * The Russian course is narrated by a woman.
 *
 * The learner asked for the Russian narrator to return to the voice the course
 * always used and to be female. Voice ranking used to treat male Russian names
 * (`Yuri`, `Pavel`) as premium and could pick them, so this suite pins the
 * contract: a feminine Russian voice wins whenever one is installed, a male
 * voice is never preferred over an unnamed one, and a device that only exposes
 * a single Russian voice still speaks instead of going silent.
 */
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

const storage = new Map();
let VOICES = [];
global.window = {
  localStorage: {
    getItem: key => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
  },
  speechSynthesis: {
    getVoices: () => VOICES,
    speak: () => undefined,
    cancel: () => undefined,
    resume: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    __speaking: false,
    get speaking() { return false; },
    get pending() { return false; },
  },
};
global.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };

(async () => {
  await require('esbuild').build({
    stdin: { contents: `export * from './lib/speechLanguage';`, resolveDir: root },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: path.join(root, 'node_modules/.cache/russian-voice.cjs'),
    logLevel: 'silent',
    plugins: [{
      name: 'rn-stubs',
      setup(build) {
        build.onResolve({ filter: /^react-native$/ }, () => ({ path: 'react-native', namespace: 'stub' }));
        build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: `export const Platform={OS:'web'};`, loader: 'js' }));
      },
    }],
  });

  const app = require(path.join(root, 'node_modules/.cache/russian-voice.cjs'));
  const voice = (name, lang, extra = {}) => ({ voiceURI: name, name, lang, localService: true, default: false, ...extra });
  let checks = 0;
  const check = (label, value) => { assert.ok(value, label); checks += 1; };

  check('an English voice is never offered for a Russian request',
    app.scoreVoiceForLocale({ identifier: 'Samantha', name: 'Samantha', language: 'en-US' }, 'ru-RU') === -1);

  // A device that ships both Russian narrators: the female one must win even
  // when the male voice is listed first and advertises a higher quality.
  VOICES = [voice('Yuri', 'ru-RU', { quality: 'enhanced' }), voice('Milena', 'ru-RU')];
  const mixed = await app.resolveSpeechOptions('ru-RU');
  check('the Russian narrator is female when the device offers Milena and Yuri', mixed.voice === 'Milena');
  check('Russian speech keeps the device language tag', mixed.language === 'ru-RU');

  // Chrome's network voice is female as well; it is acceptable when it is the
  // only feminine Russian voice, even though it is not installed locally.
  VOICES = [voice('Почта России', 'ru-RU'), voice('Google русский', 'ru-RU', { localService: false })];
  const network = await app.resolveSpeechOptions('ru-RU');
  check('a network feminine Russian voice is preferred over an unnamed one', network.voice === 'Google русский');

  // No recognisable feminine name: the only Russian voice must still be used.
  VOICES = [voice('ru-RU-language', 'ru-RU')];
  const unknown = await app.resolveSpeechOptions('ru-RU');
  check('an unnamed Russian voice is still used instead of silence', unknown.voice === 'ru-RU-language');

  // Only a male voice is installed: never drop it, but never invent a female one.
  VOICES = [voice('Pavel', 'ru-RU')];
  const maleOnly = await app.resolveSpeechOptions('ru-RU');
  check('a device with only a male Russian voice still speaks', maleOnly.voice === 'Pavel');

  // The Russian preference must not leak into the other courses.
  VOICES = [voice('Milena', 'ru-RU'), voice('Samantha', 'en-US')];
  const english = await app.resolveSpeechOptions('en-US');
  check('English resolution ignores the Russian narrator preference', english.voice === 'Samantha');

  check('Android receives the bare Russian language tag',
    app.speechTagFor('ru-RU', 'android') === 'ru' && app.speechTagFor('ru-RU', 'ios') === 'ru-RU');

  console.log(`${checks} Russian narrator checks passed (feminine voice first, no silence, other courses untouched).`);
})().catch(error => { console.error(error); process.exit(1); });
