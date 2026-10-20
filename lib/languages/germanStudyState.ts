import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { GERMAN_SENTENCE_LESSONS, GERMAN_SENTENCE_STAGES } from './germanSentenceCourse';

export const GERMAN_STUDY_STORAGE_KEY = 'german_lesson_study_v1';
export const GERMAN_STUDY_PAGE_SIZE = 5;

export interface GermanLessonSession {
  stage: number;
  sentenceIndex: number;
  answers: Record<string, number>;
  showCheckAnswers: boolean;
}

interface GermanStudyState {
  schema: 1;
  sessions: Record<string, GermanLessonSession>;
}

export function freshGermanLessonSession(): GermanLessonSession {
  return { stage: 0, sentenceIndex: 0, answers: {}, showCheckAnswers: false };
}

async function readRaw(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(GERMAN_STUDY_STORAGE_KEY);
  }
  return AsyncStorage.getItem(GERMAN_STUDY_STORAGE_KEY);
}

async function writeRaw(value: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.localStorage.setItem(GERMAN_STUDY_STORAGE_KEY, value);
    return;
  }
  await AsyncStorage.setItem(GERMAN_STUDY_STORAGE_KEY, value);
}

function parseState(raw: string | null): GermanStudyState {
  if (raw === null) return { schema: 1, sessions: {} };
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('دادهٔ جلسهٔ آلمانی ساختار معتبری ندارد.');
  const state = value as Partial<GermanStudyState>;
  if (state.schema !== 1 || !state.sessions || typeof state.sessions !== 'object' || Array.isArray(state.sessions)) {
    throw new Error('نسخهٔ دادهٔ جلسهٔ آلمانی شناخته‌شده نیست.');
  }
  return { schema: 1, sessions: state.sessions as Record<string, GermanLessonSession> };
}

function validIndexForStage(lessonId: string, stage: number, sentenceIndex: number): boolean {
  const lesson = GERMAN_SENTENCE_LESSONS.find(item => item.id === lessonId);
  if (!lesson) return false;
  if (stage === 2 || stage === 5) {
    return sentenceIndex < Math.ceil(lesson.sentences.length / GERMAN_STUDY_PAGE_SIZE);
  }
  if (stage === 0 || stage === 6 || stage === 7 || stage === 8) return sentenceIndex === 0;
  return sentenceIndex < lesson.sentences.length;
}

function validateSession(lessonId: string, value: unknown): GermanLessonSession {
  const lesson = GERMAN_SENTENCE_LESSONS.find(item => item.id === lessonId);
  if (!lesson || !value || typeof value !== 'object' || Array.isArray(value)) throw new Error('جلسهٔ آلمانی برای این درس معتبر نیست.');
  const session = value as Partial<GermanLessonSession>;
  if (!Number.isInteger(session.stage) || session.stage! < 0 || session.stage! >= GERMAN_SENTENCE_STAGES.length
    || !Number.isInteger(session.sentenceIndex) || session.sentenceIndex! < 0
    || !validIndexForStage(lessonId, session.stage!, session.sentenceIndex!)
    || typeof session.showCheckAnswers !== 'boolean'
    || !session.answers || typeof session.answers !== 'object' || Array.isArray(session.answers)) {
    throw new Error('وضعیت ذخیره‌شدهٔ درس آلمانی معتبر نیست؛ دادهٔ اصلی تغییر نکرده است.');
  }
  const answers: Record<string, number> = {};
  for (const [key, answer] of Object.entries(session.answers)) {
    const checkIndex = Number(key);
    if (!Number.isInteger(checkIndex) || checkIndex < 0 || checkIndex > 8 || !Number.isInteger(answer) || answer < 0 || answer > 5) {
      throw new Error('پاسخ ذخیره‌شدهٔ تمرین آلمانی معتبر نیست؛ دادهٔ اصلی تغییر نکرده است.');
    }
    answers[key] = answer;
  }
  return {
    stage: session.stage!,
    sentenceIndex: session.sentenceIndex!,
    answers,
    showCheckAnswers: session.showCheckAnswers,
  };
}

export async function loadGermanLessonSession(lessonId: string): Promise<GermanLessonSession> {
  if (!GERMAN_SENTENCE_LESSONS.some(item => item.id === lessonId)) throw new Error('درس آلمانی پیدا نشد.');
  const state = parseState(await readRaw());
  const saved = state.sessions[lessonId];
  return saved === undefined ? freshGermanLessonSession() : validateSession(lessonId, saved);
}

let queue: Promise<unknown> = Promise.resolve();
function serial<T>(job: () => Promise<T>): Promise<T> {
  const next = queue.then(job, job);
  queue = next.catch(() => undefined);
  return next;
}

export function saveGermanLessonSession(lessonId: string, value: GermanLessonSession): Promise<void> {
  return serial(async () => {
    const safe = validateSession(lessonId, value);
    const state = parseState(await readRaw());
    await writeRaw(JSON.stringify({ ...state, sessions: { ...state.sessions, [lessonId]: safe } }));
  });
}

export function clearGermanLessonSession(lessonId: string): Promise<void> {
  return serial(async () => {
    if (!GERMAN_SENTENCE_LESSONS.some(item => item.id === lessonId)) throw new Error('درس آلمانی پیدا نشد.');
    const state = parseState(await readRaw());
    const sessions = { ...state.sessions };
    delete sessions[lessonId];
    if (Object.keys(sessions).length) await writeRaw(JSON.stringify({ ...state, sessions }));
    else if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.localStorage.removeItem(GERMAN_STUDY_STORAGE_KEY);
    } else await AsyncStorage.removeItem(GERMAN_STUDY_STORAGE_KEY);
  });
}
