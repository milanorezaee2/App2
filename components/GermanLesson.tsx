import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  BookOpenCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Headphones,
  MessageCircle,
  Mic2,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Volume2,
} from 'lucide-react-native';
import { PageNavigation } from '@/components/PageNavigation';
import { LessonSituationStage } from '@/components/LessonSituation';
import { levelBadgeLabel } from '@/lib/languages/levelPresentation';
import { GermanPalette as Palette, GERMAN_LEVEL_GRADIENTS } from '@/components/germanTheme';
import { GermanSentenceBuilder } from '@/components/GermanSentenceBuilder';
import GermanDialoguePractice from '@/components/GermanDialoguePractice';
import { toPersianDigits as fa } from '@/lib/format';
import { Typography } from '@/lib/theme';
import {
  GERMAN_SENTENCE_LEVELS,
  GERMAN_SENTENCE_LESSONS,
  GERMAN_SENTENCE_STAGES,
  type GermanSentenceCourseLesson,
} from '@/lib/languages/germanSentenceCourse';
import { germanProgress } from '@/lib/languages/catalog';
import { buildGermanLessonChecks } from '@/lib/languages/germanLessonChecks';
import {
  clearGermanLessonSession,
  GERMAN_STUDY_PAGE_SIZE,
  loadGermanLessonSession,
  saveGermanLessonSession,
  type GermanLessonSession,
} from '@/lib/languages/germanStudyState';
import { setGermanAudioLesson } from '@/lib/germanAudio';
import {
  primeGermanSpeech,
  speakGerman,
  stopGermanSpeech,
  wordIndexAt,
} from '@/lib/germanSpeech';

const stages = GERMAN_SENTENCE_STAGES;
const PAGE_SIZE = GERMAN_STUDY_PAGE_SIZE;
const NORMAL_RATE = 0.9;
const SLOW_RATE = 0.55;

const UNLISTED_VOICE_MESSAGE = 'این درس صداهای آلمانی خودش را همراه دارد؛ اگر پخش نشد، اتصال صفحه را یک‌بار تازه کنید یا از بخش «صدا» در سربرگ، صدای آلمانی را بررسی کنید.';
type WordToken = { text: string; start: number };

function splitWords(text: string): WordToken[] {
  return [...text.matchAll(/\S+/g)].map(match => ({ text: match[0], start: match.index ?? 0 }));
}

function speechErrorMessage() {
  return 'پخش صدا انجام نشد. بلندی صدا و حالت بی‌صدا را بررسی کنید، یک‌بار روی دکمهٔ بلندگو بزنید و دوباره تلاش کنید؛ متن درس همچنان در دسترس است.';
}

