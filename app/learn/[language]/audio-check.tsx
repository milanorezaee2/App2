import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { GermanCourseButton as CourseButton, GermanCoursePage as CoursePage, germanCourseStyles as s } from '@/components/GermanCourseUI';
import {
  clearLegacyGermanVoiceChoices,
  getGermanNarratorId,
  loadGermanNarratorPreference,
  setGermanNarratorId,
  stopGermanSpeech,
} from '@/lib/germanSpeech';
import { playGermanClip, setGermanAudioLesson, stopGermanClip } from '@/lib/germanAudio';
import { GERMAN_SENTENCE_LESSONS } from '@/lib/languages/germanSentenceCourse';
import { GERMAN_NARRATORS, germanNarratorLabel } from '@/lib/languages/germanNarrator';
import { toPersianDigits } from '@/lib/format';

/**
 * The German voice page.
 *
 * The neural narrators that ship inside the app (`config/german-narrator.json`)
 * each have their own pack under `public/audio/de/<id>/`. The learner hears a
 * sample of each and picks one; the choice is saved and every lesson, word and
 * review then plays that voice — always the same speaker, never a mix.
 *
 * The page follows the config: when the build ships one narrator it presents
 * that one, and adding another voice later needs no change here.
 *
 * Earlier builds also listed the phone's own German voices. That is still gone:
 * the only alternatives are the packs that ship with the app, so a phone with a
 * bad German voice cannot sneak back into the lessons.
 */
