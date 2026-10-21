#!/usr/bin/env node
/**
 * Generate the native asset map for the bundled Russian narrator.
 *
 * The Android/iOS build cannot fetch `/audio/ru/<narrator>/manifest.json` from a
 * web server (there is none inside the APK), so every MP3 is referenced with
 * `require()` and Metro copies it into the app bundle. This keeps a single copy
 * of the audio on disk: the very same files are served to the web build from
 * `public/audio/ru/<narrator>/`.
 *
 * Run after regenerating the audio pack:
 *   node scripts/export-russian-course.cjs
 *   python3 scripts/generate-russian-audio.py
 *   node scripts/generate-russian-audio-assets.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const audioDir = path.join(root, 'public/audio/ru');
const outfile = path.join(root, 'lib/russianAudioAssets.ts');

const preset = JSON.parse(fs.readFileSync(path.join(root, 'config/russian-narrator.json'), 'utf8'));
const narrators = preset.narrators.map(narrator => narrator.id);

// Every narrator in the config must be complete: a half-finished render must
// never produce an APK where the Russian course is silent.
const missing = narrators.filter(id => !fs.existsSync(path.join(audioDir, id, 'manifest.json')));
if (missing.length) {
  console.error(`Incomplete Russian packs: ${missing.join(', ')}. Run scripts/generate-russian-audio.py first.`);
  process.exit(1);
}

const entries = [];
const manifests = [];
let total = 0;
for (const voiceId of narrators) {
  const dir = path.join(audioDir, voiceId);
  const files = fs.readdirSync(dir).filter(name => name.endsWith('.mp3')).sort();
  if (!files.length) {
    console.error(`public/audio/ru/${voiceId} has no MP3 files.`);
    process.exit(1);
  }
  for (const file of files) {
    entries.push(`  '${voiceId}/${file}': require('../public/audio/ru/${voiceId}/${file}'),`);
  }
  manifests.push(`  ${voiceId}: require('../public/audio/ru/${voiceId}/manifest.json') as RussianAudioManifest,`);
  total += files.length;
}

const content = `/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * GENERATED FILE — do not edit by hand.
 * Regenerate with: node scripts/generate-russian-audio-assets.cjs
 *
 * Metro cannot resolve asset paths at runtime, so every bundled Russian clip is
 * listed here with a static require. Only the native bundles import this file;
 * the web build streams the same MP3s from /audio/ru/<narrator>/.
 */
export type RussianAudioManifest = {
  version: number;
  narrator?: string;
  engine?: string;
  lessons: Record<string, {
    sentences: { file: string; clips: Record<string, [number, number]> }
    words: { file: string; clips: Record<string, [number, number]> }
  }>;
};

/** One manifest per narrator; the app plays from the selected narrator only. */
export const RUSSIAN_AUDIO_MANIFESTS: Record<string, RussianAudioManifest> = {
${manifests.join('\n')}
};

/** Key format: '<narrator>/<file>.mp3' -> the Metro asset id. */
export const RUSSIAN_AUDIO_FILES: Record<string, number> = {
${entries.join('\n')}
};

export const RUSSIAN_AUDIO_FILE_COUNT = ${total};
`;

fs.writeFileSync(outfile, content);
console.log(`Wrote ${path.relative(root, outfile)} with ${total} clips across ${narrators.length} narrators (${narrators.join(', ')}).`);
