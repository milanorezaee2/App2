import { useLocalSearchParams } from 'expo-router';
import { CoursePage } from '@/components/LanguageCourseUI';
import GermanLesson from '@/components/GermanLesson';
import RussianLesson from '@/components/RussianLesson';
import { findGermanLesson } from '@/lib/languages/catalog';
import { findRussianLesson, type RussianCourseLesson } from '@/lib/languages/russian';
import type { GermanSentenceCourseLesson } from '@/lib/languages/germanSentenceCourse';

export default function LanguageLessonRoute() {
  const { language, id } = useLocalSearchParams<{ language: string; id: string }>();
  const lesson = language === 'de'
    ? findGermanLesson(id)
    : language === 'ru'
      ? findRussianLesson(id)
      : undefined;

  if (!lesson) {
    return <CoursePage title="درس پیدا نشد" subtitle="از صفحهٔ انتخاب زبان، یک درس معتبر باز کنید.">{null}</CoursePage>;
  }

  if (language === 'ru') {
    return <RussianLesson key={lesson.id} lesson={lesson as RussianCourseLesson} />;
  }

  return <GermanLesson key={lesson.id} lesson={lesson as GermanSentenceCourseLesson} />;
}
