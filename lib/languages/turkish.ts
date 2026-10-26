import type { LearningLesson } from './types';
import { createCourseProgressStore } from '../createCourseProgressStore';
import { TURKISH_FOUNDATION_LESSONS } from './turkishFoundationLessons';
import { TURKISH_SURVIVAL_LESSONS } from './turkishSurvivalLessons';
import { TURKISH_EVERYDAY_LESSONS } from './turkishEverydayLessons';
import { TURKISH_COMMUNICATION_LESSONS } from './turkishCommunicationLessons';

/**
 * دورهٔ ترکی استانبولی برای فارسی‌زبان‌ها — نسخهٔ دوم Milo.
 *
 * همان اصول دورهٔ روسی و آلمانی: جمله‌محور، از پرکاربردترین جمله‌ها شروع
 * می‌کند و واژه را در بافت می‌آموزد. تفاوت اصلی زبان ترکی «چسبندگی پسوندها»
 * است؛ هر جمله با یک الگوی کوتاه همراه است تا زبان‌آموز ببیند کدام پسوند
 * کجا می‌نشیند. تلفظ تقریبی فارسی برای هر جمله نوشته شده و صدا با لوکال
 * tr-TR خوانده می‌شود.
 */

export const TURKISH_LESSON_STAGES = [
  { id: 'situation', labelFa: 'موقعیت', labelEn: 'Situation' },
  { id: 'core-sentences', labelFa: 'جمله‌های اصلی', labelEn: 'Core Sentences' },
  { id: 'listening', labelFa: 'شنیدن', labelEn: 'Listening' },
  { id: 'shadowing', labelFa: 'سایه‌خوانی', labelEn: 'Shadowing' },
  { id: 'sentence-building', labelFa: 'ساخت جمله', labelEn: 'Sentence Building' },
  { id: 'vocabulary', labelFa: 'واژگان از جمله', labelEn: 'Vocabulary From Sentences' },
  { id: 'grammar-through-usage', labelFa: 'دستور در کاربرد', labelEn: 'Grammar Through Usage' },
  { id: 'conversation', labelFa: 'مکالمه', labelEn: 'Conversation Practice' },
  { id: 'review', labelFa: 'مرور هوشمند', labelEn: 'Spaced Review' },
] as const;

/** حروف ویژهٔ الفبای ترکی که برای فارسی‌زبان تازه‌اند. */
export const TURKISH_SPECIAL_LETTERS = ['ç', 'ş', 'ğ', 'ı', 'İ', 'ö', 'ü'] as const;

export type TurkishLevelId = 0 | 1 | 2 | 3;

export interface TurkishCourseLevel {
  id: TurkishLevelId;
  title: string;
  cefr: string;
  description: string;
  color: string;
  modules: readonly string[];
  status: 'available' | 'planned';
}

export interface TurkishCourseLesson extends LearningLesson {
  levelId: TurkishLevelId;
  order: number;
  subtitle: string;
}

export const TURKISH_LEVELS: readonly TurkishCourseLevel[] = [
  {
    id: 0,
    title: 'Foundation Turkish',
    cefr: 'سطح ۱ · پایه (A1)',
    description:
      '۸ درس پایه: سلام و معرفی، ادب کلامی، عدد و قیمت، فعل «بودن»، پرسش‌های پایه، نفی و صداهای ویژهٔ ترکی.',
    color: '#C2410C',
    modules: [
      'سلام و احوال‌پرسی',
      'معرفی خود و دیگران',
      'لطفاً و ممنون: ادب کلامی',
      'اعداد، قیمت و زمان کوتاه',
      'بودن: هستم، هستی، است',
      'پرسش‌های پایه (چه، کجا، چرا)',
      'نفی و «نمی‌فهمم»',
      'صداها و هماهنگی واکه‌ها',
    ],
    status: 'available',
  },
  {
    id: 1,
    title: 'Survival Turkish',
    cefr: 'کاربرد روزمره (A1)',
    description:
      '۸ درس موقعیت‌محور: کافه، رستوران، خرید، مسیر، ساعت، تاکسی و اتوبوس، هتل و سلامت.',
    color: '#0F766E',
    modules: [
      'سفارش در کافه',
      'رستوران و سفارش غذا',
      'خرید و پرداخت',
      'آدرس و مسیر',
      'ساعت و قرار',
      'تاکسی و حمل‌ونقل',
      'هتل و اقامت',
      'سلامتی و کمک فوری',
    ],
    status: 'available',
  },
  {
    id: 2,
    title: 'Everyday Turkish',
    cefr: 'گسترش جمله‌ها (A2)',
    description:
      '۸ درس برای گفت‌وگوی واقعی: زمان حال جاری، گذشته، آینده، مقایسه، نظر، آب‌وهوا، کار و خانه.',
    color: '#1D4ED8',
    modules: [
      'حال جاری: همین حالا',
      'گذشته: دیروز چه کردی',
      'آینده: فردا چه خواهی کرد',
      'مقایسه و انتخاب',
      'نظر، علاقه و موافقت',
      'آب‌وهوا و فصل‌ها',
      'کار، درس و برنامهٔ روز',
      'خانه، خانواده و زندگی روزمره',
    ],
    status: 'available',
  },
  {
    id: 3,
    title: 'Communication Turkish',
    cefr: 'بیان مستقل (B1)',
    description:
      '۴ درس برای بیان منسجم: روایت تجربه، توصیه و خواهش، شرط و تصمیم، تلفن و قرار.',
    color: '#7C3AED',
    modules: ['روایت تجربه', 'توصیه، خواهش و اجازه', 'شرط، برنامه و تصمیم', 'تلفن، پیام و قرار'],
    status: 'available',
  },
];

