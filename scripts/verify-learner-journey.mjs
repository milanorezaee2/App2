#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const root = new URL('../', import.meta.url).pathname;
const state = { platform: 'android', values: new Map(), writes: [], failRead: false, failWrite: false };
globalThis.__journeyTest = state;
const storage = {
  getItem(key) { if (state.failRead) throw Error('storage unavailable'); return state.values.get(key) ?? null; },
  setItem(key, value) { if (state.failWrite) throw Error('disk full'); state.writes.push(key); state.values.set(key, value); },
};
globalThis.window = { localStorage: storage };
const bundle = await build({
  stdin: { contents: `export * from './lib/learnerJourney'; export * from './lib/learnerProgressSummary';
    export { SENTENCE_LESSONS as EN, COURSE_LEVELS as EN_LEVELS } from './lib/courseContent';
    export { GERMAN_SENTENCE_LESSONS as DE } from './lib/languages/germanSentenceCourse';
    export { TURKISH_LESSONS as TR } from './lib/languages/turkish';`, resolveDir: root, loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent',
  plugins: [{ name: 'read-only-journey-storage', setup(b) {
    b.onResolve({ filter: /^(react-native|expo-constants|@react-native-async-storage\/async-storage)$|(?:^|\/)supabase$/ }, args => ({ path: args.path, namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, args => ({ contents: args.path === 'react-native'
      ? 'export const Platform={get OS(){return globalThis.__journeyTest.platform}};'
      : args.path === 'expo-constants' ? 'export default {expoConfig:{extra:{}}};'
      : args.path.includes('async-storage')
        ? `export default { async getItem(k){const s=globalThis.__journeyTest;if(s.failRead)throw Error('unavailable');return s.values.get(k)??null}, async setItem(k,v){const s=globalThis.__journeyTest;if(s.failWrite)throw Error('disk full');s.writes.push(k);s.values.set(k,v)} };`
        : `export const supabase=new Proxy({}, {get(){throw Error('Read-only report must not contact Supabase')}});`, loader: 'js' }));
  } }],
});
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('PASS', name); };
const expectReject = async (name, fn) => { await assert.rejects(fn); passed++; console.log('PASS', name); };
const profile = (userId, language = 'en') => ({ schemaVersion: 1, userId, language,
  paths: { [language]: { familiarity: 'everyday', goal: 'daily' } }, updatedAt: new Date().toISOString() });
check('new account has no preferences', () => assert.equal(api.parseLearnerJourney(null, 'A'), null));
await api.saveLearnerJourney(profile('A'));
await api.saveLearnerJourney(profile('B', 'tr'));
check('account-specific preferences never cross accounts', () => {
  assert.equal(api.parseLearnerJourney(state.values.get(api.journeyKey('A')), 'A').language, 'en');
  assert.equal(api.parseLearnerJourney(state.values.get(api.journeyKey('B')), 'B').language, 'tr');
  assert.throws(() => api.parseLearnerJourney(state.values.get(api.journeyKey('A')), 'B'));
});
check('invalid schemas, language, level, goal, dates and missing path rejected', () => {
  for (const bad of [{ schemaVersion: 2 }, { language: 'ru' }, { paths: {} }, { updatedAt: 'bad' },
    { paths: { en: { familiarity: 'expert', goal: 'daily' } } }, { paths: { en: { familiarity: 'new', goal: 'unknown' } } }]) {
    assert.throws(() => api.parseLearnerJourney(JSON.stringify({ ...profile('A'), ...bad }), 'A'));
  }
});
check('every old/new self-assessment now starts at level zero', () => {
  for (const language of api.JOURNEY_LANGUAGES) for (const item of api.FAMILIARITIES) {
    const id = api.suggestedLevel(language, item.id);
    assert.equal(id,0,'old and new preferences always start in the existing introductory level');
  }
});
state.failWrite = true;
await expectReject('failed preference save is not accepted', () => api.saveLearnerJourney(profile('C')));
state.failWrite = false;
check('failed save did not create account preferences', () => assert(!state.values.has(api.journeyKey('C'))));
state.platform = 'web';
await api.saveLearnerJourney(profile('web/account'));
check('web and native use account-scoped keys', () => assert.equal(state.writes.at(-1), 'learner_journey_v1:web%2Faccount'));
state.platform = 'android';
const first = api.EN[0];
const second = api.EN[1];
const today = new Date();
const day = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
const saved = { completedLessonIds: [first.id, first.id, 'retired-lesson'], reviewCards: [
  { lessonId: first.id, sentenceId: first.sentences[0].id, dueAt: '2020-01-01' },
  { lessonId: first.id, sentenceId: first.sentences[0].id, dueAt: '2020-01-01' },
  { lessonId: second.id, sentenceId: second.sentences[0].id, dueAt: '2099-01-01' },
  { lessonId: 'retired-lesson', sentenceId: 'old', dueAt: '2020-01-01' },
], currentStreak: 8, longestStreak: 12, lastActiveDate: '2020-01-01', updatedAt: '2020-01-01', totalMinutes: 80 };
const summary = api.summarizeJourneyProgress(JSON.stringify(saved), api.EN, api.EN_LEVELS);
check('completion counts unique existing lessons, not self-assessment', () => {
  assert.equal(summary.completed, 1); assert.equal(summary.total, api.EN.length);
  assert.equal(summary.coveredSentences, first.sentences.length);
});
check('review due dates, duplicate and retired cards handled', () => { assert.equal(summary.reviewCards, 2); assert.equal(summary.dueReviews, 1); });
check('stale streak is not presented as active', () => { assert.equal(summary.currentStreak, 0); assert.equal(summary.longestStreak, 12); });
check('per-level counts derive from actual curriculum', () => {
  assert.equal(summary.levels.reduce((sum, level) => sum + level.total, 0), api.EN.length);
  assert.equal(summary.levels.reduce((sum, level) => sum + level.completed, 0), 1);
});
check('malformed existing data is never silently zeroed', () => {
  for (const raw of ['{', 'null', '{}', '{"completedLessonIds":[3]}', JSON.stringify({ ...saved, totalMinutes: -1 }), JSON.stringify({ ...saved, reviewCards: [{}] })]) {
    assert.throws(() => api.summarizeJourneyProgress(raw, api.EN, api.EN_LEVELS));
  }
});
const writesBefore = state.writes.length;
for (const language of api.JOURNEY_LANGUAGES) {
  const report = await api.loadJourneyReport(language);
  check(`fresh ${language} report reads actual course without writing`, () => {
    assert.equal(report.error, null); assert.equal(report.data.completed, 0);
    assert.equal(report.data.total, api[language.toUpperCase()].length); assert.equal(report.data.inProgress, 0);
  });
}
state.values.set('sentence_course_progress_v1', JSON.stringify(saved));
state.values.set('english_study_state_v1', JSON.stringify({ version: 1, days: { [day]: 90000, '2020-01-02': 120000 },
  sessions: { [first.id]: { stage: 1, sentenceIndex: 0, revealed: false, evidencePassed: false }, [second.id]: { stage: 1, sentenceIndex: 0, revealed: false, evidencePassed: false } }, lessonEvidence: {} }));
state.values.set(`german_sentence_session_v1:${api.DE[0].id}`, JSON.stringify({ schemaVersion: 1, lessonId: api.DE[0].id, stage: 1, index: 0, updatedAt: today.toISOString() }));
state.values.set('turkish_lesson_sessions_v1', JSON.stringify({ schema: 1, sessions: { [api.TR[0].id]: { stage: 2, sentenceIndex: 0, answers: {}, revealed: false, showCheckAnswers: false } } }));
const snapshot = JSON.stringify([...state.values]);
const [en, de, tr] = await Promise.all(api.JOURNEY_LANGUAGES.map(api.loadJourneyReport));
check('measured time is distinct from historical estimated minutes', () => { assert.equal(en.data.measuredMinutes, 3.5); assert.equal(en.data.todayMeasuredMinutes, 1.5); assert.equal(en.data.legacyMinutes, 80); });
check('sessions exclude completed lessons and languages stay independent', () => { assert.equal(en.data.inProgress, 1); assert.equal(de.data.inProgress, 1); assert.equal(tr.data.inProgress, 1); assert.equal(de.data.measuredMinutes, null); assert.equal(tr.data.measuredMinutes, null); });
check('reporting never mutates or synchronizes learning data', () => { assert.equal(state.writes.length, writesBefore); assert.equal(JSON.stringify([...state.values]), snapshot); });
state.values.set('english_study_state_v1', '{broken');
const partial = await api.loadJourneyReport('en');
check('bad session data retains known progress, marks unknown time/session count', () => { assert.equal(partial.data.completed, 1); assert.equal(partial.data.inProgress, null); assert.equal(partial.data.measuredMinutes, null); assert(partial.data.warnings.length); });
state.values.set('sentence_course_progress_tr_v1', '{broken');
const corrupt = await api.loadJourneyReport('tr');
check('corrupt language is reported as an error, not zero progress', () => { assert.equal(corrupt.data, null); assert(corrupt.error); });
state.failRead = true;
const failed = await api.loadJourneyReport('de');
check('unavailable storage is not a fresh learner', () => { assert.equal(failed.data, null); assert(failed.error); });
state.failRead = false;
const read = path => readFileSync(`${root}${path}`, 'utf8');
check('onboarding protects authenticated app only; home and OAuth land on journey', () => {
  assert.match(read('components/LearnerJourneyGate.tsx'), /MANAGEMENT_BUILD \|\| !FEATURES\.learnerLogin/);
  assert.match(read('app/_layout.tsx'), /<LearnerLanguageAccessProvider navigationReady=\{stackMounted\.current\}>\s*<LearnerJourneyGate>/);
  assert.match(read('app/_layout.tsx'), /startupRouteLocked\.current = false;\s*stackMounted\.current = true;\s*setNavigatorMounted\(count => count \+ 1\)/, 'every authenticated navigator remount returns to the dashboard');
  for (const path of ['app/_layout.tsx', 'app/index.tsx', 'app/auth/callback.tsx']) assert.match(read(path), /FEATURES\.learnerLogin \? ['"]\/journey['"] : ['"]\/languages['"]/);
});
check('setup honors available languages and never calls completion APIs', () => {
  assert.match(read('components/LearnerSetup.tsx'), /access\.allowedLanguages/);
  for (const path of ['lib/learnerJourney.ts', 'lib/learnerProgressSummary.ts', 'components/LearnerSetup.tsx', 'components/LearnerJourneyGate.tsx', 'app/journey.tsx']) {
    assert.doesNotMatch(read(path), /markLessonComplete|completeLesson\(|resetProgress|clearAllProgress/);
  }
});
console.log(`Learner onboarding and read-only progress: ${passed} checks passed.`);
