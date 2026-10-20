import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
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
import { EnglishLevelRail, EnglishProgressTrack } from '@/components/EnglishUI';
import { EnglishPalette as Palette } from '@/components/EnglishSupplementTask';
import { GermanBottomNav } from '@/components/GermanBottomNav';
import { PageNavigation } from '@/components/PageNavigation';
import { SHARED_JOURNEY_GRADIENTS } from '@/components/RussianHome';
import type { CourseLevelId } from '@/lib/courseContent';
import { toPersianDigits as fa } from '@/lib/format';
import {
  GERMAN_SENTENCE_LEVELS,
  GERMAN_SENTENCE_LESSONS,
  germanSentenceLevelMetrics,
  getGermanSentenceResumeLesson,
} from '@/lib/languages/germanSentenceCourse';
import { germanProgress } from '@/lib/languages/catalog';
import { syncPersonalLearningData } from '@/lib/personalLearningSync';
import type { CourseProgress } from '@/lib/createCourseProgressStore';
import { primeGermanSpeech, probeGermanVoice, speakGerman, stopGermanSpeech, subscribeGermanVoiceStatus } from '@/lib/germanSpeech';
import { setGermanAudioLesson } from '@/lib/germanAudio';
import { germanHomeStyles as styles } from './germanHomeStyles';

const GERMAN_RAIL_LEVELS = GERMAN_SENTENCE_LEVELS.map((level, index) => ({
  ...level,
  color: SHARED_JOURNEY_GRADIENTS[index]?.[0] ?? Palette.primary,
}));

