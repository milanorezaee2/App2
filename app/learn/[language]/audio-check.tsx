import { useCallback, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { GermanCourseButton as CourseButton, GermanCoursePage as CoursePage, germanCourseStyles as s } from '@/components/GermanCourseUI';
import { A1_AUDIO_SAMPLES, AUDIO_OBSERVATIONS, audioCheckReport, type AudioObservation } from '@/lib/languages/a1AudioCheck';
import {
  germanSpeechSupport,
  listGermanVoices,
  loadGermanVoicePreference,
  setGermanVoicePreference,
  speakGerman,
  stopGermanSpeech,
} from '@/lib/germanSpeech';
import { selectBestVoiceForLocale, type SpeechVoiceInfo } from '@/lib/speechLanguage';

const NO_VOICE_MESSAGE = 'صدای آلمانی پیدا نشد. در Chrome یا Edge، در بخش زبان‌های سیستم زبان Deutsch را اضافه کنید؛ روی گوشی، بستهٔ گفتار آلمانی (Google TTS / صدای آلمانی) را نصب کنید و سپس دوباره بررسی کنید. درس بدون صدا هم خواندنی می‌ماند.';

export default function AudioCheck() {
  const { language } = useLocalSearchParams<{ language: string }>();
  const [voices, setVoices] = useState<SpeechVoiceInfo[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [voiceError, setVoiceError] = useState('');
  const [status, setStatus] = useState('هنوز پخش درخواست نشده است.');
  const [active, setActive] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [observations, setObservations] = useState<Partial<Record<string, AudioObservation>>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef(0);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const finish = (message: string) => {
    request.current += 1;
    clearTimer();
    setActive(null);
    setStatus(message);
  };

  const loadVoices = useCallback(() => {
    setLoading(true);
    setVoiceError('');
    setObservations({});
    void Promise.all([listGermanVoices(), loadGermanVoicePreference(), germanSpeechSupport()])
      .then(([available, preference, support]) => {
        setVoices(available);
        const chosen = available.find(voice => voice.identifier === preference)
          ?? available.find(voice => voice.name === support.voiceName)
          ?? selectBestVoiceForLocale(available, 'de-DE')
          ?? available[0];
        setSelected(chosen?.identifier ?? '');
        if (!available.length) setVoiceError(NO_VOICE_MESSAGE);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setVoiceError('خواندن فهرست صداها ممکن نشد؛ مرورگر یا تنظیمات گفتار دستگاه را بررسی کنید و دوباره تلاش کنید.');
      });
  }, []);

  useFocusEffect(useCallback(() => {
    loadVoices();
    return () => {
      request.current += 1;
      if (timer.current) clearTimeout(timer.current);
      void stopGermanSpeech();
    };
  }, [loadVoices]));

  if (language !== 'de') return <CoursePage title="بررسی صدا پیدا نشد">{null}</CoursePage>;

  const voiceName = voices.find(voice => voice.identifier === selected)?.name ?? '';

  const chooseVoice = (voice: SpeechVoiceInfo) => {
    setSelected(voice.identifier);
    setGermanVoicePreference(voice.identifier);
    setObservations({});
    setStatus(`صدای «${voice.name}» انتخاب شد و برای همهٔ درس‌های آلمانی ذخیره شد.`);
  };

  const play = (id: string, text: string) => {
    const current = ++request.current;
    clearTimer();
    setActive(id);
    setStatus('درخواست پخش ارسال شد؛ هنوز شروع آن گزارش نشده است.');
    const valid = () => request.current === current;
    // Bounded wait: a speech engine that never fires a callback must not leave
    // the screen blocked forever.
    timer.current = setTimeout(() => {
      if (!valid()) return;
      finish('موتور گفتار پاسخ نداد؛ توقف و تلاش دوباره را امتحان کنید.');
      void stopGermanSpeech();
    }, 12000);
    speakGerman({
      text,
      rate: 0.78,
      onStart: () => {
        if (!valid()) return;
        clearTimer();
        setStatus('موتور گفتار شروع پخش را گزارش کرد؛ فقط شما می‌توانید شنیده‌شدن آن را تأیید کنید.');
        timer.current = setTimeout(() => {
          if (valid()) finish('پایان پخش گزارش نشد؛ پخش متوقف شد.');
        }, 45000);
      },
      onDone: () => {
        if (valid()) finish('موتور گفتار پایان پخش را گزارش کرد؛ این پیام تأیید کیفیت تلفظ نیست.');
      },
      onError: reason => {
        if (!valid()) return;
        if (reason === 'unsupported') finish(NO_VOICE_MESSAGE);
        else finish('پخش ناموفق بود. بلندی صدا، حالت بی‌صدا و صدای آلمانی دستگاه را بررسی کنید و دوباره تلاش کنید.');
      },
    });
  };

  const stop = () => {
    request.current += 1;
    clearTimer();
    void stopGermanSpeech();
    setActive(null);
    setStatus('پخش متوقف شد؛ شنیده‌شدن صدا تأیید نشده است.');
  };

  return <CoursePage title="بررسی و انتخاب صدای آلمانی" subtitle="آزمون روی دستگاه شما • بدون نمره یا ضبط میکروفن" back="/learn/de">
    <Text style={s.notice}>بلندی صدا را بالا ببرید و حالت بی‌صدا را بررسی کنید. صدا از موتور گفتار دستگاه/مرورگر می‌آید؛ آفلاین‌بودن به تنظیمات آن بستگی دارد. پیدا‌شدن صدا یا پیام «پایان پخش» ثابت نمی‌کند که تلفظ درست یا صدا شنیده شده است.</Text>

    <View style={s.card}>
      <Text style={s.heading}>۱. صدای آلمانی</Text>
      {loading && <Text style={s.small}>در حال خواندن صداهای آلمانی…</Text>}
      {!!voiceError && <Text accessibilityRole="alert" style={s.error}>{voiceError}</Text>}
      {!loading && !voices.length && <Text style={s.small}>پس از نصب زبان آلمانی، دکمهٔ «دوباره صداها را بررسی کن» را بزنید.</Text>}
      {voices.map(voice => <View key={voice.identifier} style={{ gap: 2 }}>
        <CourseButton
          title={`${voice.identifier === selected ? 'انتخاب‌شده: ' : 'انتخاب: '}${voice.name} (${voice.language})`}
          secondary
          disabled={active !== null}
          onPress={() => chooseVoice(voice)}
        />
        <Text style={s.small}>{voice.localService === false ? 'صدای شبکه‌ای مرورگر/سیستم؛ نیازمند اینترنت در برخی دستگاه‌ها' : 'صدای نصب‌شده روی همین دستگاه'}</Text>
      </View>)}
      <CourseButton title="دوباره صداها را بررسی کن" secondary disabled={active !== null || loading} onPress={loadVoices} />
      {!!voiceName && <Text style={s.small}>صدای فعلی درس‌ها: {voiceName}</Text>}
    </View>

    <Text accessibilityLiveRegion="polite" style={s.description}>{status}</Text>
    <CourseButton title="توقف پخش" secondary onPress={stop} />

    <Text style={s.heading}>۲. ابتدا بشنوید، سپس متن را مقایسه کنید</Text>
    {A1_AUDIO_SAMPLES.map(sample => <View key={sample.id} style={s.card}>
      <Text style={s.heading}>{sample.title}</Text>
      <CourseButton title={`پخش: ${sample.title}`} disabled={!selected || active !== null} onPress={() => play(sample.id, sample.text)} />
      <CourseButton title={`${revealed[sample.id] ? 'بستن' : 'نمایش'} متن: ${sample.title}`} secondary onPress={() => setRevealed(value => ({ ...value, [sample.id]: !value[sample.id] }))} />
      {revealed[sample.id] && <>
        <Text style={s.target}>{sample.text}</Text>
        <Text style={s.description}>{sample.expected}</Text>
      </>}
      <Text style={s.small}>گزارش خود شما، نه تشخیص برنامه:</Text>
      {(Object.entries(AUDIO_OBSERVATIONS) as [AudioObservation, string][]).map(([id, label]) =>
        <Pressable
          key={id}
          accessibilityRole="radio"
          accessibilityLabel={`${sample.title}: ${label}`}
          accessibilityState={{ checked: observations[sample.id] === id }}
          aria-checked={observations[sample.id] === id}
          disabled={!selected || active !== null}
          onPress={() => setObservations(value => ({ ...value, [sample.id]: id }))}
          style={{ padding: 12, borderWidth: 1, borderColor: '#dde3ea', borderRadius: 8 }}
        >
          <Text style={s.description}>{observations[sample.id] === id ? '● ' : '○ '}{label}</Text>
        </Pressable>)}
    </View>)}

    <View style={s.card}>
      <Text style={s.heading}>۳. گزارش برای ارسال</Text>
      <Text style={s.small}>این گزارش خودکار ذخیره یا ارسال نمی‌شود. متن زیر را انتخاب و کپی کنید؛ نام مدل گوشی و مرورگر را موقع ارسال اضافه کنید. تغییر صدا یا بارگذاری مجدد گزارش را پاک می‌کند. نتیجه‌ای به نمره درس اضافه نمی‌شود.</Text>
      <Text selectable style={s.description}>{audioCheckReport(voiceName, observations)}</Text>
    </View>
  </CoursePage>;
}
