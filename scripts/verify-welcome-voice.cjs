#!/usr/bin/env node
/**
 * The English greeting on the main screen.
 *
 * It used to be a single baked WAV whose voice was thin and badly accented. It
 * must now use the phone's own English voice (the same engine as the English
 * lessons), and fall back to the bundled neural clip only where no speech engine
 * exists (Firefox for Android).
 */
const assert = require('node:assert/strict');
const path = require('node:path');
const esbuild = require('esbuild');
const fs = require('node:fs');

const root = path.resolve(__dirname, '..');
const outfile = path.join(root, 'node_modules/.cache/welcome-voice.cjs');
let platform = 'android';

const build = esbuild.build({
  stdin: { contents: "export * from './lib/welcomeVoice';\nexport * from './lib/speechLanguage';", resolveDir: root },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile,
  logLevel: 'silent',
  loader: { '.wav': 'file' },
  plugins: [{
    name: 'welcome-stubs',
    setup(build) {
      build.onResolve({ filter: /^react-native$/ }, () => ({ path: 'react-native', namespace: 'stub' }));
      build.onResolve({ filter: /^expo-speech$/ }, () => ({ path: 'expo-speech', namespace: 'stub' }));
      build.onResolve({ filter: /^expo-audio$/ }, () => ({ path: 'expo-audio', namespace: 'stub' }));
      build.onResolve({ filter: /^@react-native-async-storage\/async-storage$/ }, () => ({ path: 'storage', namespace: 'stub' }));
      build.onLoad({ filter: /.*/, namespace: 'stub' }, args => {
        if (args.path === 'react-native') {
          return { contents: `export const Platform = { get OS() { return globalThis.__platform || 'android'; } };`, loader: 'js' };
        }
        if (args.path === 'expo-speech') {
          return {
            contents: `
              export function speak(text, options = {}) {
                globalThis.__welcomeSpeak = globalThis.__welcomeSpeak || [];
                globalThis.__welcomeSpeak.push({ text, language: options.language, voice: options.voice, rate: options.rate, pitch: options.pitch });
                if (globalThis.__speakThrows) throw new Error('no engine');
              }
              export async function stop() {}
              export async function getAvailableVoicesAsync() { return globalThis.__voices || []; }
            `,
            loader: 'js',
          };
        }
        if (args.path === 'expo-audio') {
          return {
            contents: `
              export function createAudioPlayer(assetId) {
                globalThis.__welcomeClips = globalThis.__welcomeClips || [];
                globalThis.__welcomeClips.push({ assetId });
                return { volume: 1, play() { this.played = true; }, remove() { this.removed = true; } };
              }
            `,
            loader: 'js',
          };
        }
        return { contents: 'const m=new Map(); export default { getItem: async k => m.get(k) ?? null, setItem: async (k,v) => { m.set(k, String(v)); }, removeItem: async k => { m.delete(k); } };', loader: 'js' };
      });
    },
  }],
});

(async () => {
  await build;
  const app = require(outfile);
  let checks = 0;
  const check = (label, value) => { assert.ok(value, label); checks += 1; console.log(`PASS ${label}`); };
  const reset = () => { globalThis.__welcomeSpeak = []; globalThis.__welcomeClips = []; globalThis.__speakThrows = false; };
  // The app registers this in app/_layout.tsx; re-registering also drops the cache.
  const useVoices = voices => {
    globalThis.__voices = voices;
    app.registerNativeVoiceFetcher(async () => voices);
  };

  // 1. Phone with an English voice: the natural system voice speaks the greeting.
  globalThis.__platform = 'android';
  useVoices([
    { identifier: 'de-de-1', name: 'Deutsch', language: 'de-DE' },
    { identifier: 'en-us-x-iog', name: 'English United States', language: 'en-US' },
  ]);
  reset();
  const engine = await app.playWelcomeVoice();
  check('the greeting uses the phone voice, not a baked-in recording', engine === 'device');
  check('the greeting asks for English, never German',
    String(globalThis.__welcomeSpeak[0]?.language || '').toLowerCase().startsWith('en'));
  check('the installed English voice is passed by identifier',
    globalThis.__welcomeSpeak[0]?.voice === 'en-us-x-iog');
  check('the greeting is spoken at natural pace and pitch, not stretched',
    globalThis.__welcomeSpeak[0]?.rate === 1 && globalThis.__welcomeSpeak[0]?.pitch === 1);
  check('the greeting text is the same short welcome', globalThis.__welcomeSpeak[0]?.text === 'Welcome to Milo!');
  check('no bundled clip is played when the phone can speak', globalThis.__welcomeClips.length === 0);

  // 2. Firefox for Android: no speech engine at all -> bundled neural clip.
  globalThis.__platform = 'web';
  useVoices([]);
  reset();
  globalThis.window = {}; // no speechSynthesis
  const webEngine = await app.playWelcomeVoice();
  check('a browser without a speech engine plays the bundled clip', webEngine === 'bundled');
  check('no speech call is attempted without an engine', globalThis.__welcomeSpeak.length === 0);
  check('the bundled greeting clip is the new neural recording',
    globalThis.__welcomeClips.length === 1 && app.WELCOME_TEXT.length > 0);
  delete globalThis.window;

  // 3. An engine that refuses to start still leaves a heard greeting.
  globalThis.__platform = 'android';
  useVoices([{ identifier: 'en-us-x-iog', name: 'English', language: 'en-US' }]);
  reset();
  globalThis.__speakThrows = true;
  const failedEngine = await app.playWelcomeVoice();
  check('when the engine refuses, the bundled clip covers the greeting', failedEngine === 'bundled');

  // 4. The shipped fallback file must be a real, short, decodable WAV.
  const file = path.join(root, 'assets/audio/welcome-voice.wav');
  const bytes = fs.readFileSync(file);
  const riff = bytes.subarray(0, 4).toString('ascii');
  const sampleRate = bytes.readUInt32LE(24);
  const channels = bytes.readUInt16LE(22);
  const bits = bytes.readUInt16LE(34);
  const dataSize = bytes.readUInt32LE(40);
  const seconds = dataSize / (sampleRate * channels * (bits / 8));
  check('the bundled greeting is a valid mono 16-bit WAV',
    riff === 'RIFF' && channels === 1 && bits === 16);
  check('the bundled greeting is short (under 2 s) and uses the app sample rate',
    seconds > 0.5 && seconds < 2 && sampleRate === 22050);
  check('the bundled greeting is not the old thin voice (clean spectral balance)',
    bytes.length < 80 * 1024);

  console.log(`\n${checks} welcome-voice checks passed.`);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
