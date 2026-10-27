import { readJourneyStorage, type JourneyLanguage } from './learnerJourney';

export interface ReportLesson { id: string; title: string; levelId: number; sentences: ReadonlyArray<{ id: string }> }
export interface ReportLevel { id: number; title: string; cefr: string }
export interface JourneyProgressSummary {
  completed: number;
  total: number;
  percent: number;
  coveredSentences: number;
  reviewCards: number;
  dueReviews: number;
  lastActiveDate: string | null;
  updatedAt: string | null;
  currentStreak: number;
  longestStreak: number;
  legacyMinutes: number;
  measuredMinutes: number | null;
  todayMeasuredMinutes: number | null;
  inProgress: number | null;
  levels: Array<ReportLevel & { completed: number; total: number }>;
  warnings: string[];
}
export interface JourneyReport { language: JourneyLanguage; data: JourneyProgressSummary | null; error: string | null }

const PROGRESS_KEYS: Record<JourneyLanguage, string> = {
  en: 'sentence_course_progress_v1', de: 'sentence_course_progress_de_v2', tr: 'sentence_course_progress_tr_v1',
};
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const nonnegative = (value: unknown): number => {
  if (value === undefined) return 0;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw Error('مقدار ثبت‌شدهٔ پیشرفت معتبر نیست.');
  return value;
};

/** Pure read model. No normalization writes, cloud calls, completion or reset APIs. */
export function summarizeJourneyProgress(raw: string | null, lessons: readonly ReportLesson[], levels: readonly ReportLevel[], now = new Date()): JourneyProgressSummary {
  const p: unknown = raw === null ? { completedLessonIds: [] } : JSON.parse(raw);
  if (!record(p) || !Array.isArray(p.completedLessonIds) || p.completedLessonIds.some(id => typeof id !== 'string')) {
    throw Error('پیشرفت ذخیره‌شده خوانده نشد؛ دادهٔ اصلی دست‌نخورده است.');
  }
  const completed = new Set(p.completedLessonIds as string[]);
  const done = lessons.filter(lesson => completed.has(lesson.id));
  if (p.reviewCards !== undefined && !Array.isArray(p.reviewCards)) throw Error('دادهٔ مرور خوانده نشد.');
  const cards = new Map<string, number>();
  for (const card of (p.reviewCards ?? []) as unknown[]) {
    if (!record(card) || typeof card.lessonId !== 'string' || typeof card.sentenceId !== 'string'
      || typeof card.dueAt !== 'string' || !Number.isFinite(Date.parse(card.dueAt))) throw Error('کارت مرور معتبر نیست.');
    const lesson = lessons.find(item => item.id === card.lessonId);
    if (lesson?.sentences.some(sentence => sentence.id === card.sentenceId)) {
      cards.set(`${card.lessonId}:${card.sentenceId}`, Date.parse(card.dueAt));
    }
  }
  for (const key of ['lastActiveDate', 'updatedAt'] as const) {
    if (p[key] !== undefined && p[key] !== null && (typeof p[key] !== 'string' || !Number.isFinite(Date.parse(p[key] as string)))) {
      throw Error('تاریخ پیشرفت معتبر نیست.');
    }
  }
  const lastActiveDate = typeof p.lastActiveDate === 'string' ? p.lastActiveDate : null;
  const today = localDay(now);
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  const savedStreak = nonnegative(p.currentStreak);
  return {
    completed: done.length, total: lessons.length,
    percent: lessons.length ? Math.round(done.length / lessons.length * 100) : 0,
    coveredSentences: done.reduce((sum, lesson) => sum + lesson.sentences.length, 0),
    reviewCards: cards.size, dueReviews: [...cards.values()].filter(due => due <= now.getTime()).length,
    lastActiveDate,
    updatedAt: typeof p.updatedAt === 'string' && Date.parse(p.updatedAt) > 0 ? p.updatedAt : null,
    // A stale persisted streak is not an active streak today.
    currentStreak: lastActiveDate === today || lastActiveDate === localDay(yesterday) ? savedStreak : 0,
    longestStreak: nonnegative(p.longestStreak), legacyMinutes: nonnegative(p.totalMinutes),
    measuredMinutes: null, todayMeasuredMinutes: null, inProgress: null, warnings: [],
    levels: levels.map(level => ({ ...level, total: lessons.filter(lesson => lesson.levelId === level.id).length,
      completed: done.filter(lesson => lesson.levelId === level.id).length })),
  };
}
const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

