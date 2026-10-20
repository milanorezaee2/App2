#!/usr/bin/env node
/**
 * Generate the native asset map for the bundled German voice.
 *
 * The Android/iOS build cannot fetch `/audio/de/manifest.json` from a web server
 * (there is none inside the APK), so every MP3 is referenced with `require()` and
 * Metro copies it into the app bundle. This keeps a single copy of the audio on
 * disk: the very same files are served to the web build from `public/audio/de`.
 *
 * Run after regenerating the audio pack:
 *   node scripts/export-german-course.cjs
 *   python3 scripts/generate-german-audio.py
 *   node scripts/generate-german-audio-assets.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const audioDir = path.join(root, 'public/audio/de');
const outfile = path.join(root, 'lib/germanAudioAssets.ts');

const files = fs.readdirSync(audioDir).filter(name => name.endsWith('.mp3')).sort();
if (!files.length) {
  console.error('No MP3 files in public/audio/de; run the audio generator first.');
  process.exit(1);
}
if (!fs.existsSync(path.join(audioDir, 'manifest.json'))) {
  console.error('public/audio/de/manifest.json is missing.');
  process.exit(1);
}

const lines = files.map(file => `  '${file}': require('../public/audio/de/${file}'),`);
const content = `/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * GENERATED FILE — do not edit by hand.
 * Regenerate with: node scripts/generate-german-audio-assets.cjs
 *
 * Metro cannot resolve asset paths at runtime, so every bundled German clip is
 * listed here with a static require. Only the native bundles import this file;
 * the web build streams the same MP3s from /audio/de.
 */
export const GERMAN_AUDIO_MANIFEST = require('../public/audio/de/manifest.json') as {
  version: number;
  engine?: string;
  lessons: Record<string, {
    sentences: { file: string; clips: Record<string, [number, number]> };
    words: { file: string; clips: Record<string, [number, number]> };
  }>;
};

export const GERMAN_AUDIO_FILES: Record<string, number> = {
${lines.join('\n')}
};

export const GERMAN_AUDIO_FILE_COUNT = ${files.length};
`;

fs.writeFileSync(outfile, content);
console.log(`Wrote ${path.relative(root, outfile)} with ${files.length} clips.`);
