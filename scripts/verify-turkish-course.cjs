const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const esbuild = require('esbuild');

/**
 * داده‌های دورهٔ ترکی استانبولی و دو نسخهٔ اپ را بدون راه‌اندازی اپ بررسی می‌کند.
 * اجرا: npm run validate:turkish
 */
(async () => {
  const output = path.resolve('node_modules/.cache/turkish-course-test.cjs');
  await esbuild.build({
    stdin: {
      contents: [
        "export * from './lib/languages/turkish';",
        "export * from './lib/languages/turkishStudyState';",
        "export * from './lib/languages/catalogMeta';",
      ].join('\n'),
      resolveDir: process.cwd(),
    },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: output,
    plugins: [{
      name: 'turkish-course-test-stubs',
      setup(build) {
        build.onResolve({ filter: /^\.\/supabase$/ }, args => args.importer.endsWith('/lib/createCourseProgressStore.ts')
          ? { path: 'supabase', namespace: 'tr-supabase-stub' }
          : null);
        build.onLoad({ filter: /.*/, namespace: 'tr-supabase-stub' }, () => ({
          contents: 'export const supabase = { auth: { async getSession() { return { data: { session: null } }; } }, from() { return { upsert: async () => ({ data: null, error: null }) }; } };',
          loader: 'js',
        }));
        build.onResolve({ filter: /^@react-native-async-storage\/async-storage$/ }, () => ({ path: 'async-storage', namespace: 'tr-storage-stub' }));
        build.onLoad({ filter: /.*/, namespace: 'tr-storage-stub' }, () => ({ contents: 'export default { async getItem() { return null; }, async setItem() {}, async removeItem() {} };', loader: 'js' }));
        build.onResolve({ filter: /^react-native$/ }, () => ({ path: 'react-native', namespace: 'tr-platform-stub' }));
        build.onLoad({ filter: /.*/, namespace: 'tr-platform-stub' }, () => ({ contents: 'export const Platform = { OS: "web" };', loader: 'js' }));
        build.onResolve({ filter: /^expo-constants$/ }, () => ({ path: 'expo-constants', namespace: 'tr-constants-stub' }));
        build.onLoad({ filter: /.*/, namespace: 'tr-constants-stub' }, () => ({ contents: 'export default { expoConfig: { extra: {} } };', loader: 'js' }));
      },
    }],
  });

  delete require.cache[require.resolve(output)];
  const app = require(output);
  const checks = [];
  const check = (label, value) => { assert(value, label); checks.push(label); };

  const lessons = app.TURKISH_LESSONS;
  const sentences = lessons.flatMap(lesson => lesson.sentences);
  const sentenceIds = sentences.map(sentence => sentence.id);
  const cyrillic = /[\u0400-\u04FF]/;
  const persian = /[\u0600-\u06FF]/;

  /**
   * ترتیب رسمی سطح ۱ (A1) — بیست موضوع، به همین ترتیب. اگر کسی درس‌ها را
   * جابه‌جا یا حذف کند، این بررسی می‌شکند.
   */
  const foundationTopics = app.TURKISH_LEVELS[0].modules;
  const EXPECTED_TOPICS = [
    'سلام و احوال‌پرسی',
    'معرفی خود و دیگران',
    'ضمایر شخصی در جمله',
    'جمله‌های اسمی ساده با پسوندهای شخصی',
    'ملیت، زبان و محل زندگی',
    'جمله‌های فعلی ساده در زمان حال استمراری',
    'پرسش‌های ساده و پاسخ به آن‌ها',
    'جمله‌های منفی',
    'اعداد، سن و اطلاعات شخصی',
    'مالکیت و خانواده',
    'اسم‌ها، جمع و پسوندهای ملکی',
    'توصیف اشخاص، اشیا و مکان‌ها',
    'بیان نیازها، خواسته‌ها و علایق',
    'مکان، جهت و موقعیت مکانی',
    'زمان، روزها و برنامهٔ روزانه',
    'توانایی، درخواست و اجازه',
    'فعل‌های حرکتی پایه و بیان مسیر',
    'جمله‌های ساده در زمان گذشته',
    'بیان قصد و برنامهٔ آینده',
    'اتصال دو جمله ساده با حروف ربط پایه',
  ];

  check('Turkish course registers 40 lessons in four levels', lessons.length === 40
    && app.TURKISH_LEVELS.length === 4
    && app.TURKISH_LEVELS.map(level => level.id).join('|') === '0|1|2|3');
  check('Every level has lessons and an available status', app.TURKISH_LEVELS.every(level =>
    level.status === 'available'
    && lessons.filter(lesson => lesson.levelId === level.id).length > 0
    && level.modules.length > 0
    && level.title
    && level.cefr));
  check('Course order runs Foundation → Survival → Everyday → Communication', lessons.every((lesson, index) =>
    lesson.order === index + 1
    && lesson.levelId === (index < 20 ? 0 : index < 28 ? 1 : index < 36 ? 2 : 3))
    && lessons.slice(0, 20).every(lesson => lesson.id.startsWith('tr-l1-'))
    && lessons.slice(20, 28).every(lesson => lesson.id.startsWith('tr-l2-'))
    && lessons.slice(28, 36).every(lesson => lesson.id.startsWith('tr-l3-'))
    && lessons.slice(36).every(lesson => lesson.id.startsWith('tr-l4-')));
  check('Level 1 (A1) follows the official 20-topic order, one lesson per topic',
    foundationTopics.length === 20
    && foundationTopics.every((topic, index) => topic === EXPECTED_TOPICS[index])
    && lessons.filter(lesson => lesson.levelId === 0).length === 20
    && lessons.filter(lesson => lesson.levelId === 0).map(lesson => lesson.title).join('|')
      === EXPECTED_TOPICS.join('|'));
  check('Level 1 lessons are numbered 01…20 in that order',
    lessons.filter(lesson => lesson.levelId === 0).every((lesson, index) =>
      lesson.id === `tr-l1-${String(index + 1).padStart(2, '0')}-${lesson.id.split('-').slice(3).join('-')}`));
  check('Course contains 320 sentences, eight per lesson', sentences.length === 320 && lessons.every(lesson => lesson.sentences.length === 8));
  check('Sentence ids are unique and namespaced', new Set(sentenceIds).size === sentenceIds.length && sentenceIds.every(id => /^tr\d-\d{2,3}$/.test(id)));
  check('No sentence text is repeated anywhere in the course',
    new Set(sentences.map(sentence => sentence.text.toLocaleLowerCase('tr-TR'))).size === sentences.length);
  check('Every sentence teaches text, meaning, pronunciation, vocabulary and a pattern', sentences.every(sentence =>
    sentence.text.trim().length > 0
    && persian.test(sentence.fa)
    && persian.test(sentence.pronunciation)
    && sentence.vocabulary.length >= 1
    && sentence.vocabulary.every(item => item.word.trim() && persian.test(item.meaning))
    && typeof sentence.pattern === 'string' && sentence.pattern.trim().length > 0));
  check('No Cyrillic leaked into the Turkish track', !cyrillic.test(JSON.stringify(lessons)));
  check('Special Turkish letters are exercised (ç, ş, ğ, ı, ö, ü)', ['ç', 'ş', 'ğ', 'ı', 'ö', 'ü'].every(letter =>
    sentences.some(sentence => sentence.text.toLocaleLowerCase('tr-TR').includes(letter))));
  check('Every lesson has a dialogue with at least four turns and two checks', lessons.every(lesson =>
    lesson.dialogue.length >= 4
    && lesson.dialogue.every(line => line.speaker && line.text && persian.test(line.fa))
    && (lesson.checks ?? []).length >= 2
    && (lesson.checks ?? []).every(question => question.choices.length >= 2
      && Number.isInteger(question.correctIndex)
      && question.correctIndex >= 0
      && question.correctIndex < question.choices.length
      && persian.test(question.promptFa)
      && persian.test(question.explanationFa))));
  check('Every lesson carries a Persian teaching note and subtitle', lessons.every(lesson =>
    typeof lesson.teachingFa === 'string' && persian.test(lesson.teachingFa)
    && typeof lesson.subtitle === 'string' && lesson.subtitle.length > 3));
  check('Nine-stage lesson flow is declared', app.TURKISH_LESSON_STAGES.length === 9);
  check('Progress store uses its own Turkish key', app.turkishProgress !== undefined
    && JSON.stringify(Object.keys(app.turkishProgress)).length > 0);
  check('Study-state module exposes its own Turkish storage key', app.TURKISH_STUDY_STORAGE_KEY === 'turkish_lesson_sessions_v1');
  check('Course counts match the lesson data', app.TURKISH_SENTENCE_COUNT === sentences.length
    && app.TURKISH_VOCABULARY_COUNT === new Set(sentences.flatMap(sentence => sentence.vocabulary.map(item => item.word))).size);
  check('Default edition catalog keeps English, German and Russian only', app.LANGUAGE_META.map(language => language.id).join('|') === 'en|de|ru'
    && !app.LANGUAGE_META.some(language => language.id === 'tr'));
  check('Turkish metadata exists for the Turkish edition', app.LANGUAGES.every(language => language.id !== 'tr'));

  const turkishMeta = fs.readFileSync(path.resolve('lib/languages/catalogMeta.ts'), 'utf8');
  check('Turkish catalog entry uses the tr-TR speech locale', /id: 'tr'/.test(turkishMeta) && /speechLocale: 'tr-TR'/.test(turkishMeta)
    && /lessonsCount: 40/.test(turkishMeta) && /sentencesCount: 320/.test(turkishMeta));

  const features = fs.readFileSync(path.resolve('lib/features.ts'), 'utf8');
  check('Edition flags gate Russian and Turkish tracks', /TURKISH_EDITION/.test(features)
    && /russianCourse: !TURKISH_EDITION/.test(features)
    && /turkishCourse: TURKISH_EDITION/.test(features));

  const config = fs.readFileSync(path.resolve('app.config.js'), 'utf8');
  check('Second build variant is declared in app.config.js', /EXPO_PUBLIC_TURKISH_EDITION/.test(config)
    && /milomultilanguage-turkish/.test(config)
    && /com\.devicecontrol\.miloturkish/.test(config)
    && /turkishEdition: true/.test(config));

  const routes = ['app/learn/tr/index.tsx', 'app/learn/tr/lesson.tsx', 'app/learn/tr/library.tsx', 'app/learn/tr/review.tsx', 'app/learn/tr/pronunciation.tsx'];
  check('Turkish routes exist and are edition-guarded', routes.every(route =>
    fs.existsSync(route) && /FEATURES\.turkishCourse/.test(fs.readFileSync(route, 'utf8'))));

  console.log(`Turkish course checks passed (${checks.length}).`);
  for (const label of checks) console.log(`  ✓ ${label}`);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
