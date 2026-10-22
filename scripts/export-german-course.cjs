#!/usr/bin/env node
/**
 * Dev helper: dump the German course text (sentences + vocabulary words) so the
 * audio generator can synthesize an in-app German voice pack.
 *
 *   node scripts/export-german-course.cjs [output.json]
 */
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');
const outfile = process.argv[2] || path.join(root, 'node_modules/.cache/german-course-text.json');

(async () => {
  const esbuild = require('esbuild');
  const bundle = path.join(root, 'node_modules/.cache/german-course-export.cjs');
  await esbuild.build({
    stdin: { contents: "export * from './lib/languages/germanSentenceCourse';", resolveDir: root },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: bundle,
    logLevel: 'silent',
  });
  const course = require(bundle);
  const lessons = course.GERMAN_SENTENCE_LESSONS.map(lesson => ({
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
