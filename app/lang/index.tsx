import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Speech from '@/lib/narration';
import {
  BookOpen,
  BookOpenCheck,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Cloud,
  Compass,
  Download,
  Flame,
  MessageCircle,
  Play,
  RefreshCw,
  Sparkles,
  Volume2,
} from 'lucide-react-native';
import { AppBottomNav } from '@/components/AppBottomNav';
import { EnglishPalette as Palette } from '@/components/EnglishSupplementTask';
import { EnglishLevelRail, EnglishProgressTrack, displayEnglishModuleLabel } from '@/components/EnglishUI';
import { PageNavigation } from '@/components/PageNavigation';
import { SHARED_JOURNEY_GRADIENTS } from '@/components/RussianHome';
import { COURSE_LEVELS, SENTENCE_LESSONS } from '@/lib/courseContent';
import { getCourseProgress, type CourseProgress } from '@/lib/courseProgress';
import { syncPersonalLearningData } from '@/lib/personalLearningSync';
import { Typography } from '@/lib/theme';
import { toPersianDigits } from '@/lib/format';
import { loadStudy, studyDay } from '@/lib/englishStudyState';
import { ENGLISH_ENGINE_BLUEPRINT, getEnglishLevelMetrics } from '@/lib/englishLearningEngine';
import { preloadSpeechVoices, resolveSpeechOptions } from '@/lib/speechLanguage';

const ENGLISH_RAIL_LEVELS = COURSE_LEVELS.map((level, index) => ({
  ...level,
  color: SHARED_JOURNEY_GRADIENTS[index]?.[0] ?? Palette.primary,
}));

