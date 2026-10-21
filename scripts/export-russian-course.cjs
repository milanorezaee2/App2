#!/usr/bin/env node
/**
 * Dev helper: dump the Russian course text (sentences + vocabulary words) so the
 * audio generator can synthesize the in-app Russian narrator.
 *
 * The Russian course modules import the progress store, which imports React
 * Native; both are stubbed so the lesson data can be read in plain Node without
 * touching the app or the network.
 *
 *   node scripts/export-russian-course.cjs [output.json]
 */
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');
const outfile = process.argv[2] || path.join(root, 'node_modules/.cache/russian-course-text.json');

(async () => {
  const esbuild = require('esbuild');
  const bundle = path.join(root, 'node_modules/.cache/russian-course-export.cjs');
  await esbuild.build({
    stdin: { contents: "export * from './lib/languages/russian';", resolveDir: root },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: bundle,
    logLevel: 'silent',
    plugins: [{
      name: 'russian-export-stubs',
      setup(build) {
        build.onResolve({ filter: /^\.\/supabase$/ }, args => args.importer.endsWith('/lib/createCourseProgressStore.ts')
          ? { path: 'supabase', namespace: 'russian-export-supabase' }
          : null);
        build.onLoad({ filter: /.*/, namespace: 'russian-export-supabase' }, () => ({
          contents: 'export const supabase = { auth: { async getSession() { return { data: { session: null } }; } } };',
          loader: 'js',
        }));
        build.onResolve({ filter: /^@react-native-async-storage\/async-storage$/ }, () => ({ path: 'storage', namespace: 'russian-export-storage' }));
        build.onLoad({ filter: /.*/, namespace: 'russian-export-storage' }, () => ({
          contents: 'const store = { async getItem() { return null; }, async setItem() {}, async removeItem() {} }; export default store;',
          loader: 'js',
        }));
        build.onResolve({ filter: /^react-native$/ }, () => ({ path: 'platform', namespace: 'russian-export-platform' }));
        build.onLoad({ filter: /.*/, namespace: 'russian-export-platform' }, () => ({
          contents: 'export const Platform = { OS: "web" };',
          loader: 'js',
        }));
      },
    }],
  });
  const course = require(bundle);
  const lessons = course.RUSSIAN_LESSONS.map(lesson => ({
    id: lesson.id,
    sentences: lesson.sentences.map(sentence => ({
      text: sentence.text,
      words: [...new Set(sentence.vocabulary.map(item => item.word))],
    })),
  }));
  fs.mkdirSync(path.dirname(outfile), { recursive: true });
  fs.writeFileSync(outfile, JSON.stringify(lessons, null, 1));
  const sentenceCount = lessons.reduce((count, lesson) => count + lesson.sentences.length, 0);
  const words = new Set(lessons.flatMap(lesson => lesson.sentences.flatMap(sentence => sentence.words)));
  console.log(`Exported ${lessons.length} lessons, ${sentenceCount} sentences, ${words.size} unique words to ${outfile}`);
})();
