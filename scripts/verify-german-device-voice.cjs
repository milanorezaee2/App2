#!/usr/bin/env node
/**
 * The learner chose one German narrator by ear ("the current voice, one step
 * faster"), and asked that every lesson really speaks with it. These checks
 * compile `lib/germanSpeech.ts` for **Android** and prove that:
 *
 *   - the default path plays the chosen narrator from the bundled pack, even on
 *     a phone that also has a German system voice,
 *   - if a clip cannot play, the phone's German voice covers it instead of
 *     leaving the sentence silent (and never an English voice),
 *   - a phone with no German voice still hears the same narrator,
 *   - the explicit "always the phone voice" choice from the audio page works.
 */
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');
const narrator = require(path.join(root, 'config/german-narrator.json'));
const outfile = path.join(root, 'node_modules/.cache/german-device-voice.cjs');
const platform = process.env.FAKE_PLATFORM || 'android';

const build = esbuild.build({
  stdin: {
    contents: `
      export * from './lib/germanSpeech';
      export * from './lib/speechLanguage';
    `,
    resolveDir: root,
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile,
  logLevel: 'silent',
  define: { __FAKE_PLATFORM__: JSON.stringify(platform) },
  plugins: [{
    name: 'native-stubs',
    setup(build) {
      build.onResolve({ filter: /^react-native$/ }, () => ({ path: 'react-native', namespace: 'stub' }));
      build.onResolve({ filter: /^expo-speech$/ }, () => ({ path: 'expo-speech', namespace: 'stub' }));
      build.onResolve({ filter: /^@react-native-async-storage\/async-storage$/ }, () => ({ path: 'async-storage', namespace: 'stub' }));
      build.onResolve({ filter: /^\.\/germanAudioNative$/ }, () => ({ path: 'german-audio-native', namespace: 'stub' }));
      build.onLoad({ filter: /.*/, namespace: 'stub' }, args => {
        if (args.path === 'react-native') {
          return { contents: `export const Platform = { OS: ${JSON.stringify(platform)} };`, loader: 'js' };
        }
        if (args.path === 'expo-speech') {
          return {
            contents: `
              globalThis.__spoken = [];
              export function speak(text, options = {}) {
                globalThis.__spoken.push({ text, language: options.language, voice: options.voice, rate: options.rate });
                setTimeout(() => options.onStart && options.onStart(), 5);
              }
              export async function stop() { globalThis.__stops = (globalThis.__stops || 0) + 1; }
              export async function getAvailableVoicesAsync() { return globalThis.__deviceVoices || []; }
            `,
            loader: 'js',
          };
        }
        if (args.path === 'german-audio-native') {
          return {
            contents: `
              globalThis.__bundled = [];
              export async function playNativeGermanClip(options) {
                globalThis.__bundled.push({ text: options.text, kind: options.kind });
                if (globalThis.__bundledFails) return false;
                if (options.onStart) options.onStart();
                if (options.onDone) setTimeout(() => options.onDone(), 10);
                return true;
              }
              export function stopNativeGermanClip() {}
              export const GERMAN_AUDIO_MANIFEST = { version: 0, lessons: {} };
              export function bundledGermanClip() { return null; }
              export function hasBundledGermanLesson() { return false; }
            `,
            loader: 'js',
          };
        }
        return {
          contents: 'const m = new Map(); export default { getItem: async k => m.has(k) ? m.get(k) : null, setItem: async (k, v) => { m.set(k, String(v)); }, removeItem: async k => { m.delete(k); } };',
          loader: 'js',
        };
      });
    },
  }],
});

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const GERMAN_VOICE = { identifier: 'de-de-x-deu-local', name: 'Deutsch (Deutschland)', language: 'de-DE', localService: true };
const ENGLISH_VOICE = { identifier: 'en-us-x-tpf-local', name: 'English United States', language: 'en-US', localService: true };

(async () => {
  await build;
  const app = require(outfile);
  let checks = 0;
  const check = (label, value) => { assert.ok(value, label); checks += 1; console.log(`PASS ${label}`); };

  // The app registers the native voice fetcher in app/_layout.tsx; this bundle
  // exposes the real `registerNativeVoiceFetcher`, so wire it here.
  app.registerNativeVoiceFetcher(async () => globalThis.__deviceVoices || []);

  // --- 1. Default: the chosen narrator plays, even next to a German device voice. ---
  globalThis.__deviceVoices = [GERMAN_VOICE, ENGLISH_VOICE];
  globalThis.__spoken = [];
  globalThis.__bundled = [];
  globalThis.__bundledFails = false;
  app.speakGerman({ text: 'Guten Morgen!', rate: 1 });
  await wait(260);
  check('on Android the chosen narrator is the one that speaks',
    globalThis.__bundled.length === 1 && globalThis.__bundled[0].text === 'Guten Morgen!');
  check('the phone system voice does not replace the chosen narrator',
    globalThis.__spoken.length === 0);
  check('the reported engine is the bundled narrator', app.getGermanVoiceStatus().engine === 'app');

  // --- 1b. The pack cannot play a clip: the phone voice covers it, in German. ---
  globalThis.__bundledFails = true;
  globalThis.__spoken = [];
  globalThis.__bundled = [];
  app.speakGerman({ text: 'Wie heißt du?', rate: 1 });
  await wait(320);
  check('a clip the pack cannot play is covered by the phone voice instead of silence',
    globalThis.__spoken.length === 1 && globalThis.__spoken[0].text === 'Wie heißt du?');
  check('the cover request carries a German locale, never English',
    String(globalThis.__spoken[0]?.language || '').toLowerCase().startsWith('de'));
  check('the cover uses the installed German voice by identifier',
    globalThis.__spoken[0]?.voice === GERMAN_VOICE.identifier);
  check('the cover follows the chosen narrator tempo',
    globalThis.__spoken[0]?.rate === narrator.deviceRate);
  globalThis.__bundledFails = false;

  // --- 2. A phone with no German voice: bundled audio, never a foreign voice. ---
  globalThis.__deviceVoices = [ENGLISH_VOICE];
  // Re-registering the fetcher drops the cached voice list (lib/speechLanguage).
  app.registerNativeVoiceFetcher(async () => globalThis.__deviceVoices || []);
  globalThis.__spoken = [];
  globalThis.__bundled = [];
  app.speakGerman({ text: 'Wie geht es dir?', rate: 1 });
  await wait(260);
  check('without a German voice the same narrator speaks from the pack',
    globalThis.__bundled.length === 1 && globalThis.__bundled[0].text === 'Wie geht es dir?');
  check('German is never handed to an English system voice',
    globalThis.__spoken.length === 0);
  check('the reported engine is still the bundled narrator', app.getGermanVoiceStatus().engine === 'app');

  // --- 3. No voices at all (bare Android image): still guaranteed German. ---
  globalThis.__deviceVoices = [];
  app.registerNativeVoiceFetcher(async () => globalThis.__deviceVoices || []);
  globalThis.__spoken = [];
  globalThis.__bundled = [];
  app.speakGerman({ text: 'Bis bald!', rate: 1 });
  await wait(260);
  check('a phone that lists no voices at all still speaks German from the app',
    globalThis.__bundled.length === 1 && globalThis.__spoken.length === 0);

  // --- 4. The learner's explicit "always device" choice still works natively. ---
  app.setGermanVoiceSource('device');
  globalThis.__deviceVoices = [GERMAN_VOICE];
  app.registerNativeVoiceFetcher(async () => globalThis.__deviceVoices || []);
  globalThis.__spoken = [];
  globalThis.__bundled = [];
  app.speakGerman({ text: 'Hallo!', rate: 1 });
  await wait(260);
  check('the explicit device choice uses the phone voice on Android too',
    globalThis.__spoken.length === 1 && globalThis.__bundled.length === 0);
  app.setGermanVoiceSource('auto');

  console.log(`\n${checks} Android device-voice checks passed (platform=${platform}).`);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