export default function LearningHome() {
  const router = useRouter();
  const [showRoadmap, setShowRoadmap] = useState(false);
  const [measuredMinutes, setMeasuredMinutes] = useState(0);
  const [timeError, setTimeError] = useState(false);
  const [progress, setProgress] = useState<CourseProgress | null>(null);

  useFocusEffect(useCallback(() => {
    let alive = true;
    void preloadSpeechVoices();
    void loadStudy().then(state => {
      if (alive) {
        setMeasuredMinutes(Math.floor((state.days[studyDay()] ?? 0) / 6000) / 10);
        setTimeError(false);
      }
    }).catch(() => { if (alive) setTimeError(true); });
    return () => { alive = false; void Speech.stop(); };
  }, []));

  useFocusEffect(useCallback(() => {
    let alive = true;
    const refreshCourse = () => getCourseProgress().then(next => { if (alive) setProgress(next); });
    void refreshCourse();
    void syncPersonalLearningData().then(result => {
      if (result.status === 'synced') return refreshCourse();
      return undefined;
    }).catch(() => undefined);
    return () => { alive = false; };
  }, []));

  const speakEnglish = useCallback((text: string) => {
    void Speech.stop();
    void resolveSpeechOptions('en-US').then(targetVoice => {
      Speech.speak(text, { ...targetVoice, rate: 0.85 });
    });
  }, []);

  const currentLesson = SENTENCE_LESSONS.find(lesson => lesson.id === progress?.currentLessonId) ?? SENTENCE_LESSONS[0];
  const currentLevel = ENGLISH_RAIL_LEVELS.find(level => level.id === currentLesson.levelId) ?? ENGLISH_RAIL_LEVELS[0];
  const currentSentence = currentLesson.sentences[0];
  const completedIds = progress?.completedLessonIds ?? [];
  const completed = completedIds.length;
  const levelMetrics = getEnglishLevelMetrics(currentLevel.id, completedIds);
  const currentBlueprint = ENGLISH_ENGINE_BLUEPRINT.find(level => level.levelId === currentLevel.id);
  const dailyGoal = progress?.dailyGoalMinutes ?? 10;
  const dailyPct = Math.min(100, dailyGoal ? (measuredMinutes / dailyGoal) * 100 : 0);
  const levelCounts = Object.fromEntries(ENGLISH_RAIL_LEVELS.map(level => {
    const metrics = getEnglishLevelMetrics(level.id, completedIds);
    return [level.id, { completed: metrics.completedLessonCount, total: metrics.lessonCount }];
  }));
  const levelProgress = levelMetrics.lessonCount
    ? (levelMetrics.completedLessonCount / levelMetrics.lessonCount) * 100
    : 0;
  const heroGradient = SHARED_JOURNEY_GRADIENTS[currentLevel.id] ?? SHARED_JOURNEY_GRADIENTS[0];

  const openLevel = (levelId: number) => router.push({ pathname: '/lang/library', params: { level: String(levelId) } } as never);
  const openCurrentLesson = () => router.push({ pathname: '/course/lesson', params: { id: currentLesson.id } } as never);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.page}>
          <View style={styles.header}>
            <View style={styles.brandLockup}>
              <LinearGradient colors={['#6154E8', '#302A84']} style={styles.brandMark}>
                <BookOpenCheck size={20} color="#FFFFFF" strokeWidth={2.2} />
              </LinearGradient>
              <View>
                <Text style={styles.brandEyebrow}>LEARN IN CONTEXT</Text>
                <Text style={styles.headerTitle}>English Journey</Text>
              </View>
            </View>
            <PageNavigation backFallback="/languages" accentColor={Palette.primary} borderColor={Palette.border} />
          </View>

          <LinearGradient colors={heroGradient} start={{ x: .95, y: 0 }} end={{ x: .05, y: 1 }} style={styles.heroCard}>
            <View pointerEvents="none" style={styles.heroOrbLarge} />
            <View pointerEvents="none" style={styles.heroOrbSmall} />
            <View style={styles.heroTopRow}>
              <View style={styles.heroLevelBadge}>
                <View style={styles.heroBadgeDot} />
                <Text style={styles.heroLevelText}>LEVEL {currentLevel.id} · {currentLevel.cefr === 'پایه' || currentLevel.id === 0 ? 'FOUNDATION' : currentLevel.cefr}</Text>
              </View>
              <Text style={styles.heroCourseLabel}>CORE PATH</Text>
            </View>

            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>درس بعدی شما</Text>
              <Text style={styles.heroTitle}>{currentLesson.title}</Text>
              <Text style={styles.heroDescription}>{currentLesson.subtitle}</Text>
            </View>

            {currentSentence ? (
              <View style={styles.sentenceShowcase}>
                <Pressable accessibilityRole="button" accessibilityLabel={`پخش تلفظ انگلیسی: ${currentSentence.en}`} style={styles.sentenceShowcaseTop} onPress={() => speakEnglish(currentSentence.en)}>
                  <View style={styles.sentenceLabelIcon}><Volume2 size={14} color="#C8C9FF" /></View>
                  <Text style={styles.sentenceLabel}>جملهٔ کلیدی این درس</Text>
                  <Text style={styles.sentenceLabelEn}>CORE SENTENCE</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`شنیدن جمله: ${currentSentence.en}`} onPress={() => speakEnglish(currentSentence.en)}>
                  <Text style={styles.sentenceEnglish}>{currentSentence.en}</Text>
                </Pressable>
                <Text style={styles.sentencePersian}>{currentSentence.fa}</Text>
                {currentSentence.pattern ? (
                  <View style={styles.sentencePatternBox}>
                    <Text style={styles.sentencePatternLabel}>الگوی جمله‌سازی:</Text>
                    <Text style={styles.sentencePatternText}>{currentSentence.pattern}</Text>
                  </View>
                ) : null}
                {!!currentSentence.vocabulary.length && (
                  <View style={styles.wordChipRow}>
                    {currentSentence.vocabulary.map(item => (
                      <Pressable key={`${currentSentence.id}-${item.word}`} accessibilityRole="button" accessibilityLabel={`تلفظ واژه: ${item.word}`} style={styles.wordChip} onPress={() => speakEnglish(item.word)}>
                        <Text style={styles.wordChipEn}>{item.word}</Text>
                        <Text style={styles.wordChipDivider}>·</Text>
                        <Text style={styles.wordChipFa}>{item.meaning}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            ) : null}

            <View style={styles.heroActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={completed ? 'ادامه یادگیری' : 'شروع از پایه'}
                style={({ pressed }) => [styles.continueButton, pressed && styles.buttonPressed]}
                onPress={openCurrentLesson}
              >
                <Play size={16} color={Palette.primaryDark} fill={Palette.primaryDark} />
                <Text style={styles.continueButtonText}>{completed ? 'ادامه یادگیری' : 'شروع از پایه'}</Text>
                <ChevronLeft size={17} color={Palette.primaryDark} />
              </Pressable>
              <View style={styles.sentenceCount}>
                <Text style={styles.sentenceCountValue}>{toPersianDigits(currentLesson.sentences.length)}</Text>
                <Text style={styles.sentenceCountLabel}>جملهٔ همین درس</Text>
              </View>
            </View>
          </LinearGradient>

          <View style={styles.pathPanel}>
            <View style={styles.panelHeadingRow}>
              <View style={styles.panelHeadingText}>
                <Text style={styles.panelEyebrow}>THE MAIN CURRICULUM</Text>
                <Text style={styles.panelTitle}>مسیر یادگیری انگلیسی</Text>
              </View>
              <Pressable accessibilityRole="button" style={styles.libraryLink} onPress={() => router.push('/lang/library' as never)}>
                <Text style={styles.libraryLinkText}>کتابخانه</Text>
                <ChevronLeft size={16} color={Palette.primary} />
              </Pressable>
            </View>

            <View style={styles.railWrap}>
              <EnglishLevelRail activeLevelId={currentLevel.id} levels={ENGLISH_RAIL_LEVELS} counts={levelCounts} direction="rtl" onSelect={openLevel} />
            </View>

            <View style={styles.currentLevelRow}>
              <View style={styles.currentLevelCopy}>
                <Text style={styles.currentLevelEyebrow}>اکنون · سطح {toPersianDigits(currentLevel.id)}</Text>
                <Text style={styles.currentLevelName}>{currentLevel.title}</Text>
                <Text style={styles.currentLevelDescription}>{currentLevel.description}</Text>
              </View>
              <View style={[styles.levelCountBadge, { backgroundColor: `${currentLevel.color}12`, borderColor: `${currentLevel.color}38` }]}>
                <Text style={[styles.levelCountValue, { color: currentLevel.color }]}>{toPersianDigits(levelMetrics.completedLessonCount)} از {toPersianDigits(levelMetrics.lessonCount)}</Text>
                <View style={styles.levelCountMeta}>
                  <View style={[styles.levelCountDot, { backgroundColor: currentLevel.color }]} />
                  <Text style={styles.levelCountLabel}>درس تکمیل‌شده</Text>
                </View>
              </View>
            </View>
            <EnglishProgressTrack value={levelProgress} color={currentLevel.color} />

            <Pressable accessibilityRole="button" accessibilityState={{ expanded: showRoadmap }} style={styles.mapToggle} onPress={() => setShowRoadmap(value => !value)}>
              <View style={styles.mapToggleIcon}><Compass size={16} color={Palette.primary} /></View>
              <View style={styles.mapToggleText}>
                <Text style={styles.mapToggleTitle}>{showRoadmap ? 'بستن نقشهٔ کامل ۵ سطح' : 'نمایش نقشهٔ کامل ۵ سطح'}</Text>
                <Text style={styles.mapToggleMeta}>{currentBlueprint?.modules.slice(0, 3).map(displayEnglishModuleLabel).join(' · ')}</Text>
              </View>
              {showRoadmap ? <ChevronUp size={18} color={Palette.primary} /> : <ChevronDown size={18} color={Palette.primary} />}
            </Pressable>

            {showRoadmap && (
              <View style={styles.fullRoadmap}>
                {ENGLISH_RAIL_LEVELS.map(level => {
                  const metrics = getEnglishLevelMetrics(level.id, completedIds);
                  const passed = metrics.lessonCount > 0 && metrics.completedLessonCount === metrics.lessonCount;
                  return (
                    <Pressable
                      key={level.id}
                      accessibilityRole="button"
                      accessibilityLabel={`فهرست درس‌های ${level.title}`}
                      style={({ pressed }) => [styles.levelCard, level.id === currentLevel.id && styles.levelCardActive, pressed && styles.buttonPressed]}
                      onPress={() => openLevel(level.id)}
                    >
                      <View style={[styles.levelNumber, { backgroundColor: `${level.color}18` }]}>
                        {passed ? <Check size={18} color={level.color} strokeWidth={2.6} /> : <Text style={[styles.levelNumberText, { color: level.color }]}>{toPersianDigits(level.id)}</Text>}
                      </View>
                      <View style={styles.levelText}>
                        <View style={styles.levelTitleRow}>
                          <Text style={styles.levelTitle}>{level.title}</Text>
                          <Text style={[styles.levelBand, { color: level.color }]}>{level.cefr}</Text>
                        </View>
                        <Text style={styles.levelDesc} numberOfLines={2}>{level.description}</Text>
                        <Text style={styles.levelStats}>{toPersianDigits(metrics.completedLessonCount)} از {toPersianDigits(metrics.lessonCount)} درس · {toPersianDigits(metrics.sentenceCount)} جمله · {toPersianDigits(metrics.vocabularyCount)} واژهٔ یکتا</Text>
                      </View>
                      <ChevronLeft size={18} color={Palette.muted} />
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderCopy}>
              <Text style={styles.sectionEyebrow}>TODAY AT A GLANCE</Text>
              <Text style={styles.sectionTitle}>برنامهٔ امروز</Text>
            </View>
            <View style={styles.todayPill}>
              <Flame size={14} color="#C46B18" />
              <Text style={styles.todayPillText}>{toPersianDigits(dailyGoal)} دقیقه هدف روزانه</Text>
            </View>
          </View>

          <View style={styles.todayCard}>
            <View style={styles.todayCardTop}>
              <View style={styles.todayMetricCopy}>
                <Text style={styles.todayValue}>{toPersianDigits(completed)} از {toPersianDigits(SENTENCE_LESSONS.length)} <Text style={styles.todayValueUnit}>درس</Text></Text>
                <Text style={styles.todayLabel}>{timeError ? 'پیشرفت همین دستگاه؛ زمان ثبت‌شده خوانده نشد.' : `${toPersianDigits(measuredMinutes)} دقیقه مطالعهٔ ثبت‌شده امروز در همین دستگاه.`}</Text>
              </View>
              <View style={styles.todayIcon}><BookOpenCheck size={20} color={Palette.primary} /></View>
            </View>
            <View style={styles.todayProgressRow}>
              <Text style={styles.todayProgressText}>{toPersianDigits(Math.round(dailyPct))}٪</Text>
              <View style={styles.todayProgressTrack}><EnglishProgressTrack value={dailyPct} color={Palette.primary} height={9} /></View>
            </View>
            <View style={styles.todayFootnote}>
              <BookOpen size={14} color={Palette.teal} />
              <Text style={styles.todayFootnoteText}>{toPersianDigits(completed)} از {toPersianDigits(SENTENCE_LESSONS.length)} درس اصلی تکمیل‌شده{progress?.currentStreak ? ` · ${toPersianDigits(progress.currentStreak)} روز پیاپی` : ''}</Text>
            </View>
          </View>

          <View style={styles.quickRow}>
            <Pressable accessibilityRole="button" style={styles.quickCard} onPress={() => router.push('/review' as never)}>
              <View style={[styles.quickIcon, { backgroundColor: Palette.tealSoft }]}><RefreshCw size={19} color={Palette.teal} /></View>
              <View style={styles.quickCopy}>
                <Text style={styles.quickTitle}>مرور جمله‌ها</Text>
                <Text style={styles.quickDesc}>کارت‌های زمان‌بندی‌شدهٔ انگلیسی</Text>
              </View>
              <ChevronLeft size={17} color={Palette.muted} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="باز کردن کارگاه تلفظ انگلیسی"
              accessibilityHint="تمرین صداهای انگلیسی، تکیه و آهنگ جمله؛ بدون ضبط میکروفن"
              style={styles.quickCard}
              onPress={() => router.push('/learn/en/pronunciation' as never)}
            >
              <View style={[styles.quickIcon, { backgroundColor: Palette.primarySoft }]}><Volume2 size={19} color={Palette.primary} /></View>
              <View style={styles.quickCopy}>
                <Text style={styles.quickTitle}>کارگاه تلفظ انگلیسی</Text>
                <Text style={styles.quickDesc}>تمرین صداها، تکیه و آهنگ جمله؛ خودارزیابی و همگام‌سازی حساب</Text>
              </View>
              <ChevronLeft size={17} color={Palette.muted} />
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.quickCard} onPress={openCurrentLesson}>
              <View style={[styles.quickIcon, { backgroundColor: Palette.primarySoft }]}><MessageCircle size={19} color={Palette.primary} /></View>
              <View style={styles.quickCopy}>
                <Text style={styles.quickTitle}>تمرین مکالمه</Text>
                <Text style={styles.quickDesc}>گفت‌وگوی همین درس</Text>
              </View>
              <ChevronLeft size={17} color={Palette.muted} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="سنجش آغازین انگلیسی برای انتخاب نقطهٔ شروع" style={styles.quickCard} onPress={() => router.push({ pathname: '/placement', params: { language: 'en' } } as never)}>
              <View style={[styles.quickIcon, { backgroundColor: Palette.primarySoft }]}><Compass size={19} color={Palette.primary} /></View>
              <View style={styles.quickCopy}>
                <Text style={styles.quickTitle}>پیداکردن نقطهٔ شروع</Text>
                <Text style={styles.quickDesc}>سنجش کوتاه و اختیاری برای انتخاب سطح انگلیسی</Text>
              </View>
              <ChevronLeft size={17} color={Palette.muted} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="پشتیبان‌گیری محلی از پیشرفت انگلیسی" style={styles.quickCard} onPress={() => router.push('/lang/backup' as never)}>
              <View style={[styles.quickIcon, { backgroundColor: Palette.warningSoft }]}><Download size={19} color={Palette.warning} /></View>
              <View style={styles.quickCopy}>
                <Text style={styles.quickTitle}>پشتیبان پیشرفت</Text>
                <Text style={styles.quickDesc}>ذخیره و بازیابی امن سابقهٔ محلی انگلیسی</Text>
              </View>
              <ChevronLeft size={17} color={Palette.muted} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="ورود ایمیلی و همگام‌سازی شخصی" style={styles.quickCard} onPress={() => router.push('/personal-sync' as never)}>
              <View style={[styles.quickIcon, { backgroundColor: Palette.primarySoft }]}><Cloud size={19} color={Palette.primary} /></View>
              <View style={styles.quickCopy}>
                <Text style={styles.quickTitle}>حساب و همگام‌سازی</Text>
                <Text style={styles.quickDesc}>پیشرفت و تلفظ هر دو زبان میان دستگاه‌ها</Text>
              </View>
              <ChevronLeft size={17} color={Palette.muted} />
            </Pressable>
          </View>

          <View style={styles.tipCard}>
            <View style={styles.tipIcon}><Sparkles size={17} color="#D07A1E" /></View>
            <View style={styles.tipCopy}>
              <Text style={styles.tipTitle}>یادگیری در بافت جمله</Text>
              <Text style={styles.tipText}>هر واژه را همراه تلفظ، الگوی جمله‌سازی و موقعیت واقعی‌اش می‌آموزی؛ نه جدا از کاربردش.</Text>
            </View>
          </View>
        </View>
      </ScrollView>
      <AppBottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, direction: 'ltr', backgroundColor: Palette.canvas },
  scrollContent: { flexGrow: 1 },
  page: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 26, gap: 18 },
  header: { minHeight: 56, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  headerEnd: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandLockup: { flexDirection: 'row-reverse', alignItems: 'center', gap: 11 },
  brandMark: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  brandEyebrow: { fontFamily: 'Inter-ExtraBold', color: Palette.primary, fontSize: 7, fontWeight: '800', letterSpacing: 1.2, textAlign: 'right', writingDirection: 'ltr' },
  headerTitle: { fontFamily: Typography.latinFontFamily, fontSize: 18, lineHeight: 27, fontWeight: '800', color: Palette.ink, textAlign: 'right', writingDirection: 'ltr' },
  headerChip: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, borderColor: '#CFEEE6', backgroundColor: Palette.tealSoft, paddingHorizontal: 10, paddingVertical: 7 },
  headerChipText: { fontFamily: Typography.fontFamily, color: Palette.teal, fontSize: 10, fontWeight: '400', writingDirection: 'rtl' },
  heroCard: { position: 'relative', overflow: 'hidden', borderRadius: 27, padding: 20, gap: 14, shadowColor: '#27246B', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  heroOrbLarge: { position: 'absolute', top: -76, left: -42, width: 210, height: 210, borderRadius: 105, backgroundColor: 'rgba(141, 144, 255, 0.13)' },
  heroOrbSmall: { position: 'absolute', top: 128, left: 92, width: 76, height: 76, borderRadius: 38, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  heroTopRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  heroLevelBadge: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.13)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 11, paddingVertical: 7 },
  heroBadgeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#A4F3D5' },
  heroLevelText: { fontFamily: 'Inter-ExtraBold', color: '#FFFFFF', fontSize: 7, fontWeight: '800', letterSpacing: .35, writingDirection: 'ltr' },
  heroCourseLabel: { fontFamily: 'Inter-ExtraBold', color: '#C5C9FF', fontSize: 7, fontWeight: '800', letterSpacing: 1.3, writingDirection: 'ltr' },
  heroCopy: { gap: 2, paddingTop: 2 },
  heroEyebrow: { fontFamily: Typography.fontFamily, color: '#C6C8FF', fontSize: 12, fontWeight: '400', textAlign: 'right', writingDirection: 'rtl' },
  heroTitle: { fontFamily: Typography.fontFamily, color: '#FFFFFF', fontSize: 27, lineHeight: 39, fontWeight: '400', textAlign: 'right', writingDirection: 'rtl' },
  heroDescription: { fontFamily: Typography.fontFamily, color: 'rgba(255,255,255,0.78)', fontSize: 12, lineHeight: 21, fontWeight: '400', textAlign: 'right', writingDirection: 'rtl' },
  sentenceShowcase: { borderRadius: 19, padding: 15, gap: 8, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  sentenceShowcaseTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7 },
  sentenceLabelIcon: { width: 25, height: 25, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  sentenceLabel: { fontFamily: Typography.fontFamily, color: '#FFFFFF', fontSize: 11, fontWeight: '400', writingDirection: 'rtl' },
  sentenceLabelEn: { fontFamily: 'Inter-ExtraBold', marginRight: 'auto', color: '#CFD2FF', fontSize: 6, fontWeight: '800', letterSpacing: 1, writingDirection: 'ltr' },
  sentenceEnglish: { fontFamily: 'Inter-ExtraBold', color: '#FFFFFF', fontSize: 18, lineHeight: 30, fontWeight: '800', textAlign: 'right', writingDirection: 'ltr' },
  sentencePersian: { fontFamily: Typography.fontFamily, color: 'rgba(255,255,255,0.82)', fontSize: 12, lineHeight: 20, fontWeight: '400', textAlign: 'right', writingDirection: 'rtl' },
  sentencePatternBox: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: 5, paddingTop: 7, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.16)' },
  sentencePatternLabel: { fontFamily: Typography.fontFamily, color: '#A4F3D5', fontSize: 10, fontWeight: '400', writingDirection: 'rtl' },
  sentencePatternText: { flex: 1, fontFamily: Typography.fontFamily, color: '#FFFFFF', fontSize: 11, lineHeight: 18, fontWeight: '400', textAlign: 'right', writingDirection: 'rtl' },
  wordChipRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  wordChip: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 9, paddingVertical: 5 },
  wordChipEn: { fontFamily: 'Inter-ExtraBold', color: '#FFFFFF', fontSize: 9, fontWeight: '800', writingDirection: 'ltr' },
  wordChipDivider: { fontFamily: Typography.fontFamily, color: '#C6C8FF', fontSize: 10, fontWeight: '400' },
  wordChipFa: { fontFamily: Typography.fontFamily, color: '#E4E6FF', fontSize: 10, fontWeight: '400', writingDirection: 'rtl' },
  heroActions: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  continueButton: { minHeight: 48, flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 15, backgroundColor: '#FFFFFF', paddingHorizontal: 13 },
  continueButtonText: { fontFamily: Typography.fontFamily, color: Palette.primaryDark, fontSize: 12, fontWeight: '400', writingDirection: 'rtl' },
  buttonPressed: { opacity: .88 },
  sentenceCount: { alignItems: 'flex-end', minWidth: 76 },
  sentenceCountValue: { fontFamily: Typography.numberFontFamily, color: '#FFFFFF', fontSize: 17, fontWeight: '400' },
  sentenceCountLabel: { fontFamily: Typography.fontFamily, color: '#D5D7FF', fontSize: 9, fontWeight: '400', writingDirection: 'rtl' },
  pathPanel: { borderRadius: 23, padding: 17, backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.border, gap: 14, shadowColor: '#21264A', shadowOpacity: .045, shadowRadius: 13, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  panelHeadingRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  panelHeadingText: { flex: 1, alignItems: 'stretch' },
  panelEyebrow: { fontFamily: 'Inter-ExtraBold', color: Palette.primary, fontSize: 6, fontWeight: '800', letterSpacing: 1.3, textAlign: 'right', writingDirection: 'ltr' },
  panelTitle: { fontFamily: Typography.fontFamily, color: Palette.ink, fontSize: 20, lineHeight: 29, fontWeight: '400', textAlign: 'right', writingDirection: 'rtl' },
  libraryLink: { minHeight: 37, flexDirection: 'row-reverse', alignItems: 'center', gap: 2, paddingHorizontal: 10, borderRadius: 12, backgroundColor: Palette.primarySoft },
  libraryLinkText: { fontFamily: Typography.fontFamily, color: Palette.primaryDark, fontSize: 11, fontWeight: '400', writingDirection: 'rtl' },
  railWrap: { paddingVertical: 2 },
  currentLevelRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 12, borderRadius: 17, backgroundColor: Palette.surfaceMuted, borderWidth: 1, borderColor: Palette.border },
  currentLevelCopy: { flex: 1, alignItems: 'stretch', gap: 2 },
  currentLevelEyebrow: { fontFamily: Typography.fontFamily, color: Palette.primary, fontSize: 9, fontWeight: '400', textAlign: 'right', writingDirection: 'rtl' },
  currentLevelName: { fontFamily: Typography.latinFontFamily, color: Palette.ink, fontSize: 13, fontWeight: '800', textAlign: 'right', writingDirection: 'ltr' },
  currentLevelDescription: { fontFamily: Typography.fontFamily, color: Palette.muted, fontSize: 10, fontWeight: '400', textAlign: 'right', writingDirection: 'rtl' },
  levelCountBadge: { alignItems: 'stretch', justifyContent: 'center', minWidth: 92, minHeight: 58, borderRadius: 18, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 6, gap: 3 },
  levelCountValue: { width: '100%', fontFamily: Typography.numberFontFamily, fontSize: 13, lineHeight: 19, fontWeight: '400', textAlign: 'right', writingDirection: 'rtl' },
  levelCountMeta: { flexDirection: 'row-reverse', alignSelf: 'stretch', alignItems: 'center', gap: 4 },
  levelCountDot: { width: 5, height: 5, borderRadius: 3 },
  levelCountLabel: { fontFamily: Typography.fontFamily, color: Palette.muted, fontSize: 8, fontWeight: '400', textAlign: 'right', writingDirection: 'rtl' },
  mapToggle: { minHeight: 51, flexDirection: 'row-reverse', alignItems: 'center', gap: 9, paddingHorizontal: 11, borderRadius: 15, backgroundColor: Palette.surfaceMuted, borderWidth: 1, borderColor: Palette.border },
  mapToggleIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.primarySoft },
  mapToggleText: { flex: 1, gap: 2 },
  mapToggleTitle: { fontFamily: Typography.fontFamily, color: Palette.ink, fontSize: 11, fontWeight: '400', textAlign: 'right', writingDirection: 'rtl' },
  mapToggleMeta: { fontFamily: Typography.fontFamily, color: Palette.muted, fontSize: 8, fontWeight: '400', textAlign: 'right', writingDirection: 'rtl' },
  fullRoadmap: { gap: 8 },
  levelCard: { minHeight: 76, flexDirection: 'row-reverse', alignItems: 'center', gap: 11, padding: 12, borderRadius: 17, backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.border },
  levelCardActive: { borderColor: Palette.primary, backgroundColor: '#F9F8FF' },
  levelNumber: { width: 39, height: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  levelNumberText: { fontFamily: Typography.numberFontFamily, fontSize: 15, fontWeight: '400', writingDirection: 'rtl' },
  levelText: { flex: 1, gap: 3 },
  levelTitleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7 },
  levelTitle: { fontFamily: Typography.latinFontFamily, flexShrink: 1, color: Palette.ink, fontSize: 10, fontWeight: '800', textAlign: 'right', writingDirection: 'ltr' },
  levelBand: { fontFamily: Typography.fontFamily, fontSize: 8, fontWeight: '400', writingDirection: 'rtl' },
  levelDesc: { fontFamily: Typography.fontFamily, color: Palette.text, fontSize: 10, fontWeight: '400', textAlign: 'right', writingDirection: 'rtl' },
  levelStats: { fontFamily: Typography.fontFamily, color: Palette.muted, fontSize: 9, fontWeight: '400', textAlign: 'right', writingDirection: 'rtl' },
  sectionHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2 },
  sectionHeaderCopy: { alignItems: 'stretch' },
  sectionEyebrow: { fontFamily: 'Inter-ExtraBold', color: Palette.primary, fontSize: 6, fontWeight: '800', letterSpacing: 1.3, textAlign: 'right', writingDirection: 'ltr' },
  sectionTitle: { fontFamily: Typography.fontFamily, color: Palette.ink, fontSize: 19, fontWeight: '400', textAlign: 'right', writingDirection: 'rtl' },
  todayPill: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, backgroundColor: Palette.warningSoft, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999 },
  todayPillText: { fontFamily: Typography.fontFamily, color: Palette.warning, fontSize: 9, fontWeight: '400', writingDirection: 'rtl' },
  todayCard: { borderRadius: 20, padding: 16, backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.border, gap: 13, shadowColor: '#20264A', shadowOpacity: .035, shadowRadius: 11, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  todayCardTop: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  todayMetricCopy: { flex: 1, alignItems: 'stretch' },
  todayValue: { fontFamily: Typography.numberFontFamily, color: Palette.ink, fontSize: 23, fontWeight: '400', textAlign: 'right', writingDirection: 'rtl' },
  todayValueUnit: { fontFamily: Typography.fontFamily, color: Palette.muted, fontSize: 12, fontWeight: '400' },
  todayLabel: { fontFamily: Typography.fontFamily, color: Palette.muted, fontSize: 10, fontWeight: '400', textAlign: 'right', writingDirection: 'rtl' },
  todayIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: Palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  todayProgressRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  todayProgressText: { fontFamily: Typography.numberFontFamily, width: 34, color: Palette.primaryDark, fontSize: 11, fontWeight: '400', textAlign: 'right', writingDirection: 'rtl' },
  todayProgressTrack: { flex: 1 },
  todayFootnote: { flexDirection: 'row-reverse', alignItems: 'center', flexWrap: 'wrap', gap: 5, paddingTop: 10, borderTopWidth: 1, borderTopColor: Palette.border },
  todayFootnoteText: { flex: 1, fontFamily: Typography.fontFamily, color: Palette.text, fontSize: 10, fontWeight: '400', textAlign: 'right', writingDirection: 'rtl' },
  quickRow: { gap: 10 },
  quickCard: { minHeight: 70, flexDirection: 'row-reverse', alignItems: 'center', gap: 11, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 18, backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.border },
  quickIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  quickCopy: { flex: 1, alignItems: 'stretch', gap: 2 },
  quickTitle: { fontFamily: Typography.fontFamily, color: Palette.ink, fontSize: 12, fontWeight: '400', textAlign: 'right', writingDirection: 'rtl' },
  quickDesc: { fontFamily: Typography.fontFamily, color: Palette.muted, fontSize: 10, fontWeight: '400', textAlign: 'right', writingDirection: 'rtl' },
  tipCard: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 17, borderWidth: 1, borderColor: '#F4DFC5', backgroundColor: '#FFF8EF' },
  tipIcon: { width: 33, height: 33, borderRadius: 11, backgroundColor: '#FFEDD4', alignItems: 'center', justifyContent: 'center' },
  tipCopy: { flex: 1, alignItems: 'stretch', gap: 2 },
  tipTitle: { fontFamily: Typography.fontFamily, color: Palette.warning, fontSize: 10, fontWeight: '400', textAlign: 'right', writingDirection: 'rtl' },
  tipText: { fontFamily: Typography.fontFamily, color: Palette.text, fontSize: 10, lineHeight: 17, fontWeight: '400', textAlign: 'right', writingDirection: 'rtl' },
});