const TURKISH_LESSON_META: Record<string, { levelId: TurkishLevelId; subtitle: string }> = {
  'tr-l1-hello': { levelId: 0, subtitle: 'سلام، حال‌پرسی و گفتن نام' },
  'tr-l1-introduce': { levelId: 0, subtitle: 'معرفی خود، ملیت و سن' },
  'tr-l1-courtesy': { levelId: 0, subtitle: 'لطفاً، ممنون، بله/نه و عذرخواهی' },
  'tr-l1-numbers': { levelId: 0, subtitle: 'اعداد، سفارش و قیمت' },
  'tr-l1-to-be': { levelId: 0, subtitle: 'پسوندهای هستم/هستی/است' },
  'tr-l1-questions': { levelId: 0, subtitle: 'چه، کی، کجا، چرا و کدام' },
  'tr-l1-negative': { levelId: 0, subtitle: 'نمی‌فهمم، نمی‌دانم و درخواست تکرار' },
  'tr-l1-sounds': { levelId: 0, subtitle: 'ç، ş، ğ، ı، ö، ü در جمله' },
  'tr-l2-cafe': { levelId: 1, subtitle: 'سفارش نوشیدنی و صورت‌حساب' },
  'tr-l2-restaurant': { levelId: 1, subtitle: 'منو، سفارش غذا و پرداخت' },
  'tr-l2-shopping': { levelId: 1, subtitle: 'قیمت، سایز، پرو و کارت' },
  'tr-l2-directions': { levelId: 1, subtitle: 'مترو، راست/چپ و مسیر' },
  'tr-l2-time': { levelId: 1, subtitle: 'ساعت چند است و قرار چه ساعتی' },
  'tr-l2-transport': { levelId: 1, subtitle: 'تاکسی، بلیت و پیاده شدن' },
  'tr-l2-hotel': { levelId: 1, subtitle: 'رزرو، اتاق، صبحانه و کلید' },
  'tr-l2-health': { levelId: 1, subtitle: 'درد، دارو و کمک فوری' },
  'tr-l3-present': { levelId: 2, subtitle: 'همین حالا چه می‌کنی؟' },
  'tr-l3-past': { levelId: 2, subtitle: 'دیروز چه کار کردی؟' },
  'tr-l3-future': { levelId: 2, subtitle: 'فردا چه خواهی کرد؟' },
  'tr-l3-comparisons': { levelId: 2, subtitle: 'بهتر، ارزان‌تر، زیباترین' },
  'tr-l3-opinions': { levelId: 2, subtitle: 'دوست دارم، به نظر من، موافقم' },
  'tr-l3-weather': { levelId: 2, subtitle: 'گرما، سرما، برف و فصل‌ها' },
  'tr-l3-work': { levelId: 2, subtitle: 'شغل، جلسه و مرخصی' },
  'tr-l3-home': { levelId: 2, subtitle: 'خانه، خانواده و کارهای خانه' },
  'tr-l4-experience': { levelId: 3, subtitle: 'روایت تجربه و افسوس' },
  'tr-l4-advice': { levelId: 3, subtitle: 'باید، نباید و خواهش' },
  'tr-l4-plans': { levelId: 3, subtitle: 'اگر، شرط و تصمیم مشترک' },
  'tr-l4-phone': { levelId: 3, subtitle: 'تلفن، وقت گرفتن و جابه‌جایی قرار' },
};

const TURKISH_SOURCE_LESSONS: readonly LearningLesson[] = [
  ...TURKISH_FOUNDATION_LESSONS,
  ...TURKISH_SURVIVAL_LESSONS,
  ...TURKISH_EVERYDAY_LESSONS,
  ...TURKISH_COMMUNICATION_LESSONS,
];

export const TURKISH_LESSONS: readonly TurkishCourseLesson[] = TURKISH_SOURCE_LESSONS.map((item, index) => {
  const meta = TURKISH_LESSON_META[item.id];
  return {
    ...item,
    levelId: meta?.levelId ?? 0,
    subtitle: meta?.subtitle ?? item.subtitle ?? item.goal ?? item.situation,
    order: index + 1,
    durationMinutes: item.durationMinutes || 10,
  } as TurkishCourseLesson;
});

export function findTurkishLesson(id: string | undefined): TurkishCourseLesson | undefined {
  return TURKISH_LESSONS.find(item => item.id === id);
}

export function findTurkishLevel(id: TurkishLevelId): TurkishCourseLevel {
  return TURKISH_LEVELS.find(level => level.id === id) ?? TURKISH_LEVELS[0];
}

export const TURKISH_SENTENCE_COUNT = TURKISH_LESSONS.reduce(
  (sum, lesson) => sum + lesson.sentences.length,
  0,
);

export const TURKISH_VOCABULARY_COUNT = new Set(
  TURKISH_LESSONS.flatMap(lesson =>
    lesson.sentences.flatMap(sentence => sentence.vocabulary.map(item => item.word)),
  ),
).size;

export const turkishProgress = createCourseProgressStore({
  key: 'sentence_course_progress_tr_v1',
  lessons: TURKISH_LESSONS,
  cloudSync: false,
  recordEstimatedTime: false,
  markVocabularyOnCompletion: false,
});
