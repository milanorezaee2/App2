import type { LanguageDefinition, LanguageId } from './types';
import { TURKISH_EDITION } from '../features';

/**
 * Lightweight language catalog — zero course-data imports.
 *
 * The home screen (`app/languages.tsx`) only needs display metadata and a few
 * counts. Importing the full lesson arrays here used to pull ~7 MB of course
 * content into the startup path before the first screen could paint. The
 * counts are static constants; `lib/languages/catalog.ts` (which does load the
 * real arrays) asserts in development that they stay in sync with the data.
 */
export interface LanguageMeta extends LanguageDefinition {
  sentencesCount: number;
}

const ALL_LANGUAGE_META: readonly LanguageMeta[] = [
  {
    id: 'en',
    name: 'انگلیسی',
    nativeName: 'English',
    speechLocale: 'en-US',
    accent: '#6356d9',
    lessonsCount: 174,
    sentencesCount: 3862,
    description: 'جمله‌های کاربردی، کارگاه تلفظ، مرور و مجموعه ۵۰۴',
    status: 'available',
    home: '/lang',
  },
  {
    id: 'de',
    name: 'آلمانی',
    nativeName: 'Deutsch',
    speechLocale: 'de-DE',
    accent: '#087e75',
    lessonsCount: 95,
    sentencesCount: 4715,
    description: 'درس‌های جمله‌محور، کارگاه تلفظ و تمرین واژگان در چهار مرحله',
    status: 'available',
    home: '/learn/de',
  },
  {
    id: 'ru',
    name: 'روسی',
    nativeName: 'Русский',
    speechLocale: 'ru-RU',
    accent: '#4267a8',
    lessonsCount: 120,
    sentencesCount: 3800,
    description: '۱۲۰ درس از Foundation تا Advanced، با ۳۸۰۰ جمله و واژه‌های پیوندخورده با بافت',
    status: 'available',
    home: '/learn/ru',
  },
  {
    id: 'tr',
    name: 'ترکی استانبولی',
    nativeName: 'Türkçe',
    speechLocale: 'tr-TR',
    accent: '#C2410C',
    lessonsCount: 28,
    sentencesCount: 224,
    description: '۲۸ درس جمله‌محور از Foundation تا Communication، با ۲۲۴ جمله و الگوی پسوندها',
    status: 'available',
    home: '/learn/tr',
  },
];

/**
 * Two editions, one code base:
 *  - default edition → English, German, Russian
 *  - Turkish edition (`EXPO_PUBLIC_TURKISH_EDITION=true`) → English, German, Turkish
 * The Russian card disappears from the Turkish edition, and the Turkish card is
 * not advertised in the original edition, so the two versions stay distinct.
 */
export const LANGUAGE_META: readonly LanguageMeta[] = ALL_LANGUAGE_META.filter(
  language => (TURKISH_EDITION ? language.id !== 'ru' : language.id !== 'tr'),
);

/** Same shape as the old `LANGUAGES` export, without the extra count field. */
export const LANGUAGES: readonly LanguageDefinition[] = LANGUAGE_META.map(
  ({ sentencesCount: _sentencesCount, ...definition }) => definition,
);

export const TOTAL_LESSON_COUNT = LANGUAGE_META.reduce((sum, language) => sum + language.lessonsCount, 0);
export const TOTAL_SENTENCE_COUNT = LANGUAGE_META.reduce((sum, language) => sum + language.sentencesCount, 0);

export function findLanguageMeta(id: string | undefined): LanguageMeta | undefined {
  return LANGUAGE_META.find(language => language.id === id);
}

export type { LanguageId };
