import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { GermanCourseButton as CourseButton, GermanCoursePage as CoursePage, germanCourseStyles as s } from '@/components/GermanCourseUI';
import { clearLegacyGermanVoiceChoices, stopGermanSpeech } from '@/lib/germanSpeech';
import { loadGermanAudioManifest, playGermanClip, setGermanAudioLesson, stopGermanClip } from '@/lib/germanAudio';
import { GERMAN_SENTENCE_LESSONS } from '@/lib/languages/germanSentenceCourse';
import { germanNarratorLabel } from '@/lib/languages/germanNarrator';

/**
 * The German voice page.
 *
 * The course has exactly **one** narrator: the voice the learner picked by ear,
 * rendered into the pack that ships with the app (`config/german-narrator.json`).
 * Earlier builds also listed the phone's own German voices and let the learner
 * switch to them, which is what brought a worse-sounding voice back into the
 * lessons. That choice is gone: this page only lets the learner hear the one
 * narrator that every lesson uses, so nothing else can be selected by accident.
 */
export default function AudioCheck() {
  const { language } = useLocalSearchParams<{ language: string }>();
  const [bundled, setBundled] = useState<{ engine: string; sentences: number; words: number; sample: string; sampleWord: string } | null>(null);
  const [status, setStatus] = useState('');
  const [playing, setPlaying] = useState<'sentence' | 'word' | null>(null);

  useFocusEffect(useCallback(() => {
    let alive = true;
    // A voice picked in an older build must never speak again.
    clearLegacyGermanVoiceChoices();
    setGermanAudioLesson('de-v2-greetings');
    void loadGermanAudioManifest().then(manifest => {
      if (!alive || !manifest) return;
      const greetings = manifest.lessons['de-v2-greetings'];
      const firstLesson = GERMAN_SENTENCE_LESSONS[0];
      setBundled({
        engine: manifest.engine ?? 'eSpeak NG',
        sentences: Object.keys(greetings?.sentences.clips ?? {}).length,
        words: Object.keys(greetings?.words.clips ?? {}).length,
        sample: firstLesson?.sentences[0]?.text ?? '',
        sampleWord: firstLesson?.sentences[0]?.vocabulary[0]?.word ?? '',
      });
    });
    return () => {
      alive = false;
      void stopGermanSpeech();
      stopGermanClip();
    };
  }, []));

  const play = (kind: 'sentence' | 'word') => {
    const text = kind === 'word' ? bundled?.sampleWord : bundled?.sample;
    if (!text) return;
    setPlaying(kind);
    setStatus('در حال پخش…');
    void playGermanClip({
      text,
      kind,
      lessonId: 'de-v2-greetings',
      rate: 0.9,
      onDone: () => { setPlaying(null); setStatus('پخش تمام شد.'); },
      onError: () => { setPlaying(null); setStatus('پخش صدا انجام نشد؛ بلندی صدا و حالت بی‌صدا را بررسی کنید.'); },
    }).then(played => {
      if (!played) {
        setPlaying(null);
        setStatus('صدا برای این عبارت پیدا نشد.');
      }
    });
  };

  if (language !== 'de') return <CoursePage title="بررسی صدا پیدا نشد">{null}</CoursePage>;

  return <CoursePage title="صدای آلمانی" subtitle="یک گوینده، بدون نصب زبان و بدون اینترنت" back="/learn/de">
    <Text style={s.notice}>بلندی صدا را بالا ببرید و حالت بی‌صدا را بررسی کنید. جمله‌ها و واژه‌های آلمانی همراه خود برنامه ذخیره شده‌اند؛ برای شنیدنشان نه به نصب زبان آلمانی روی دستگاه نیاز است و نه به اینترنت.</Text>

    <View style={s.card}>
      <Text style={s.heading}>۱. گویندهٔ آلمانی درس‌ها</Text>
      <Text style={s.small}>گوینده: {germanNarratorLabel()}</Text>
      {bundled ? (
        <>
          <Text style={s.small}>موتور: {bundled.engine} • {bundled.sentences} جمله و {bundled.words} واژه در درس نمونه</Text>
          <CourseButton title={`شنیدن یک جمله: ${bundled.sample}`} disabled={playing !== null} onPress={() => play('sentence')} />
          <CourseButton title={`شنیدن یک واژه: ${bundled.sampleWord}`} secondary disabled={playing !== null} onPress={() => play('word')} />
        </>
      ) : <Text style={s.small}>صداهای داخلی برنامه در حال بارگذاری…</Text>}
      {!!status && <Text accessibilityLiveRegion="polite" style={s.small}>{status}</Text>}
    </View>

    <View style={s.card}>
      <Text style={s.heading}>۲. همین صدا در همهٔ درس‌ها</Text>
      <Text style={s.small}>همهٔ درس‌ها و همهٔ واژه‌ها با همین گوینده پخش می‌شوند؛ روی هر گوشی یکسان و بی‌نیاز از نصب زبان آلمانی.</Text>
      <Text style={s.small}>روی دکمهٔ بلندگو در درس، بار اول جمله معمولی و بار دوم آهسته خوانده می‌شود.</Text>
      <Text style={s.small}>بخش «صدای آلمانی دستگاه» و انتخاب گوینده در این نسخه حذف شده است تا همیشه همین یک صدا شنیده شود.</Text>
    </View>
  </CoursePage>;
}