async function curriculum(language: JourneyLanguage): Promise<{ lessons: readonly ReportLesson[]; levels: readonly ReportLevel[] }> {
  if (language === 'en') {
    const c = await import('./courseContent'); return { lessons: c.SENTENCE_LESSONS, levels: c.COURSE_LEVELS };
  }
  if (language === 'de') {
    const c = await import('./languages/germanSentenceCourse'); return { lessons: c.GERMAN_SENTENCE_LESSONS, levels: c.GERMAN_SENTENCE_LEVELS };
  }
  const c = await import('./languages/turkish'); return { lessons: c.TURKISH_LESSONS, levels: c.TURKISH_LEVELS };
}

async function addSessionEvidence(language: JourneyLanguage, data: JourneyProgressSummary, lessons: readonly ReportLesson[], rawProgress: string | null) {
  const completed = new Set<string>(rawProgress === null ? [] : JSON.parse(rawProgress).completedLessonIds);
  let ids: string[] = [];
  if (language === 'en') {
    const { parseStudy, STUDY_KEY } = await import('./englishStudyState');
    const study = parseStudy(await readJourneyStorage(STUDY_KEY));
    ids = Object.keys(study.sessions);
    data.measuredMinutes = Object.values(study.days).reduce((sum, ms) => sum + ms, 0) / 60000;
    data.todayMeasuredMinutes = (study.days[localDay(new Date())] ?? 0) / 60000;
  } else if (language === 'de') {
    const { germanSentenceSessionKey, validGermanSentenceSession } = await import('./languages/germanSentenceSession');
    const sessions = await Promise.all(lessons.map(async lesson => {
      const raw = await readJourneyStorage(germanSentenceSessionKey(lesson.id));
      if (raw === null) return null;
      const value: unknown = JSON.parse(raw);
      if (!validGermanSentenceSession(value, lesson.id)) throw Error('جلسهٔ ذخیره‌شده معتبر نیست.');
      return lesson.id;
    }));
    ids = sessions.filter((id): id is string => id !== null);
  } else {
    const raw = await readJourneyStorage('turkish_lesson_sessions_v1');
    if (raw !== null) {
      const state: unknown = JSON.parse(raw);
      if (!record(state) || state.schema !== 1 || !record(state.sessions)) throw Error('جلسه‌های ترکی خوانده نشدند.');
      for (const [id, session] of Object.entries(state.sessions)) {
        const lesson = lessons.find(item => item.id === id);
        if (!lesson) continue;
        if (!record(session) || !Number.isInteger(session.stage) || (session.stage as number) < 0 || (session.stage as number) > 8
          || !Number.isInteger(session.sentenceIndex) || (session.sentenceIndex as number) < 0
          || (session.sentenceIndex as number) >= lesson.sentences.length) throw Error('جلسهٔ ترکی معتبر نیست.');
        ids.push(id);
      }
    }
  }
  const known = new Set(lessons.map(lesson => lesson.id));
  data.inProgress = new Set(ids.filter(id => known.has(id) && !completed.has(id))).size;
}

export async function loadJourneyReport(language: JourneyLanguage): Promise<JourneyReport> {
  try {
    const { lessons, levels } = await curriculum(language);
    const raw = await readJourneyStorage(PROGRESS_KEYS[language]);
    const data = summarizeJourneyProgress(raw, lessons, levels);
    try { await addSessionEvidence(language, data, lessons, raw); }
    catch { data.warnings.push('جلسه‌ها یا زمان مطالعه کامل خوانده نشدند. عدد نامشخص را صفر حساب نکردیم؛ دادهٔ اصلی تغییر نکرد.'); }
    return { language, data, error: null };
  } catch {
    return { language, data: null, error: 'گزارش این زبان خوانده نشد. داده‌ها پاک یا جایگزین نشده‌اند؛ دوباره تلاش کنید.' };
  }
}
