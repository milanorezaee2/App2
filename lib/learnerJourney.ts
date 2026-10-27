import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const JOURNEY_LANGUAGES = ['en', 'de', 'tr'] as const;
export type JourneyLanguage = typeof JOURNEY_LANGUAGES[number];
export const FAMILIARITIES = [
  { id: 'new', title: 'از صفر شروع می‌کنم', description: 'هنوز جمله‌های ساده را نمی‌سازم.' },
  { id: 'basic', title: 'کمی بلدم', description: 'واژه‌ها و معرفی‌های ساده را می‌فهمم.' },
  { id: 'everyday', title: 'در موقعیت‌های روزمره ارتباط می‌گیرم', description: 'خرید، مسیر و گفت‌وگوهای کوتاه را انجام می‌دهم.' },
  { id: 'confident', title: 'گفت‌وگو می‌کنم؛ می‌خواهم روان‌تر شوم', description: 'می‌خواهم تجربه و نظرم را روشن‌تر بیان کنم.' },
  { id: 'fluent', title: 'آشنایی زیادی دارم', description: 'می‌خواهم از بالاترین مسیر موجود شروع کنم.' },
] as const;
export type Familiarity = typeof FAMILIARITIES[number]['id'];
export const JOURNEY_GOALS = [
  { id: 'daily', title: 'زندگی و گفت‌وگوی روزمره', description: 'ارتباط راحت‌تر در موقعیت‌های معمول.' },
  { id: 'travel', title: 'سفر و زندگی در محیط تازه', description: 'نیازهای کاربردی، آشنایی و رفت‌وآمد.' },
  { id: 'work', title: 'کار و ارتباط حرفه‌ای', description: 'تمرین منظم برای ارتباط روشن‌تر.' },
] as const;
export type JourneyGoal = typeof JOURNEY_GOALS[number]['id'];
export interface JourneyPath { familiarity: Familiarity; goal: JourneyGoal }
export interface LearnerJourney {
  schemaVersion: 1;
  userId: string;
  language: JourneyLanguage;
  paths: Partial<Record<JourneyLanguage, JourneyPath>>;
  updatedAt: string;
}

export const journeyKey = (userId: string) => `learner_journey_v1:${encodeURIComponent(userId)}`;
export async function readJourneyStorage(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') throw Error('ذخیره‌سازی دستگاه هنوز آماده نیست.');
    return window.localStorage.getItem(key);
  }
  return AsyncStorage.getItem(key);
}

export function isJourneyLanguage(value: unknown): value is JourneyLanguage {
  return JOURNEY_LANGUAGES.some(id => id === value);
}
export function parseLearnerJourney(raw: string | null, userId: string): LearnerJourney | null {
  if (raw === null) return null;
  const p = JSON.parse(raw) as LearnerJourney;
  if (!p || p.schemaVersion !== 1 || p.userId !== userId || !isJourneyLanguage(p.language)
    || !p.paths || typeof p.paths !== 'object' || Array.isArray(p.paths)
    || typeof p.updatedAt !== 'string' || !Number.isFinite(Date.parse(p.updatedAt))) throw Error('انتخاب‌های ذخیره‌شده خوانده نشدند؛ سابقهٔ درس‌ها تغییر نکرده است.');
  for (const [language, path] of Object.entries(p.paths)) {
    if (!isJourneyLanguage(language) || !path || !FAMILIARITIES.some(item => item.id === path.familiarity)
      || !JOURNEY_GOALS.some(item => item.id === path.goal)) throw Error('انتخاب‌های ذخیره‌شده معتبر نیستند.');
  }
  if (!p.paths[p.language]) throw Error('مسیر انتخابی ذخیره نشده است.');
  return p;
}
export async function loadLearnerJourney(userId: string) {
  if (!userId) throw Error('ابتدا وارد حساب شوید.');
  return parseLearnerJourney(await readJourneyStorage(journeyKey(userId)), userId);
}
export async function saveLearnerJourney(profile: LearnerJourney): Promise<void> {
  if (!profile.userId) throw Error('ابتدا وارد حساب شوید.');
  const raw = JSON.stringify(profile);
  parseLearnerJourney(raw, profile.userId);
  // Only this account's preferences are written. Never touch course evidence.
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') throw Error('ذخیره‌سازی دستگاه هنوز آماده نیست.');
    window.localStorage.setItem(journeyKey(profile.userId), raw);
  } else await AsyncStorage.setItem(journeyKey(profile.userId), raw);
}

/** Every learner enters the existing introductory level; old preferences are compatible. */
export function suggestedLevel(_language: JourneyLanguage, _familiarity: Familiarity): number {
  return 0;
}
export const journeyLibrary = (language: JourneyLanguage) => language === 'en' ? '/lang/library' : `/learn/${language}/library`;