export default function AudioCheck() {
  const { language } = useLocalSearchParams<{ language: string }>();
  const [sample, setSample] = useState<{ sentence: string; word: string }>({ sentence: '', word: '' });
  const [selected, setSelected] = useState(getGermanNarratorId());
  const [playing, setPlaying] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  useFocusEffect(useCallback(() => {
    let alive = true;
    // A voice picked in an older build must never speak again.
    clearLegacyGermanVoiceChoices();
    setGermanAudioLesson('de-v2-greetings');
    void loadGermanNarratorPreference().then(id => {
      if (alive) setSelected(id);
    });
    const firstLesson = GERMAN_SENTENCE_LESSONS[0];
    setSample({
      sentence: firstLesson?.sentences[0]?.text ?? '',
      word: firstLesson?.sentences[0]?.vocabulary[0]?.word ?? '',
    });
    return () => {
      alive = false;
      void stopGermanSpeech();
      stopGermanClip();
    };
  }, []));

  /** Play the sample sentence with a given narrator, without changing the choice. */
  const preview = (narratorId: string) => {
    if (!sample.sentence) return;
    setPlaying(narratorId);
    setStatus('در حال پخش نمونه…');
    setGermanNarratorId(narratorId);
    setSelected(narratorId);
    void playGermanClip({
      text: sample.sentence,
      kind: 'sentence',
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

  const playWord = () => {
    if (!sample.word) return;
    setStatus('در حال پخش واژه…');
    setGermanNarratorId(selected);
    void playGermanClip({
      text: sample.word,
      kind: 'word',
      lessonId: 'de-v2-greetings',
      rate: 0.9,
      onDone: () => setStatus('پخش تمام شد.'),
      onError: () => setStatus('پخش صدا انجام نشد؛ بلندی صدا و حالت بی‌صدا را بررسی کنید.'),
    });
  };

  if (language !== 'de') return <CoursePage title="بررسی صدا پیدا نشد">{null}</CoursePage>;

  const narratorCount = GERMAN_NARRATORS.length;
  const choices = narratorCount > 1;
  const subtitle = choices
    ? `${toPersianDigits(narratorCount)} گوینده؛ شما انتخاب می‌کنید`
    : 'گویندهٔ درس‌ها، همراه خود برنامه';
  const notice = choices
    ? 'بلندی صدا را بالا ببرید و حالت بی‌صدا را بررسی کنید. همهٔ گوینده‌ها همراه خود برنامه ذخیره شده‌اند؛ برای شنیدنشان نه به نصب زبان آلمانی روی دستگاه نیاز است و نه به اینترنت.'
    : 'بلندی صدا را بالا ببرید و حالت بی‌صدا را بررسی کنید. این گوینده همراه خود برنامه ذخیره شده است؛ برای شنیدنش نه به نصب زبان آلمانی روی دستگاه نیاز است و نه به اینترنت.';

  return <CoursePage title="صدای آلمانی" subtitle={subtitle} back="/learn/de">
    <Text style={s.notice}>{notice}</Text>

    <View style={s.card}>
      <Text style={s.heading}>{choices ? '۱. گوینده را انتخاب کنید' : '۱. گویندهٔ آلمانی درس‌ها'}</Text>
      <Text style={s.small}>{choices
        ? 'روی هر گزینه بزنید تا همان جملهٔ نمونه را با آن صدا بشنوید. همان لحظه انتخاب می‌شود و از این به بعد همهٔ درس‌ها با همین صدا خوانده می‌شوند.'
        : 'روی گزینه بزنید تا همان جملهٔ نمونه را با صدای درس‌ها بشنوید. همهٔ جمله‌ها، واژه‌ها و مرورها با همین صدا خوانده می‌شوند.'}</Text>
      {GERMAN_NARRATORS.map(narrator => {
        const isSelected = narrator.id === selected;
        return (
          <Pressable
            key={narrator.id}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`گویندهٔ ${narrator.nameFa} — ${narrator.descriptionFa}`}
            onPress={() => preview(narrator.id)}
            style={[{
              borderWidth: 1.5,
              borderColor: isSelected ? '#1769D2' : '#E2E8F0',
              backgroundColor: isSelected ? '#EFF6FF' : '#FFFFFF',
              borderRadius: 14,
              paddingVertical: 12,
              paddingHorizontal: 14,
              marginTop: 10,
            }]}
          >
            <Text style={{ fontFamily: 'Vazirmatn-Bold', fontSize: 15, color: '#102A56', textAlign: 'right' }}>
              {playing === narrator.id ? '🔊 ' : ''}{narrator.nameFa}{isSelected ? ' ✓' : ''}
            </Text>
            <Text style={s.small}>{narrator.descriptionFa} · {toPersianDigits(narrator.wordsPerMinute)} کلمه در دقیقه</Text>
            <Text style={s.small}>{isSelected ? (choices ? 'انتخاب‌شده' : 'گویندهٔ فعال') : (choices ? 'برای شنیدن و انتخاب بزنید' : 'برای شنیدن نمونه بزنید')}</Text>
          </Pressable>
        );
      })}
      {!!status && <Text accessibilityLiveRegion="polite" style={s.small}>{status}</Text>}
    </View>

    <View style={s.card}>
      <Text style={s.heading}>۲. همین صدا در همهٔ درس‌ها</Text>
      <Text style={s.small}>گویندهٔ فعلی: {germanNarratorLabel(selected)}</Text>
      <Text style={s.small}>همهٔ درس‌ها، واژه‌ها، جمله‌های اصلی و مرور با همین یک گوینده پخش می‌شوند؛ روی هر گوشی یکسان و بی‌نیاز از نصب زبان آلمانی.</Text>
      <Text style={s.small}>هر جمله و هر واژه جداگانه ضبط شده و قبل و بعدش سکوت کامل دارد؛ بنابراین هیچ واژه‌ای از جملهٔ قبلی یا بعدی روی آن نمی‌افتد.</Text>
      {!!sample.word && <CourseButton title={`شنیدن یک واژه با همین صدا: ${sample.word}`} secondary onPress={playWord} />}
      <Text style={s.small}>روی دکمهٔ بلندگو در درس، بار اول جمله آهسته و بار دوم معمولی خوانده می‌شود.</Text>
      <Text style={s.small}>صدای خود گوشی هیچ‌وقت جای گویندهٔ انتخابی را نمی‌گیرد؛ فقط اگر پخش کلیپی به‌کلی شکست بخورد، همان یک جمله با صدای آلمانی گوشی خوانده می‌شود تا درس بی‌صدا نماند.</Text>
    </View>
  </CoursePage>;
}