export default function GermanLesson({ lesson }: { lesson: GermanSentenceCourseLesson }) {
  const router = useRouter();
  const level = lesson.levelId;
  const courseLevel = GERMAN_SENTENCE_LEVELS.find(item => item.id === level) ?? GERMAN_SENTENCE_LEVELS[0];
  const [stage, setStage] = useState(0);
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [showCheckAnswers, setShowCheckAnswers] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [completionError, setCompletionError] = useState('');
  const [speechError, setSpeechError] = useState('');
  const [spokenWord, setSpokenWord] = useState(-1);
  // The speaker button alternates: the first tap reads the sentence at the
  // normal (now faster) pace, the second at the slow learning pace, and so on.
  const [slowNext, setSlowNext] = useState(false);
  const [loadingRetry, setLoadingRetry] = useState(0);
  const [saveRetry, setSaveRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const completing = useRef(false);
  const hasSpoken = useRef(false);

  const current = lesson.sentences[sentenceIndex] ?? lesson.sentences[0];
  const firstSentence = lesson.sentences[0];
  const words = useMemo(() => splitWords(current?.text ?? ''), [current?.text]);
  const checks = useMemo(() => buildGermanLessonChecks(lesson), [lesson]);
  const pageCount = Math.max(1, Math.ceil(lesson.sentences.length / PAGE_SIZE));
  const pageStart = sentenceIndex * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, lesson.sentences.length);
  const pageSentences = lesson.sentences.slice(pageStart, pageEnd);
  const allChecksPassed = checks.length > 0 && checks.every((question, index) => answers[String(index)] === question.correctIndex);
  const progressPercent = Math.round(((stage + 1) / stages.length) * 100);

  const vocabulary = useMemo(() => {
    const byWord = new Map<string, { word: { word: string; meaning: string }; sentence: GermanSentenceCourseLesson['sentences'][number] }>();
    lesson.sentences.forEach(sentence => sentence.vocabulary.forEach(word => {
      if (!byWord.has(word.word)) byWord.set(word.word, { word, sentence });
    }));
    return [...byWord.values()];
  }, [lesson]);

  const pageVocabulary = useMemo(() => {
    const byWord = new Map<string, { word: { word: string; meaning: string }; sentence: GermanSentenceCourseLesson['sentences'][number] }>();
    pageSentences.forEach(sentence => sentence.vocabulary.forEach(word => {
      if (!byWord.has(word.word)) byWord.set(word.word, { word, sentence });
    }));
    return [...byWord.values()];
  }, [lesson, pageStart, pageEnd]);

  const grammarPatterns = useMemo(() => {
    const seen = new Set<string>();
    const patterns: Array<{ sentence: GermanSentenceCourseLesson['sentences'][number]; pattern: string }> = [];
    lesson.sentences.forEach(sentence => {
      if (!sentence.pattern || seen.has(sentence.pattern)) return;
      seen.add(sentence.pattern);
      patterns.push({ sentence, pattern: sentence.pattern });
    });
    return patterns;
  }, [lesson]);

  const speak = useCallback((text: string, rate = NORMAL_RATE, kind: 'sentence' | 'word' = 'sentence') => {
    setSpeechError('');
    setSpokenWord(-1);
    speakGerman({
      text,
      kind,
      rate,
      onStart: () => { hasSpoken.current = true; },
      onBoundary: charIndex => setSpokenWord(wordIndexAt(text, charIndex)),
      onDone: () => setSpokenWord(-1),
      onError: () => {
        setSpokenWord(-1);
        setSpeechError(speechErrorMessage());
      },
    });
  }, []);

  // Auto-play paths stay quiet when the browser blocks autoplay or no German
  // voice exists; the learner sees the explicit warning instead of a red error.
  const autoSpeak = useCallback((text: string, rate = NORMAL_RATE, kind: 'sentence' | 'word' = 'sentence') => {
    speakGerman({
      text,
      kind,
      rate,
      onStart: () => { hasSpoken.current = true; },
    });
  }, []);

  useEffect(() => {
    let alive = true;
    completing.current = false;
    setSessionReady(false);
    setSessionError('');
    setCompletionError('');
    setGermanAudioLesson(lesson.id);
    primeGermanSpeech();
    void loadGermanLessonSession(lesson.id).then(saved => {
      if (!alive) return;
      setStage(saved.stage);
      setSentenceIndex(saved.sentenceIndex);
      setAnswers(saved.answers);
      setShowCheckAnswers(saved.showCheckAnswers);
      setSessionReady(true);
    }).catch(() => {
      if (alive) setSessionError('جلسهٔ قبلی خوانده نشد؛ برای حفظ اطلاعات، ذخیره متوقف است. دوباره تلاش کنید.');
    });
    return () => { alive = false; void stopGermanSpeech(); };
  }, [lesson.id, loadingRetry]);

  useEffect(() => {
    if (!sessionReady || completing.current) return;
    const nextSession: GermanLessonSession = { stage, sentenceIndex, answers, showCheckAnswers };
    void saveGermanLessonSession(lesson.id, nextSession)
      .then(() => setSessionError(''))
      .catch(() => setSessionError('جلسه ذخیره نشد؛ پیشرفت درس کامل ثبت نشده است. دوباره ذخیره کنید.'));
  }, [lesson.id, sessionReady, stage, sentenceIndex, answers, showCheckAnswers, saveRetry]);

  useEffect(() => {
    if (!sessionReady || (stage !== 1 && stage !== 3) || !current?.text) return;
    const timer = setTimeout(() => speak(current.text, stage === 3 ? 0.75 : NORMAL_RATE), 240);
    return () => { clearTimeout(timer); void stopGermanSpeech(); };
  }, [sessionReady, stage, sentenceIndex, lesson.id, speak, current?.text]);

  // Entering a German lesson must be audible before the learner taps anything.
  // The first sentence is spoken once the voice list is actually ready, so a
  // cold browser never reads German with its English default.
  useEffect(() => {
    if (!sessionReady || stage !== 0 || !firstSentence?.text) return undefined;
    const timer = setTimeout(() => autoSpeak(firstSentence.text), 320);
    return () => clearTimeout(timer);
  }, [sessionReady, stage, lesson.id, firstSentence?.text, autoSpeak]);

  // Browsers can refuse speech before any user gesture. If the automatic
  // playback above was blocked, the very first tap or scroll on the lesson
  // speaks the visible German sentence, so the learner still hears German
  // without hunting for a button.
  useEffect(() => {
    if (Platform.OS !== 'web' || !sessionReady || typeof window === 'undefined') return undefined;
    const unlock = () => {
      if (hasSpoken.current) return;
      const text = current?.text;
      if (text) autoSpeak(text, stage === 3 ? 0.75 : NORMAL_RATE);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [sessionReady, current?.text, stage, autoSpeak]);

  // Each vocabulary page opens with its first word pronounced in German.
  const firstPageWord = pageVocabulary[0]?.word.word ?? '';
  useEffect(() => {
    if (!sessionReady || stage !== 5 || !firstPageWord) return;
    const timer = setTimeout(() => autoSpeak(firstPageWord, NORMAL_RATE, 'word'), 420);
    return () => clearTimeout(timer);
  }, [sessionReady, stage, sentenceIndex, firstPageWord, autoSpeak]);

  const playVocabularyPage = () => {
    const words = pageVocabulary.map(item => item.word.word).filter(Boolean);
    // A short breath between two words: without it every word is glued to the
    // next one and the list sounds rushed and chopped instead of spoken.
    const PAUSE_BETWEEN_WORDS = 260;
    const step = (index: number) => {
      if (index >= words.length) return;
      speakGerman({
        text: words[index],
        kind: 'word',
        rate: NORMAL_RATE,
        onStart: () => undefined,
        onDone: () => {
          setTimeout(() => step(index + 1), PAUSE_BETWEEN_WORDS);
        },
        onError: () => undefined,
      });
    };
    step(0);
  };

  const selectSentence = (index: number) => {
    if (!lesson.sentences[index]) return;
    setSpokenWord(-1);
    setSentenceIndex(index);
  };

  const changeStage = (nextStage: number, nextIndex = 0) => {
    void stopGermanSpeech();
    setSpokenWord(-1);
    setStage(nextStage);
    setSentenceIndex(nextIndex);
  };

  const next = async () => {
    if (!sessionReady || sessionError || completing.current || saving) return;
    void stopGermanSpeech();
    setCompletionError('');
    if (stage === 1) {
      if (sentenceIndex < lesson.sentences.length - 1) {
        setSentenceIndex(value => value + 1);
        return;
      }
      changeStage(2);
      return;
    }
    if (stage === 2 || stage === 5) {
      if (sentenceIndex < pageCount - 1) {
        setSentenceIndex(value => value + 1);
        return;
      }
      changeStage(stage + 1);
      return;
    }
    if (stage < stages.length - 1) {
      changeStage(stage + 1);
      return;
    }
    if (!allChecksPassed && !showCheckAnswers) return;
    completing.current = true;
    setSaving(true);
    try {
      const index = GERMAN_SENTENCE_LESSONS.findIndex(item => item.id === lesson.id);
      const nextLesson = GERMAN_SENTENCE_LESSONS[index + 1];
      await germanProgress.completeSentenceLesson(lesson.id, nextLesson?.id);
      await clearGermanLessonSession(lesson.id);
      router.replace(nextLesson
        ? ({ pathname: '/learn/[language]/lesson', params: { language: 'de', id: nextLesson.id } } as never)
        : '/learn/de' as never);
    } catch {
      completing.current = false;
      setCompletionError('پایان درس ذخیره نشد؛ دوباره تلاش کنید.');
    } finally {
      setSaving(false);
    }
  };

  const previousPage = () => {
    void stopGermanSpeech();
    setSentenceIndex(value => Math.max(0, value - 1));
  };

  const nextTitle = saving
    ? 'در حال ذخیره…'
    : stage === 8
      ? 'پایان درس'
      : stage === 1 && sentenceIndex < lesson.sentences.length - 1
        ? 'جملهٔ بعدی'
        : (stage === 2 || stage === 5) && sentenceIndex < pageCount - 1
          ? 'صفحهٔ بعدی'
          : 'ادامه';
  const nextDisabled = saving
    || !!sessionError
    || (stage === 8 && !allChecksPassed && !showCheckAnswers);

  if (!sessionReady) {
    return <View style={styles.root}>
      <PageNavigation backFallback="/learn/de" accentColor={Palette.primary} borderColor={Palette.border} />
      <View style={styles.loadingCard}>
        <ActivityIndicator color={Palette.primary} />
        <Text accessibilityRole={sessionError ? 'alert' : undefined} style={styles.loadingText}>{sessionError || 'در حال بازیابی جلسهٔ آلمانی…'}</Text>
        {sessionError ? <Pressable accessibilityRole="button" style={styles.loadingButton} onPress={() => setLoadingRetry(value => value + 1)}><Text style={styles.loadingButtonText}>تلاش دوباره</Text></Pressable> : null}
      </View>
    </View>;
  }

  const renderWordSentence = () => (
    <Text style={styles.germanSentence}>
      {words.map((word, index) => (
        <Text
          key={`${word.start}-${word.text}`}
          accessibilityRole="button"
          accessibilityLabel={`پخش واژهٔ آلمانی: ${word.text}`}
          onPress={() => speak(word.text, NORMAL_RATE, 'word')}
          style={[styles.sentenceWord, index === spokenWord && styles.sentenceWordActive]}
        >
          {word.text}{index < words.length - 1 ? ' ' : ''}
        </Text>
      ))}
    </Text>
  );

  return (
    <View style={styles.root}>
      <LinearGradient colors={GERMAN_LEVEL_GRADIENTS[level]} start={{ x: 0.95, y: 0 }} end={{ x: 0.05, y: 1 }} style={styles.header}>
        <View style={styles.headerTop}>
          <PageNavigation tone="dark" backFallback="/learn/de" />
          <View style={styles.headerText}>
            <Text style={styles.headerEyebrow}>{levelBadgeLabel(courseLevel.id, courseLevel.title, courseLevel.cefr)}</Text>
            <Text style={styles.headerTitle}>{lesson.title}</Text>
            <Text style={styles.headerSub}>{stages[stage].labelFa} · مرحلهٔ {fa(stage + 1)} از {fa(stages.length)}</Text>
          </View>
          <View style={styles.percentBadge}><Text style={styles.percent}>{fa(progressPercent)}٪</Text><Text style={styles.percentLabel}>پیشرفت</Text></View>
        </View>
        <View style={styles.headerBottom}>
          <View style={styles.headerInfoChip}><BookOpenCheck size={13} color="#D9F3E8" /><Text style={styles.headerInfoText}>مسیر اصلی جمله‌محور</Text></View>
          <Text style={styles.headerInfoText}>{fa(lesson.sentences.length)} جملهٔ اصلی</Text>
        </View>
      </LinearGradient>

      <View style={styles.stepperCard}>
        <View style={styles.stepperHeading}>
          <View><Text style={styles.stepperEyebrow}>LESSON FLOW · 09 STAGES</Text><Text style={styles.stepperTitle}>جریان این درس</Text></View>
          <View style={styles.stepperNow}><Text style={styles.stepperNowEn}>{stages[stage].labelEn}</Text><Text style={styles.stepperNowFa}>{stages[stage].labelFa}</Text></View>
        </View>
        <View style={styles.stepSegments}>{stages.map((item, index) => <View key={item.id} accessibilityLabel={`${item.labelEn} ${index + 1} از ${stages.length}`} style={[styles.stepSegment, index <= stage && styles.stepSegmentDone, index === stage && styles.stepSegmentCurrent]} />)}</View>
        <View style={styles.stepperEnds}><Text style={styles.stepperEndText}>Situation</Text><Text style={styles.stepperEndText}>Spaced Review</Text></View>
      </View>

      {!!(sessionError || speechError) && <Text accessibilityRole="alert" style={styles.error}>{sessionError || speechError}</Text>}


      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {stage === 0 && (
          <LessonSituationStage
            title={lesson.title}
            situation={lesson.situation}
            sentenceCount={lesson.sentences.length}
            teaching={lesson.teachingFa}
            teachingLabel="نکتهٔ آلمانی به فارسی"
            palette={{
              primary: Palette.primary,
              primarySoft: Palette.primarySoft,
              primaryDark: Palette.primaryDark,
              border: Palette.border,
              surface: Palette.surface,
              text: Palette.text,
              warning: Palette.gold,
            }}
            maxWidth={820}
          >
          </LessonSituationStage>
        )}

        {stage === 1 && <View style={styles.sentenceStage}>
          <Text style={styles.counter}>جملهٔ {fa(sentenceIndex + 1)} از {fa(lesson.sentences.length)}</Text>
          <View style={styles.sentenceCard}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={slowNext ? 'پخش آهستهٔ جملهٔ آلمانی' : 'پخش معمولی جملهٔ آلمانی'}
              accessibilityHint="لمس اول معمولی، لمس دوم آهسته"
              style={styles.soundButton}
              onPress={() => { speak(current.text, slowNext ? SLOW_RATE : NORMAL_RATE); setSlowNext(!slowNext); }}
            ><Volume2 size={25} color="#FFFFFF" /></Pressable>
            {renderWordSentence()}
            <Text style={styles.pronunciation}>{current.pronunciation}</Text>
            <View style={styles.divider} />
            <Text style={styles.persian}>{current.fa}</Text>
            {current.pattern ? <View style={styles.pattern}><Text style={styles.patternLabel}>الگوی جمله‌سازی:</Text><Text style={styles.patternText}>{current.pattern}</Text></View> : null}
          </View>
          <View style={styles.replayRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="پخش آهستهٔ جمله" style={styles.replayButton} onPress={() => { speak(current.text, SLOW_RATE); setSlowNext(false); }}><Volume2 size={18} color={Palette.primary} /><Text style={styles.replayText}>آهسته</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="پخش معمولی جمله" style={styles.replayButton} onPress={() => { speak(current.text, NORMAL_RATE); setSlowNext(true); }}><Volume2 size={18} color={Palette.primary} /><Text style={styles.replayText}>معمولی</Text></Pressable>
          </View>
          <Text style={styles.hint}>جمله خودکار پخش می‌شود. بلندگو را که بزنید، بار اول معمولی و بار دوم آهسته می‌خواند. روی هر واژه هم بزنید تا تلفظ همان واژه را جداگانه بشنوید.</Text>
        </View>}

        {stage === 2 && <View style={styles.centerStage}>
          <View style={styles.bigIcon}><Headphones size={34} color={Palette.primary} /></View>
          <Text style={styles.stageTitle}>شنیدن جمله‌ها</Text>
          <Text style={styles.stageDesc}>هر جمله را جداگانه گوش دهید و معنی همان جمله را به یاد بیاورید. این بخش فقط گوش دادن است.</Text>
          <Text style={styles.pageCounter}>صفحهٔ {fa(sentenceIndex + 1)} از {fa(pageCount)} · جمله‌های {fa(pageStart + 1)} تا {fa(pageEnd)}</Text>
          <View style={styles.listenList}>{pageSentences.map((sentence, index) => <Pressable key={sentence.id} accessibilityRole="button" accessibilityLabel={`شنیدن جمله: ${sentence.text}`} style={styles.listenRow} onPress={() => speak(sentence.text, NORMAL_RATE)}>
            <View style={styles.listenNumber}><Text style={styles.listenNumberText}>{fa(pageStart + index + 1)}</Text></View>
            <Text style={styles.listenGerman}>{sentence.text}</Text>
            <Volume2 size={19} color={Palette.primary} />
          </Pressable>)}</View>
          <View style={styles.shadowTip}><Headphones size={18} color={Palette.primary} /><Text style={styles.shadowText}>با «صفحهٔ بعدی» پنج جملهٔ بعد را بشنوید؛ در پایان، سایه‌خوانی آغاز می‌شود.</Text></View>
        </View>}

        {stage === 3 && <View style={styles.centerStage}>
          <View style={styles.bigIcon}><Mic2 size={34} color={Palette.success} /></View>
          <Text style={styles.stageTitle}>سایه‌خوانی · Shadowing</Text>
          <Text style={styles.stageDesc}>نمونه را آهسته پخش کنید، مکث کنید و با همان آهنگ آلمانی تکرار کنید. ضبط صدا یا ارزیابی گفتار لازم نیست.</Text>
          <View style={styles.speechPractice}>
            <View style={styles.practiceTop}><Text style={styles.speechTitle}>جملهٔ انتخاب‌شده</Text><Text style={styles.practiceCounter}>{fa(sentenceIndex + 1)} / {fa(lesson.sentences.length)}</Text></View>
            <Text style={styles.speechSentence}>{current.text}</Text>
            <Text style={styles.speechPron}>{current.pronunciation}</Text>
            <Text style={styles.speechFa}>{current.fa}</Text>
            <Pressable accessibilityRole="button" style={styles.playSlowButton} onPress={() => speak(current.text, 0.55)}><Volume2 size={18} color="#FFFFFF" /><Text style={styles.playSlowText}>پخش آهستهٔ نمونه</Text></Pressable>
            <Text style={styles.speechHint}>پس از شنیدن، جمله را با صدای بلند تکرار کنید؛ گفتار ضبط یا نمره‌گذاری نمی‌شود.</Text>
          </View>
          <View style={styles.practiceNav}>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: sentenceIndex === 0 }} disabled={sentenceIndex === 0} style={[styles.practiceNavButton, sentenceIndex === 0 && styles.practiceNavDisabled]} onPress={() => selectSentence(Math.max(0, sentenceIndex - 1))}><ChevronRight size={18} color={Palette.primaryDark} /><Text style={styles.practiceNavText}>جملهٔ قبل</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: sentenceIndex >= lesson.sentences.length - 1 }} disabled={sentenceIndex >= lesson.sentences.length - 1} style={[styles.practiceNavButton, sentenceIndex >= lesson.sentences.length - 1 && styles.practiceNavDisabled]} onPress={() => selectSentence(Math.min(lesson.sentences.length - 1, sentenceIndex + 1))}><Text style={styles.practiceNavText}>جملهٔ بعد</Text><ChevronLeft size={18} color={Palette.primaryDark} /></Pressable>
          </View>
          <View style={styles.miniTrack}><View style={[styles.miniTrackFill, { width: `${((sentenceIndex + 1) / lesson.sentences.length) * 100}%` }]} /></View>
        </View>}

        {stage === 4 && <View style={styles.centerStage}>
          <View style={styles.bigIcon}><RotateCcw size={33} color={Palette.success} /></View>
          <Text style={styles.stageTitle}>ساخت جمله</Text>
          <Text style={styles.stageDesc}>معنی و الگوی جمله‌سازی را بخوانید و واژه‌های همان جمله را به ترتیب بچینید؛ سپس جمله را با صدای آلمانی بشنوید.</Text>
          <Text style={styles.pageCounter}>جملهٔ {fa(sentenceIndex + 1)} از {fa(lesson.sentences.length)}</Text>
          <GermanSentenceBuilder key={current.id} sentence={current} />
          <Pressable accessibilityRole="button" style={styles.builderSound} onPress={() => speak(current.text, NORMAL_RATE)}><Volume2 size={17} color={Palette.primary} /><Text style={styles.builderSoundText}>شنیدن جملهٔ کامل</Text></Pressable>
          <View style={styles.practiceNav}>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: sentenceIndex === 0 }} disabled={sentenceIndex === 0} style={[styles.practiceNavButton, sentenceIndex === 0 && styles.practiceNavDisabled]} onPress={() => setSentenceIndex(value => Math.max(0, value - 1))}><ChevronRight size={18} color={Palette.primaryDark} /><Text style={styles.practiceNavText}>جملهٔ قبل</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: sentenceIndex >= lesson.sentences.length - 1 }} disabled={sentenceIndex >= lesson.sentences.length - 1} style={[styles.practiceNavButton, sentenceIndex >= lesson.sentences.length - 1 && styles.practiceNavDisabled]} onPress={() => setSentenceIndex(value => Math.min(lesson.sentences.length - 1, value + 1))}><Text style={styles.practiceNavText}>جملهٔ بعد</Text><ChevronLeft size={18} color={Palette.primaryDark} /></Pressable>
          </View>
        </View>}

        {stage === 5 && <View style={styles.centerStage}>
          <View style={styles.bigIcon}><Sparkles size={34} color={Palette.gold} /></View>
          <Text style={styles.stageTitle}>واژگان از دل جمله‌ها</Text>
          <Text style={styles.stageDesc}>هر واژه را همراه معنی و همان جمله‌ای ببینید که از آن آمده است. روی واژه بزنید تا تلفظ آلمانی آن را بشنوید.</Text>
          <Text style={styles.pageCounter}>صفحهٔ {fa(sentenceIndex + 1)} از {fa(pageCount)} · جمله‌های {fa(pageStart + 1)} تا {fa(pageEnd)}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="پخش واژه‌های این صفحه" style={styles.playAllWords} onPress={playVocabularyPage}><Volume2 size={16} color={Palette.primary} /><Text style={styles.playAllWordsText}>پخش واژه‌های این صفحه</Text></Pressable>
          <View style={styles.vocabList}>{pageVocabulary.map(({ word, sentence }) => <View key={`${word.word}-${sentence.id}`} style={styles.vocabCard}>
            <View style={styles.vocabTop}><Pressable accessibilityRole="button" accessibilityLabel={`تلفظ واژهٔ آلمانی: ${word.word}`} style={styles.vocabWordButton} onPress={() => speak(word.word, NORMAL_RATE)}><Volume2 size={15} color={Palette.primary} /><Text style={styles.vocabWord}>{word.word}</Text></Pressable><Text style={styles.vocabMeaning}>{word.meaning}</Text></View>
            <Text style={styles.vocabExample}>{sentence.text}</Text>
            <Text style={styles.vocabExampleFa}>{sentence.fa}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`شنیدن مثال: ${sentence.text}`} style={styles.bubbleSound} onPress={() => speak(sentence.text, NORMAL_RATE)}><Volume2 size={16} color={Palette.primary} /><Text style={styles.bubbleSoundText}>شنیدن مثال</Text></Pressable>
          </View>)}</View>
        </View>}

        {stage === 6 && <View style={styles.centerStage}>
          <View style={styles.bigIcon}><BookOpenCheck size={33} color={Palette.primary} /></View>
          <Text style={styles.stageTitle}>دستور در کاربرد</Text>
          <Text style={styles.stageDesc}>الگوها فقط از جمله‌های ثبت‌شدهٔ همین درس نمایش داده می‌شوند؛ هر الگو با صدای آلمانی همان جمله شنیده می‌شود.</Text>
          {grammarPatterns.length ? grammarPatterns.map(({ sentence, pattern }) => <View key={sentence.id} style={styles.vocabCard}>
            <Text style={styles.grammarPattern}>{pattern}</Text><Text style={styles.vocabExample}>{sentence.text}</Text><Text style={styles.vocabExampleFa}>{sentence.fa}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`شنیدن جمله: ${sentence.text}`} style={styles.bubbleSound} onPress={() => speak(sentence.text, NORMAL_RATE)}><Volume2 size={16} color={Palette.primary} /><Text style={styles.bubbleSoundText}>شنیدن نمونه</Text></Pressable>
          </View>) : <View style={styles.promiseCard}><Text style={styles.promiseTitle}>یادگیری در بافت جمله</Text><Text style={styles.promiseText}>برای این درس الگوی جداگانه‌ای ثبت نشده است؛ جملهٔ اصلی را بشنوید و ساختارش را در کاربرد ببینید.</Text></View>}
        </View>}

        {stage === 7 && <View style={styles.centerStage}>
          <View style={styles.bigIcon}><MessageCircle size={34} color={Palette.primary} /></View>
          <Text style={styles.stageTitle}>مکالمهٔ هدایت‌شده</Text>
          <Text style={styles.stageDesc}>از دیالوگ همین درس نقش‌آفرینی کنید؛ جملهٔ خود را بگویید و سپس نمونه را با صدای آلمانی بشنوید.</Text>
          <GermanDialoguePractice key={lesson.id} dialogue={lesson.dialogue} onSpeak={text => speak(text, NORMAL_RATE)} />
        </View>}

        {stage === 8 && <View style={styles.centerStage}>
          <View style={styles.bigIcon}><RefreshCw size={33} color={Palette.success} /></View>
          <Text style={styles.stageTitle}>مرور فاصله‌دار</Text>
          <Text style={styles.stageDesc}>با پایان درس، جمله‌ها وارد مرور محلی می‌شوند؛ فاصلهٔ بعدی براساس پاسخی که در مرور می‌دهید تنظیم می‌شود.</Text>
          <View style={styles.promiseCard}><Text style={styles.promiseTitle}>خلاصهٔ همین درس</Text><Text style={styles.promiseText}>{fa(lesson.sentences.length)} جمله و {fa(vocabulary.length)} واژه/عبارت یکتا؛ صدا از موتور گفتار دستگاه/مرورگر می‌آید و ضبط نمی‌شود.</Text></View>
          <View style={styles.evidenceCard}>
            <Text style={styles.evidenceTitle}>حالا خودت امتحان کن</Text>
            <Text style={styles.evidenceIntro}>پرسش‌ها فقط از جمله‌ها و واژه‌های همین درس ساخته شده‌اند. پاسخ نادرست را می‌توانید دوباره امتحان کنید یا توضیح پاسخ نمونه را ببینید.</Text>
            {checks.map((question, index) => <View key={index} style={styles.question}>
              <Text style={styles.questionPrompt}>{fa(index + 1)}. {question.promptFa}</Text>
              {question.choices.map((choice, choiceIndex) => {
                const selected = answers[String(index)] === choiceIndex;
                const shownCorrect = showCheckAnswers && choiceIndex === question.correctIndex;
                const locked = answers[String(index)] === question.correctIndex || showCheckAnswers;
                return <Pressable key={`${index}-${choiceIndex}`} accessibilityRole="radio" accessibilityState={{ checked: selected || shownCorrect, disabled: locked }} disabled={locked} onPress={() => setAnswers(value => ({ ...value, [String(index)]: choiceIndex }))} style={[styles.choice, (selected || shownCorrect) && styles.choiceSelected, shownCorrect && styles.choiceCorrect]}>
                  <Text style={/[A-Za-zÄÖÜäöüß]/.test(choice) ? styles.choiceGerman : styles.choicePersian}>{choice}</Text>
                </Pressable>;
              })}
              {(answers[String(index)] !== undefined || showCheckAnswers) && <View style={styles.feedbackBox}>
                <Text style={showCheckAnswers || answers[String(index)] === question.correctIndex ? styles.feedbackTitle : styles.feedbackError}>{showCheckAnswers && answers[String(index)] !== question.correctIndex ? `پاسخ نمونه: ${question.choices[question.correctIndex]}` : answers[String(index)] === question.correctIndex ? 'پاسخ مناسب است.' : 'این بار درست نبود؛ دوباره تلاش کنید.'}</Text>
                <Text style={styles.feedbackText}>{question.explanationFa}</Text>
                {answers[String(index)] !== undefined && answers[String(index)] !== question.correctIndex && !showCheckAnswers ? <Pressable accessibilityRole="button" style={styles.retryAnswer} onPress={() => setAnswers(value => { const nextAnswers = { ...value }; delete nextAnswers[String(index)]; return nextAnswers; })}><Text style={styles.retryAnswerText}>دوباره امتحان کن</Text></Pressable> : null}
              </View>}
            </View>)}
            {!showCheckAnswers && <Pressable accessibilityRole="button" style={styles.showAnswersButton} onPress={() => setShowCheckAnswers(true)}><Text style={styles.showAnswersText}>نمایش توضیح همهٔ پاسخ‌ها</Text></Pressable>}
            {showCheckAnswers ? <Text style={styles.evidenceNote}>پاسخ‌های نمونه نمایش داده شدند؛ می‌توانید درس را پایان دهید.</Text> : null}
          </View>
        </View>}

        {!!completionError && <Text accessibilityRole="alert" style={styles.error}>{completionError}</Text>}
        {sessionError ? <Pressable accessibilityRole="button" style={styles.retrySaveButton} onPress={() => setSaveRetry(value => value + 1)}><Text style={styles.retrySaveText}>تلاش دوباره برای ذخیرهٔ جلسه</Text></Pressable> : null}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerRow}>
          {(stage === 2 || stage === 5) && sentenceIndex > 0 ? <Pressable accessibilityRole="button" style={styles.prevButton} onPress={previousPage}><Text style={styles.prevButtonText}>صفحهٔ قبل</Text></Pressable> : null}
          <Pressable accessibilityRole="button" disabled={nextDisabled} style={[styles.nextButton, nextDisabled && styles.nextButtonDisabled]} onPress={() => void next()}>
            <Text style={styles.nextText}>{nextTitle}</Text>
            {stage === stages.length - 1 ? <Check size={20} color="#FFFFFF" /> : <ChevronLeft size={20} color="#FFFFFF" />}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.canvas },
  loadingCard: { flex: 1, minHeight: 260, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 13 },
  loadingText: { fontFamily: Typography.fontFamily, color: Palette.text, fontSize: 13, textAlign: 'right', writingDirection: 'rtl' },
  loadingButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 13, backgroundColor: Palette.primary },
  loadingButtonText: { fontFamily: Typography.fontFamily, color: '#FFFFFF', fontWeight: '400', writingDirection: 'rtl' },
  header: { paddingTop: 42, paddingHorizontal: 20, paddingBottom: 15, gap: 14, borderBottomLeftRadius: 22, borderBottomRightRadius: 22 },
  headerTop: { width: '100%', maxWidth: 820, alignSelf: 'center', flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  headerText: { flex: 1, alignItems: 'flex-end', gap: 2 },
  headerEyebrow: { fontFamily: 'Inter-ExtraBold', color: 'rgba(255,255,255,0.72)', fontSize: 7, fontWeight: '800', letterSpacing: 1, writingDirection: 'ltr' },
  headerTitle: { fontFamily: Typography.fontFamily, fontSize: 18, lineHeight: 27, fontWeight: '400', color: '#FFFFFF', textAlign: 'right', writingDirection: 'rtl' },
  headerSub: { fontFamily: Typography.fontFamily, fontSize: 10, color: 'rgba(255,255,255,0.80)', textAlign: 'right', writingDirection: 'rtl' },
  percentBadge: { minWidth: 50, height: 50, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  percent: { fontFamily: Typography.fontFamily, fontSize: 14, lineHeight: 18, fontWeight: '400', color: '#FFFFFF', writingDirection: 'rtl' },
  percentLabel: { fontFamily: Typography.fontFamily, fontSize: 8, color: 'rgba(255,255,255,0.72)', writingDirection: 'rtl' },
  headerBottom: { width: '100%', maxWidth: 820, alignSelf: 'center', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  headerInfoChip: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  headerInfoText: { fontFamily: Typography.fontFamily, color: 'rgba(255,255,255,0.86)', fontSize: 9, fontWeight: '400', writingDirection: 'rtl' },
  voiceChip: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999 },
  voiceDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#E8D9A8' },
  voiceDotReady: { backgroundColor: '#8BF0C2' },
  voiceChipText: { fontFamily: Typography.fontFamily, color: '#FFFFFF', fontSize: 8, fontWeight: '400', writingDirection: 'rtl' },
  stepperCard: { width: '100%', maxWidth: 820, alignSelf: 'center', marginTop: 12, borderRadius: 18, backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.border, padding: 13, gap: 10 },
  stepperHeading: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  stepperEyebrow: { fontFamily: 'Inter-ExtraBold', color: Palette.primary, fontSize: 6, fontWeight: '800', letterSpacing: 1.1, textAlign: 'right', writingDirection: 'ltr' },
  stepperTitle: { fontFamily: Typography.fontFamily, color: Palette.ink, fontSize: 15, fontWeight: '400', textAlign: 'right', writingDirection: 'rtl' },
  stepperNow: { alignItems: 'flex-start', maxWidth: '48%' },
  stepperNowEn: { fontFamily: 'Inter-ExtraBold', color: Palette.primaryDark, fontSize: 8, fontWeight: '800', writingDirection: 'ltr' },
  stepperNowFa: { fontFamily: Typography.fontFamily, color: Palette.text, fontSize: 9, fontWeight: '400', writingDirection: 'rtl' },
  stepSegments: { flexDirection: 'row-reverse', gap: 4 },
  stepSegment: { flex: 1, height: 6, borderRadius: 3, backgroundColor: Palette.border },
  stepSegmentDone: { backgroundColor: Palette.primarySoft },
  stepSegmentCurrent: { backgroundColor: Palette.primary },
  stepperEnds: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
  stepperEndText: { fontFamily: 'Inter-ExtraBold', color: Palette.muted, fontSize: 6, fontWeight: '800', letterSpacing: .5, writingDirection: 'ltr' },
  error: { width: '100%', maxWidth: 820, alignSelf: 'center', marginTop: 10, paddingHorizontal: 16, color: Palette.danger, fontFamily: Typography.fontFamily, fontSize: 11, lineHeight: 19, textAlign: 'right', writingDirection: 'rtl' },
  voiceHint: { width: '100%', maxWidth: 820, alignSelf: 'center', marginTop: 10, padding: 12, borderRadius: 14, backgroundColor: Palette.surfaceMuted, borderWidth: 1, borderColor: Palette.border, flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 8 },
  voiceHintText: { flex: 1, fontFamily: Typography.fontFamily, color: Palette.text, fontSize: 10, lineHeight: 19, textAlign: 'right', writingDirection: 'rtl' },
  voiceRetry: { alignSelf: 'flex-start', paddingVertical: 4 },
  voiceRetryText: { fontFamily: Typography.fontFamily, color: Palette.primary, fontSize: 11, fontWeight: '400', writingDirection: 'rtl' },
  content: { flexGrow: 1, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 26 },
  centerStage: { width: '100%', maxWidth: 820, alignSelf: 'center', alignItems: 'center', gap: 12 },
  bigIcon: { width: 68, height: 68, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.primarySoft, borderWidth: 1, borderColor: Palette.border },
  stageEyebrow: { fontFamily: Typography.fontFamily, color: Palette.primary, fontSize: 11, fontWeight: '400', textAlign: 'right', writingDirection: 'rtl' },
  stageTitle: { fontFamily: Typography.fontFamily, color: Palette.ink, fontSize: 22, lineHeight: 33, fontWeight: '400', textAlign: 'right', writingDirection: 'rtl' },
  stageDesc: { fontFamily: Typography.fontFamily, color: Palette.text, fontSize: 12, lineHeight: 22, textAlign: 'right', writingDirection: 'rtl', maxWidth: 640 },
  situation: { fontFamily: Typography.fontFamily, color: Palette.text, fontSize: 15, lineHeight: 28, textAlign: 'right', writingDirection: 'rtl', maxWidth: 660 },
  previewCard: { width: '100%', borderRadius: 21, backgroundColor: Palette.ink, padding: 17, gap: 10, marginTop: 4 },
  previewTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  previewBadge: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  previewTextBlock: { flex: 1, alignItems: 'flex-end', gap: 3 },
  previewLabel: { fontFamily: Typography.fontFamily, color: 'rgba(255,255,255,0.70)', fontSize: 10, textAlign: 'right', writingDirection: 'rtl' },
  previewSentence: { fontFamily: 'Inter-ExtraBold', color: '#FFFFFF', fontSize: 21, lineHeight: 32, fontWeight: '800', textAlign: 'left', writingDirection: 'ltr', alignSelf: 'stretch' },
  previewFa: { fontFamily: Typography.fontFamily, color: 'rgba(255,255,255,0.84)', fontSize: 13, lineHeight: 24, textAlign: 'right', writingDirection: 'rtl' },
  previewActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-start', flexWrap: 'wrap' },
  previewButton: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  previewButtonText: { fontFamily: Typography.fontFamily, color: '#FFFFFF', fontSize: 12, writingDirection: 'rtl' },
  previewWordsLabel: { fontFamily: Typography.fontFamily, color: 'rgba(255,255,255,0.62)', fontSize: 10, textAlign: 'right', writingDirection: 'rtl', marginTop: 2 },
  previewWords: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 7 },
  previewWordChip: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, minHeight: 36, paddingHorizontal: 11, borderRadius: 999, backgroundColor: '#FFFFFF' },
  previewWordText: { fontFamily: 'Inter-ExtraBold', color: Palette.primaryDark, fontSize: 12, fontWeight: '800', writingDirection: 'ltr' },
  promiseCard: { width: '100%', borderRadius: 18, backgroundColor: Palette.primarySoft, borderWidth: 1, borderColor: '#CDE8DD', padding: 15, gap: 5, marginTop: 2 },
  promiseTitle: { fontFamily: Typography.fontFamily, color: Palette.primaryDark, fontSize: 12, fontWeight: '400', textAlign: 'right', writingDirection: 'rtl' },
  promiseText: { fontFamily: Typography.fontFamily, color: Palette.text, fontSize: 12, lineHeight: 22, textAlign: 'right', writingDirection: 'rtl' },
  noteCard: { width: '100%', marginTop: 4, borderRadius: 18, backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.border, padding: 17, gap: 8 },
  noteTitle: { fontFamily: Typography.fontFamily, color: Palette.primaryDark, fontSize: 13, fontWeight: '400', textAlign: 'right', writingDirection: 'rtl' },
  noteText: { fontFamily: Typography.fontFamily, color: Palette.text, fontSize: 12, lineHeight: 25, textAlign: 'right', writingDirection: 'rtl' },
  voiceReadyCard: { width: '100%', flexDirection: 'row-reverse', alignItems: 'center', gap: 9, padding: 13, borderRadius: 15, backgroundColor: Palette.surfaceMuted, borderWidth: 1, borderColor: Palette.border },
  voiceReadyText: { flex: 1, fontFamily: Typography.fontFamily, color: Palette.text, fontSize: 11, lineHeight: 20, textAlign: 'right', writingDirection: 'rtl' },
  sentenceStage: { alignItems: 'center', paddingTop: 8, width: '100%', maxWidth: 820, alignSelf: 'center' },
  counter: { fontFamily: Typography.fontFamily, fontSize: 11, color: Palette.muted, marginBottom: 12, alignSelf: 'flex-end', textAlign: 'right', writingDirection: 'rtl' },
  sentenceCard: { width: '100%', borderRadius: 22, backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.border, padding: 22, alignItems: 'center', shadowColor: '#123B31', shadowOpacity: .05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  soundButton: { width: 54, height: 54, borderRadius: 27, backgroundColor: Palette.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  germanSentence: { fontFamily: 'Inter-ExtraBold', width: '100%', fontSize: 23, lineHeight: 38, fontWeight: '800', color: Palette.ink, textAlign: 'left', writingDirection: 'ltr' },
  sentenceWord: { color: Palette.ink },
  sentenceWordActive: { color: '#FFFFFF', backgroundColor: Palette.primary },
  pronunciation: { fontFamily: Typography.fontFamily, fontSize: 12, color: Palette.primaryDark, textAlign: 'right', writingDirection: 'rtl', alignSelf: 'stretch', marginTop: 8 },
  divider: { width: '70%', height: 1, backgroundColor: Palette.border, marginVertical: 18 },
  persian: { fontFamily: Typography.fontFamily, fontSize: 17, color: Palette.text, textAlign: 'right', writingDirection: 'rtl', alignSelf: 'stretch' },
  pattern: { width: '100%', flexDirection: 'column', alignItems: 'flex-end', gap: 4, backgroundColor: Palette.warningSoft, borderWidth: 1, borderColor: '#F3DEC0', paddingHorizontal: 13, paddingVertical: 9, borderRadius: 14, marginTop: 14 },
  patternLabel: { fontFamily: Typography.fontFamily, fontSize: 10, fontWeight: '400', color: Palette.warning, textAlign: 'right', writingDirection: 'rtl' },
  patternText: { fontFamily: Typography.fontFamily, fontSize: 12, lineHeight: 20, fontWeight: '400', color: Palette.ink, textAlign: 'right', writingDirection: 'rtl' },
  hint: { fontFamily: Typography.fontFamily, fontSize: 11, color: Palette.muted, textAlign: 'right', writingDirection: 'rtl', lineHeight: 19, marginTop: 14, maxWidth: 620 },
  replayRow: { flexDirection: 'row', gap: 10, justifyContent: 'center', marginTop: 12 },
  replayButton: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 18, borderRadius: 14, borderWidth: 1, borderColor: Palette.primary, backgroundColor: '#FFFFFF' },
  replayText: { fontFamily: Typography.fontFamily, fontSize: 13, fontWeight: '400', color: Palette.primary, writingDirection: 'rtl' },
  pageCounter: { fontFamily: Typography.fontFamily, fontSize: 11, color: Palette.muted, textAlign: 'right', writingDirection: 'rtl', alignSelf: 'stretch' },
  listenList: { width: '100%', gap: 8, marginTop: 4 },
  listenRow: { minHeight: 62, borderRadius: 16, backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.border, paddingHorizontal: 13, flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  listenNumber: { width: 30, height: 30, borderRadius: 15, backgroundColor: Palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  listenNumberText: { fontFamily: Typography.numberFontFamily, fontSize: 11, color: Palette.primaryDark, writingDirection: 'rtl' },
  listenGerman: { fontFamily: 'Inter-ExtraBold', flex: 1, fontSize: 14, fontWeight: '800', lineHeight: 23, color: Palette.ink, textAlign: 'left', writingDirection: 'ltr' },
  shadowTip: { width: '100%', marginTop: 14, borderRadius: 14, backgroundColor: Palette.warningSoft, padding: 13, flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  shadowText: { flex: 1, fontFamily: Typography.fontFamily, fontSize: 11, color: Palette.text, textAlign: 'right', writingDirection: 'rtl', lineHeight: 19 },
  speechPractice: { width: '100%', borderRadius: 22, backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.border, padding: 18, alignItems: 'center', shadowColor: '#123B31', shadowOpacity: .04, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  practiceTop: { width: '100%', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  speechTitle: { fontFamily: Typography.fontFamily, fontSize: 13, fontWeight: '400', color: Palette.ink, textAlign: 'right', writingDirection: 'rtl' },
  practiceCounter: { fontFamily: Typography.numberFontFamily, fontSize: 10, color: Palette.muted, writingDirection: 'rtl' },
  speechSentence: { fontFamily: 'Inter-ExtraBold', width: '100%', fontSize: 19, lineHeight: 31, fontWeight: '800', color: Palette.ink, textAlign: 'left', writingDirection: 'ltr', marginTop: 10 },
  speechPron: { width: '100%', fontFamily: Typography.fontFamily, fontSize: 12, color: Palette.primaryDark, textAlign: 'right', writingDirection: 'rtl', marginTop: 6 },
  speechFa: { width: '100%', fontFamily: Typography.fontFamily, fontSize: 13, lineHeight: 22, color: Palette.text, textAlign: 'right', writingDirection: 'rtl', marginTop: 6 },
  playSlowButton: { minHeight: 48, minWidth: 170, borderRadius: 999, paddingHorizontal: 18, backgroundColor: Palette.primary, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 14 },
  playSlowText: { fontFamily: Typography.fontFamily, fontSize: 12, fontWeight: '400', color: '#FFFFFF', writingDirection: 'rtl' },
  speechHint: { fontFamily: Typography.fontFamily, fontSize: 11, color: Palette.muted, textAlign: 'right', writingDirection: 'rtl', alignSelf: 'stretch', lineHeight: 19, marginTop: 8 },
  practiceNav: { width: '100%', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 14 },
  practiceNavButton: { minHeight: 42, flexDirection: 'row-reverse', alignItems: 'center', gap: 4, paddingHorizontal: 14, borderRadius: 12, backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.border },
  practiceNavDisabled: { opacity: .38 },
  practiceNavText: { fontFamily: Typography.fontFamily, fontSize: 11, fontWeight: '400', color: Palette.primaryDark, writingDirection: 'rtl' },
  miniTrack: { width: '100%', height: 5, borderRadius: 3, backgroundColor: Palette.border, marginTop: 13, overflow: 'hidden' },
  miniTrackFill: { height: '100%', backgroundColor: Palette.primary, alignSelf: 'flex-end' },
  builderSound: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginTop: 5, paddingVertical: 7 },
  builderSoundText: { fontFamily: Typography.fontFamily, fontSize: 12, fontWeight: '400', color: Palette.primary, writingDirection: 'rtl' },
  playAllWords: { width: '100%', minHeight: 44, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 13, borderWidth: 1, borderColor: Palette.primary, backgroundColor: '#FFFFFF' },
  playAllWordsText: { fontFamily: Typography.fontFamily, color: Palette.primary, fontSize: 12, fontWeight: '400', writingDirection: 'rtl' },
  vocabList: { width: '100%', gap: 9, marginTop: 4 },
  vocabCard: { width: '100%', borderRadius: 16, backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.border, padding: 14, gap: 7 },
  vocabTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  vocabWordButton: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  vocabWord: { fontFamily: 'Inter-ExtraBold', fontSize: 16, fontWeight: '800', color: Palette.ink, textAlign: 'left', writingDirection: 'ltr' },
  vocabMeaning: { fontFamily: Typography.fontFamily, fontSize: 12, color: Palette.primaryDark, textAlign: 'right', writingDirection: 'rtl' },
  vocabExample: { fontFamily: 'Inter-ExtraBold', fontSize: 13, fontWeight: '800', lineHeight: 22, color: Palette.text, textAlign: 'left', writingDirection: 'ltr' },
  vocabExampleFa: { fontFamily: Typography.fontFamily, fontSize: 11, lineHeight: 19, color: Palette.muted, textAlign: 'right', writingDirection: 'rtl' },
  bubbleSound: { alignSelf: 'flex-end', marginTop: 2, flexDirection: 'row-reverse', alignItems: 'center', gap: 5, padding: 4 },
  bubbleSoundText: { fontFamily: Typography.fontFamily, fontSize: 10, color: Palette.primary, writingDirection: 'rtl' },
  grammarPattern: { fontFamily: Typography.fontFamily, fontSize: 12, lineHeight: 21, color: Palette.primaryDark, backgroundColor: Palette.primarySoft, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, textAlign: 'right', writingDirection: 'rtl' },
  evidenceCard: { width: '100%', marginTop: 8, borderRadius: 20, padding: 17, backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.border, gap: 12 },
  evidenceTitle: { fontFamily: Typography.fontFamily, fontSize: 17, fontWeight: '400', color: Palette.ink, textAlign: 'right', writingDirection: 'rtl' },
  evidenceIntro: { fontFamily: Typography.fontFamily, fontSize: 11, lineHeight: 19, color: Palette.text, textAlign: 'right', writingDirection: 'rtl' },
  question: { gap: 9, marginTop: 5 },
  questionPrompt: { fontFamily: Typography.fontFamily, fontSize: 13, lineHeight: 22, color: Palette.text, textAlign: 'right', writingDirection: 'rtl' },
  choice: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.surfaceMuted, paddingHorizontal: 13, paddingVertical: 11, justifyContent: 'center' },
  choiceSelected: { borderColor: Palette.primary, backgroundColor: Palette.primarySoft },
  choiceCorrect: { borderColor: Palette.success, backgroundColor: Palette.successSoft },
  choiceGerman: { fontFamily: 'Inter-ExtraBold', fontSize: 12, fontWeight: '800', lineHeight: 21, color: Palette.ink, textAlign: 'left', writingDirection: 'ltr' },
  choicePersian: { fontFamily: Typography.fontFamily, fontSize: 13, lineHeight: 21, color: Palette.ink, textAlign: 'right', writingDirection: 'rtl' },
  feedbackBox: { borderRadius: 12, padding: 12, backgroundColor: Palette.surfaceMuted, gap: 5 },
  feedbackTitle: { fontFamily: Typography.fontFamily, color: Palette.success, fontSize: 12, fontWeight: '400', textAlign: 'right', writingDirection: 'rtl' },
  feedbackError: { fontFamily: Typography.fontFamily, color: Palette.danger, fontSize: 12, fontWeight: '400', textAlign: 'right', writingDirection: 'rtl' },
  feedbackText: { fontFamily: Typography.fontFamily, color: Palette.text, fontSize: 11, lineHeight: 19, textAlign: 'right', writingDirection: 'rtl' },
  retryAnswer: { alignSelf: 'flex-start', paddingVertical: 6 },
  retryAnswerText: { fontFamily: Typography.fontFamily, color: Palette.primary, fontSize: 11, fontWeight: '400', writingDirection: 'rtl' },
  showAnswersButton: { minHeight: 45, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.surface, marginTop: 4 },
  showAnswersText: { fontFamily: Typography.fontFamily, color: Palette.primaryDark, fontSize: 12, fontWeight: '400', writingDirection: 'rtl' },
  evidenceNote: { fontFamily: Typography.fontFamily, color: Palette.success, fontSize: 11, lineHeight: 19, textAlign: 'right', writingDirection: 'rtl' },
  retrySaveButton: { alignSelf: 'center', marginTop: 8, paddingVertical: 8 },
  retrySaveText: { fontFamily: Typography.fontFamily, color: Palette.primary, fontSize: 11, fontWeight: '400', writingDirection: 'rtl' },
  footer: { paddingHorizontal: 18, paddingTop: 11, paddingBottom: 14, backgroundColor: 'rgba(255,255,255,0.96)', borderTopWidth: 1, borderTopColor: Palette.border, shadowColor: '#123B31', shadowOpacity: .07, shadowRadius: 12, shadowOffset: { width: 0, height: -4 }, elevation: 5 },
  footerRow: { width: '100%', maxWidth: 820, alignSelf: 'center', flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  prevButton: { minHeight: 54, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 17, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.surface },
  prevButtonText: { fontFamily: Typography.fontFamily, fontSize: 12, fontWeight: '400', color: Palette.primaryDark, writingDirection: 'rtl' },
  nextButton: { flex: 1, minHeight: 54, borderRadius: 17, backgroundColor: Palette.primary, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: Palette.primary, shadowOpacity: .2, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  nextButtonDisabled: { opacity: .45 },
  nextText: { fontFamily: Typography.fontFamily, fontSize: 14, fontWeight: '400', color: '#FFFFFF', writingDirection: 'rtl' },
});