export default function GermanSentenceHome() {
  const router = useRouter();
  const [showRoadmap, setShowRoadmap] = useState(false);
  const [progress, setProgress] = useState<CourseProgress | null>(null);
  const [dueCount, setDueCount] = useState(0);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useFocusEffect(useCallback(() => {
    let alive = true;
    primeGermanSpeech();
    probeGermanVoice();
    const refreshLocal = () => Promise.all([germanProgress.getCourseProgress(), germanProgress.getDueReviewCards()])
      .then(([nextProgress, due]) => {
        if (!alive) return;
        setProgress(nextProgress);
        setDueCount(due.length);
        setError('');
      })
      .catch(() => { if (alive) setError('پیشرفت ذخیره‌شده خوانده نشد؛ درس‌ها همچنان از کتابخانه در دسترس‌اند.'); });
    void refreshLocal();
    void syncPersonalLearningData().then(result => {
      if (result.status === 'synced') return refreshLocal();
      return undefined;
    }).catch(() => undefined);
    return () => { alive = false; void stopGermanSpeech(); };
  }, [retry]));

  useEffect(() => subscribeGermanVoiceStatus(() => undefined), []);

  const playGerman = useCallback((text: string, kind: 'sentence' | 'word' = 'sentence') => {
    // The hero card always shows the resume lesson; the effect below keeps the
    // audio context pointed at that lesson's pack.
    setError('');
    speakGerman({
      text,
      kind,
      rate: 0.9,
      onError: () => setError('پخش صدای آلمانی انجام نشد؛ بلندی صدا و حالت بی‌صدا را بررسی کنید و دوباره تلاش کنید.'),
    });
  }, []);

  const completedIds = progress?.completedLessonIds ?? [];
  const completed = GERMAN_SENTENCE_LESSONS.filter(lesson => completedIds.includes(lesson.id)).length;
  const currentLesson = getGermanSentenceResumeLesson(progress?.currentLessonId, completedIds);
  const currentLevel = GERMAN_RAIL_LEVELS.find(level => level.id === currentLesson.levelId) ?? GERMAN_RAIL_LEVELS[0];
  const currentSentence = currentLesson.sentences[0];
  const currentMetrics = germanSentenceLevelMetrics(currentLevel.id);
  const currentCompleted = GERMAN_SENTENCE_LESSONS.filter(lesson => lesson.levelId === currentLevel.id && completedIds.includes(lesson.id)).length;
  const levelRows = GERMAN_RAIL_LEVELS.map(level => {
    const metrics = germanSentenceLevelMetrics(level.id);
    const done = GERMAN_SENTENCE_LESSONS.filter(lesson => lesson.levelId === level.id && completedIds.includes(lesson.id)).length;
    return { level, metrics, completed: done };
  });
  const levelCounts = Object.fromEntries(levelRows.map(row => [row.level.id, {
    completed: row.completed,
    total: row.metrics.lessonCount,
  }])) as Partial<Record<CourseLevelId, { completed: number; total: number }>>;
  const lessonCount = GERMAN_SENTENCE_LESSONS.length;
  const totalSentenceCount = GERMAN_SENTENCE_LESSONS.reduce((count, lesson) => count + lesson.sentences.length, 0);
  const uniqueWordCount = new Set(
    GERMAN_SENTENCE_LESSONS.flatMap(lesson => lesson.sentences.flatMap(sentence => sentence.vocabulary.map(item => item.word))),
  ).size;
  const progressPercent = lessonCount ? completed / lessonCount * 100 : 0;
  const isCourseComplete = lessonCount > 0 && completed === lessonCount;
  const heroGradient = SHARED_JOURNEY_GRADIENTS[currentLevel.id] ?? SHARED_JOURNEY_GRADIENTS[0];

  // The Russian home fills its core-sentence card with the first sentence's
  // pattern and vocabulary. A German first sentence often carries a single word
  // ("Hallo!"), which made the German card look empty by comparison. Fill it the
  // same way, using the current sentence first and then the lesson's own words.
  const heroPattern = currentSentence.pattern
    ?? currentLesson.sentences.find(sentence => sentence.pattern)?.pattern
    ?? '';
  const heroWords: { word: string; meaning: string }[] = [];
  const seenHeroWords = new Set<string>();
  for (const sentence of currentLesson.sentences) {
    for (const item of sentence.vocabulary) {
      const key = item.word.toLowerCase();
      if (seenHeroWords.has(key)) continue;
      seenHeroWords.add(key);
      heroWords.push({ word: item.word, meaning: item.meaning });
      if (heroWords.length === 7) break;
    }
    if (heroWords.length === 7) break;
  }

  useEffect(() => { setGermanAudioLesson(currentLesson.id); }, [currentLesson.id]);

  const openLevel = (levelId: number) => router.push(`/learn/de/library?level=${levelId}` as never);
  const openLesson = (id: string) => router.push({ pathname: '/learn/[language]/lesson', params: { language: 'de', id } } as never);

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
                <Text style={styles.headerTitle}>Deutsch Journey</Text>
              </View>
            </View>
            <PageNavigation backFallback="/languages" accentColor={Palette.primary} borderColor={Palette.border} />
          </View>

          <LinearGradient colors={heroGradient} start={{ x: 0.95, y: 0 }} end={{ x: 0.05, y: 1 }} style={styles.heroCard}>
            <View pointerEvents="none" style={styles.heroOrbLarge} />
            <View pointerEvents="none" style={styles.heroOrbSmall} />
            <View style={styles.heroTopRow}>
              <View style={styles.heroLevelBadge}>
                <View style={styles.heroBadgeDot} />
                <Text style={styles.heroLevelText}>LEVEL {currentLevel.id} · {currentLevel.cefr === 'مقدماتی' ? 'PRE-A1' : currentLevel.cefr}</Text>
              </View>
              <Text style={styles.heroCourseLabel}>CORE PATH</Text>
            </View>

            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>{isCourseComplete ? 'همهٔ درس‌های این مسیر تکمیل شده‌اند' : 'درس بعدی شما'}</Text>
              <Text style={styles.heroTitle}>{currentLesson.title}</Text>
              <Text style={styles.heroDescription}>{currentLesson.subtitle}</Text>
            </View>

            {currentSentence ? (
              <View style={styles.sentenceShowcase}>
                <Pressable accessibilityRole="button" accessibilityLabel={`پخش تلفظ آلمانی: ${currentSentence.text}`} style={styles.sentenceShowcaseTop} onPress={() => playGerman(currentSentence.text)}>
                  <View style={styles.sentenceLabelIcon}><Volume2 size={14} color="#C8C9FF" /></View>
                  <Text style={styles.sentenceLabel}>جملهٔ کلیدی این درس</Text>
                  <Text style={styles.sentenceLabelEn}>CORE SENTENCE</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`شنیدن جمله: ${currentSentence.text}`} onPress={() => playGerman(currentSentence.text)}>
                  <Text style={styles.sentenceGerman}>{currentSentence.text}</Text>
                </Pressable>
                <Text style={styles.sentencePersian}>{currentSentence.fa}</Text>
                <Text style={styles.sentencePronunciation}>{currentSentence.pronunciation}</Text>
                {heroPattern ? (
                  <View style={styles.sentencePattern}>
                    <Text style={styles.sentencePatternLabel}>الگوی جمله‌سازی:</Text>
                    <Text style={styles.sentencePatternText}>{heroPattern}</Text>
                  </View>
                ) : null}
                {!!heroWords.length && (
                  <View style={styles.wordChipRow}>
                    {heroWords.map(item => (
                      <Pressable key={`${currentSentence.id}-${item.word}`} accessibilityRole="button" accessibilityLabel={`تلفظ واژه آلمانی: ${item.word}`} style={styles.wordChip} onPress={() => playGerman(item.word, 'word')}>
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
              <Pressable accessibilityRole="button" style={({ pressed }) => [styles.continueButton, pressed && styles.buttonPressed]} onPress={() => isCourseComplete ? router.push('/learn/de/library' as never) : openLesson(currentLesson.id)}>
                <Play size={16} color={Palette.primaryDark} fill={Palette.primaryDark} />
                <Text style={styles.continueButtonText}>{isCourseComplete ? 'بازکردن کتابخانه و مرور' : completed ? 'ادامه یادگیری' : 'شروع از پایه'}</Text>
                <ChevronLeft size={17} color={Palette.primaryDark} />
              </Pressable>
              <View style={styles.sentenceCount}>
                <Text style={styles.sentenceCountValue}>{fa(currentLesson.sentences.length)}</Text>
                <Text style={styles.sentenceCountLabel}>جملهٔ همین درس</Text>
              </View>
            </View>
          </LinearGradient>

          {!!error && (
            <View style={styles.errorCard}>
              <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>
              <Pressable accessibilityRole="button" onPress={() => setRetry(value => value + 1)}><Text style={styles.retryText}>تلاش دوباره</Text></Pressable>
            </View>
          )}

          <View style={styles.pathPanel}>
            <View style={styles.panelHeadingRow}>
              <View style={styles.panelHeadingText}>
                <Text style={styles.panelEyebrow}>THE MAIN CURRICULUM</Text>
                <Text style={styles.panelTitle}>مسیر یادگیری</Text>
              </View>
              <Pressable accessibilityRole="button" style={styles.libraryLink} onPress={() => router.push('/learn/de/library' as never)}>
                <Text style={styles.libraryLinkText}>کتابخانه</Text>
                <ChevronLeft size={16} color={Palette.primary} />
              </Pressable>
            </View>

            <View style={styles.railWrap}>
              <EnglishLevelRail
                activeLevelId={currentLevel.id as CourseLevelId}
                counts={levelCounts}
                levels={GERMAN_RAIL_LEVELS.map((level, index) => ({ ...level, title: index === 0 ? 'مقدماتی' : level.cefr }))}
                startLabel="مقدماتی"
                accessibilityLabelPrefix="فهرست درس‌های"
                direction="rtl"
                accentColor={Palette.primary}
                successColor={Palette.success}
                activeLabelColor={Palette.primaryDark}
                numberOffset={1}
                onSelect={openLevel}
              />
            </View>

            <View style={styles.currentLevelRow}>
              <View style={styles.currentLevelCopy}>
                <Text style={styles.currentLevelEyebrow}>اکنون · {currentLevel.cefr}</Text>
                <Text style={styles.currentLevelName}>{currentLevel.title}</Text>
                <Text style={styles.currentLevelDescription}>{currentLevel.description}</Text>
              </View>
              <View style={[styles.levelCountBadge, { backgroundColor: `${currentLevel.color}12`, borderColor: `${currentLevel.color}38` }]}>
                <Text style={[styles.levelCountValue, { color: currentLevel.color }]}>{fa(currentCompleted)} از {fa(currentMetrics.lessonCount)}</Text>
                <View style={styles.levelCountMeta}>
                  <View style={[styles.levelCountDot, { backgroundColor: currentLevel.color }]} />
                  <Text style={styles.levelCountLabel}>درس تکمیل‌شده</Text>
                </View>
              </View>
            </View>
            <EnglishProgressTrack value={currentMetrics.lessonCount ? currentCompleted / currentMetrics.lessonCount * 100 : 0} color={currentLevel.color} trackColor={Palette.border} />

            <Pressable accessibilityRole="button" accessibilityState={{ expanded: showRoadmap }} style={styles.mapToggle} onPress={() => setShowRoadmap(value => !value)}>
              <View style={styles.mapToggleIcon}><Compass size={16} color={Palette.primary} /></View>
              <View style={styles.mapToggleText}>
                <Text style={styles.mapToggleTitle}>{showRoadmap ? 'بستن نقشهٔ کامل ۴ سطح' : 'نمایش نقشهٔ کامل ۴ سطح'}</Text>
                <Text style={styles.mapToggleMeta}>{currentLevel.modules.slice(0, 3).join(' · ')}</Text>
              </View>
              {showRoadmap ? <ChevronUp size={18} color={Palette.primary} /> : <ChevronDown size={18} color={Palette.primary} />}
            </Pressable>

            {showRoadmap ? (
              <View style={styles.fullRoadmap}>
                {levelRows.map(row => {
                  const color = row.level.color;
                  const isComplete = row.metrics.lessonCount > 0 && row.completed === row.metrics.lessonCount;
                  return (
                    <Pressable key={row.level.id} accessibilityRole="button" accessibilityLabel={`فهرست درس‌های ${row.level.cefr}`} style={({ pressed }) => [styles.levelCard, row.level.id === currentLevel.id && styles.levelCardActive, pressed && styles.buttonPressed]} onPress={() => openLevel(row.level.id)}>
                      <View style={[styles.levelNumber, { backgroundColor: `${color}18` }]}>
                        {isComplete ? <Check size={18} color={color} strokeWidth={2.6} /> : <Text style={[styles.levelNumberText, { color }]}>{fa(row.level.id)}</Text>}
                      </View>
                      <View style={styles.levelText}>
                        <View style={styles.levelTitleRow}>
                          <Text style={styles.levelTitle}>{row.level.title}</Text>
                          <Text style={[styles.levelCefr, { color }]}>{row.level.cefr}</Text>
                        </View>
                        <Text style={styles.levelDesc}>{row.level.description}</Text>
                        <Text style={styles.levelStats}>{fa(row.completed)} از {fa(row.metrics.lessonCount)} درس · {fa(row.metrics.sentenceCount)} جمله · {fa(row.metrics.vocabularyCount)} واژهٔ یکتا</Text>
                      </View>
                      <ChevronLeft size={18} color={Palette.muted} />
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>

          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderCopy}>
              <Text style={styles.sectionEyebrow}>TODAY AT A GLANCE</Text>
              <Text style={styles.sectionTitle}>برنامه امروز</Text>
            </View>
            <View style={styles.todayPill}>
              <Flame size={14} color="#C46B18" />
              <Text style={styles.todayPillText}>{fa(dueCount)} جمله برای مرور</Text>
            </View>
          </View>

          <View style={styles.todayCard}>
            <View style={styles.todayCardTop}>
              <View style={styles.todayMetricCopy}>
                <Text style={styles.todayValue}>{fa(completed)} از {fa(lessonCount)} <Text style={styles.todayValueUnit}>درس</Text></Text>
                <Text style={styles.todayLabel}>پیشرفت همین دستگاه؛ تکمیل به‌تنهایی نشانهٔ تسلط نیست.</Text>
              </View>
              <View style={styles.todayIcon}><BookOpenCheck size={20} color={Palette.primary} /></View>
            </View>
            <View style={styles.todayProgressRow}>
              <Text style={styles.todayProgressText}>{fa(Math.round(progressPercent))}٪</Text>
              <View style={styles.todayProgressTrack}><EnglishProgressTrack value={progressPercent} color={Palette.primary} trackColor={Palette.border} height={9} /></View>
            </View>
            <View style={styles.todayFootnote}>
              <BookOpen size={14} color={Palette.teal} />
              <Text style={styles.todayFootnoteText}>{fa(totalSentenceCount)} جملهٔ موجود · {fa(uniqueWordCount)} واژه/عبارت یکتا</Text>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderCopy}>
              <Text style={styles.sectionEyebrow}>PRACTICE & TOOLS</Text>
              <Text style={styles.sectionTitle}>آموزش و تمرین تکمیلی پایه</Text>
            </View>
          </View>

          <View style={styles.quickRow}>
            <Pressable accessibilityRole="button" style={styles.quickCard} onPress={() => router.push('/learn/de/review' as never)}>
              <View style={[styles.quickIcon, { backgroundColor: Palette.tealSoft }]}><RefreshCw size={19} color={Palette.teal} /></View>
              <View style={styles.quickCopy}><Text style={styles.quickTitle}>مرور امروز</Text><Text style={styles.quickDesc}>جمله‌های آلمانی با موعد مرور</Text></View>
              <ChevronLeft size={17} color={Palette.muted} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="باز کردن کارگاه تلفظ آلمانی" accessibilityHint="تمرین آواهای مهم آلمانی، تکیه و آهنگ جمله؛ بدون ضبط میکروفن" style={styles.quickCard} onPress={() => router.push('/learn/de/pronunciation' as never)}>
              <View style={[styles.quickIcon, { backgroundColor: Palette.primarySoft }]}><Volume2 size={19} color={Palette.primary} /></View>
              <View style={styles.quickCopy}><Text style={styles.quickTitle}>کارگاه تلفظ آلمانی</Text><Text style={styles.quickDesc}>تمرین آواهای آلمانی، تکیه و آهنگ جمله با لهجهٔ بومی</Text></View>
              <ChevronLeft size={17} color={Palette.muted} />
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.quickCard} onPress={() => router.push('/learn/de/workshop' as never)}>
              <View style={[styles.quickIcon, { backgroundColor: Palette.primarySoft }]}><MessageCircle size={19} color={Palette.primary} /></View>
              <View style={styles.quickCopy}><Text style={styles.quickTitle}>کارگاه مکالمه</Text><Text style={styles.quickDesc}>نوشتن و تمرین گفتاریِ خودارزیابی‌شونده</Text></View>
              <ChevronLeft size={17} color={Palette.muted} />
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.quickCard} onPress={() => router.push('/learn/de/unit?unit=de-a1-skills' as never)}>
              <View style={[styles.quickIcon, { backgroundColor: Palette.tealSoft }]}><BookOpenCheck size={19} color={Palette.teal} /></View>
              <View style={styles.quickCopy}><Text style={styles.quickTitle}>خواندن و پیام‌نویسی</Text><Text style={styles.quickDesc}>تمرین چندمهارتیِ A1</Text></View>
              <ChevronLeft size={17} color={Palette.muted} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="سنجش آغازین آلمانی برای انتخاب نقطهٔ شروع" style={styles.quickCard} onPress={() => router.push({ pathname: '/placement', params: { language: 'de' } } as never)}>
              <View style={[styles.quickIcon, { backgroundColor: Palette.primarySoft }]}><Compass size={19} color={Palette.primary} /></View>
              <View style={styles.quickCopy}><Text style={styles.quickTitle}>پیداکردن نقطهٔ شروع</Text><Text style={styles.quickDesc}>سنجش کوتاه و اختیاری برای انتخاب سطح آلمانی</Text></View>
              <ChevronLeft size={17} color={Palette.muted} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="انتخاب و آزمایش صدای آلمانی" accessibilityHint="شنیدن نمونه‌ها و انتخاب صدای آلمانی نصب‌شده روی دستگاه یا مرورگر" style={styles.quickCard} onPress={() => router.push('/learn/de/audio-check' as never)}>
              <View style={[styles.quickIcon, { backgroundColor: Palette.primarySoft }]}><Volume2 size={19} color={Palette.primary} /></View>
              <View style={styles.quickCopy}><Text style={styles.quickTitle}>صدای آلمانی</Text><Text style={styles.quickDesc}>انتخاب و آزمایش صدایی که جمله‌ها را می‌خواند</Text></View>
              <ChevronLeft size={17} color={Palette.muted} />
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.quickCard} onPress={() => router.push('/learn/de/backup' as never)}>
              <View style={[styles.quickIcon, { backgroundColor: Palette.warningSoft }]}><Download size={19} color={Palette.warning} /></View>
              <View style={styles.quickCopy}><Text style={styles.quickTitle}>پشتیبان پیشرفت</Text><Text style={styles.quickDesc}>ذخیره و بازیابی سابقهٔ همین دستگاه</Text></View>
              <ChevronLeft size={17} color={Palette.muted} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="ورود ایمیلی و همگام‌سازی شخصی" style={styles.quickCard} onPress={() => router.push('/personal-sync' as never)}>
              <View style={[styles.quickIcon, { backgroundColor: Palette.primarySoft }]}><Cloud size={19} color={Palette.primary} /></View>
              <View style={styles.quickCopy}><Text style={styles.quickTitle}>حساب و همگام‌سازی</Text><Text style={styles.quickDesc}>پیشرفت و تلفظ هر دو زبان میان دستگاه‌ها</Text></View>
              <ChevronLeft size={17} color={Palette.muted} />
            </Pressable>
          </View>

          <View style={styles.tipCard}>
            <View style={styles.tipIcon}><Sparkles size={17} color="#D07A1E" /></View>
            <View style={styles.tipCopy}>
              <Text style={styles.tipTitle}>نقشهٔ سطح‌ها، یادگیری در بافت جمله</Text>
              <Text style={styles.tipText}>نام‌گذاری سطح‌ها نقشهٔ داخلی دوره است و گواهی رسمی CEFR نیست؛ هر واژه همراه با تلفظ بومی آلمانی و جملهٔ کاربردی می‌آید.</Text>
            </View>
          </View>
          {!progress && !error ? <Text style={styles.loading}>در حال آماده‌کردن مسیر…</Text> : null}
        </View>
      </ScrollView>
      <GermanBottomNav />
    </View>
  );
}
