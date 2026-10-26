import type { ComponentType } from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { CoursePage } from '@/components/LanguageCourseUI';
import { useLearnerLanguageAccess } from '@/components/LearnerLanguageAccess';
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
    if (!FEATURES.germanCourse || !isLanguageAllowed('de')) {
      return <Redirect href={'/languages' as never} />;
    }
    const GermanSentenceHome = (require('@/components/GermanSentenceHome') as { default: ComponentType }).default;
    return <GermanSentenceHome />;
  }
  if (language === 'ru') {
    if (!FEATURES.russianCourse || !isLanguageAllowed('ru')) {
      return <Redirect href={'/languages' as never} />;
    }
    const RussianHome = (require('@/components/RussianHome') as { default: ComponentType }).default;
    return <RussianHome />;
  }
  if (language === 'tr') {
    if (!FEATURES.turkishCourse || !isLanguageAllowed('tr')) {
      return <Redirect href={'/languages' as never} />;
    }
    const TurkishHome = (require('@/components/TurkishHome') as { default: ComponentType }).default;
    return <TurkishHome />;
  }
  return <CoursePage title="این مسیر آموزشی پیدا نشد">{null}</CoursePage>;
}
