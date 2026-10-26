import { Redirect, useLocalSearchParams } from 'expo-router';
import { CoursePage } from '@/components/LanguageCourseUI';
import GermanSentenceHome from '@/components/GermanSentenceHome';
import { useLearnerLanguageAccess } from '@/components/LearnerLanguageAccess';
import RussianHome from '@/components/RussianHome';
import TurkishHome from '@/components/TurkishHome';
import { FEATURES } from '@/lib/features';

export default function LearningHomeRoute() {
  const { language } = useLocalSearchParams<{ language: string }>();
  const { isLanguageAllowed } = useLearnerLanguageAccess();

  if (language === 'en') {
    return FEATURES.englishCourse && isLanguageAllowed('en')
      ? <Redirect href={'/lang' as never} />
      : <Redirect href={'/languages' as never} />;
  }
  if (language === 'de') {
    return FEATURES.germanCourse && isLanguageAllowed('de')
      ? <GermanSentenceHome />
      : <Redirect href={'/languages' as never} />;
  }
  if (language === 'ru') {
    return FEATURES.russianCourse && isLanguageAllowed('ru')
      ? <RussianHome />
      : <Redirect href={'/languages' as never} />;
  }
  if (language === 'tr') {
    return FEATURES.turkishCourse && isLanguageAllowed('tr')
      ? <TurkishHome />
      : <Redirect href={'/languages' as never} />;
  }
  return <CoursePage title="این مسیر آموزشی پیدا نشد">{null}</CoursePage>;
}
