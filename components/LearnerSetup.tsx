import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLearnerLanguageAccess } from '@/components/LearnerLanguageAccess';
import { Typography } from '@/lib/theme';
import {
  FAMILIARITIES, JOURNEY_GOALS, isJourneyLanguage, suggestedLevel,
  type Familiarity, type JourneyGoal, type JourneyLanguage, type LearnerJourney,
} from '@/lib/learnerJourney';

export function LearnerSetup({ initial, onSave, onCancel, onSignOut }: {
  initial: LearnerJourney | null;
  onSave: (language: JourneyLanguage, familiarity: Familiarity, goal: JourneyGoal) => Promise<void>;
  onCancel?: () => void;
  onSignOut?: () => void;
}) {
  const access = useLearnerLanguageAccess();
  const languages = access.allowedLanguages.filter(item => isJourneyLanguage(item.id));
  const [step, setStep] = useState(0);
  const [language, setLanguage] = useState<JourneyLanguage | null>(initial?.language ?? null);
  const [familiarity, setFamiliarity] = useState<Familiarity | null>(initial ? initial.paths[initial.language]?.familiarity ?? null : null);
  const [goal, setGoal] = useState<JourneyGoal | null>(initial ? initial.paths[initial.language]?.goal ?? null : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const scroll = useRef<ScrollView>(null);
  const allowed = language !== null && languages.some(item => item.id === language);
  const valid = allowed && (step === 0 || familiarity !== null) && (step < 2 || goal !== null);
  const selected = languages.find(item => item.id === language);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [step]);
  // A realtime administrative revocation must also invalidate the confirmation.
  useEffect(() => { if (!access.loadingAccess && language && !allowed) setStep(0); }, [access.loadingAccess, allowed, language]);
  const chooseLanguage = (value: JourneyLanguage) => {
    if (value !== language) {
      setLanguage(value); setFamiliarity(initial?.paths[value]?.familiarity ?? null); setGoal(initial?.paths[value]?.goal ?? null);
    }
  };
  const finish = async () => {
    if (!language || !familiarity || !goal || !allowed || busy) return;
    setBusy(true); setError('');
    try { await onSave(language, familiarity, goal); }
    catch { setError('انتخاب‌ها ذخیره نشدند. اتصال یا فضای ذخیره‌سازی را بررسی و دوباره تلاش کنید؛ سابقهٔ درس‌ها تغییر نکرد.'); }
    finally { setBusy(false); }
  };
  const titles = ['دوست داری چه زبانی یاد بگیری؟', 'چقدر با این زبان آشنایی داری؟', 'برای چه چیزی یاد می‌گیری؟', 'کریدور یادگیری تو آماده است'];
  return <ScrollView ref={scroll} style={s.screen} contentContainerStyle={s.content}>
    <LinearGradient colors={['#102C57', '#175CA5']} style={s.hero}>
      <Text style={s.eyebrow}>MILO · YOUR LEARNING JOURNEY</Text>
      <Text style={s.heroTitle}>مسیر یادگیریِ خودت</Text>
      <Text style={s.heroText}>سه انتخاب ساده؛ بعد، یک تصویر روشن از یادگیری تا امروز.</Text>
      <View style={s.steps}>{[0, 1, 2, 3].map(index => <View key={index} style={[s.step, index <= step && s.stepActive]} />)}</View>
      <Text style={s.heroText}>مرحلهٔ {String(step + 1).replace(/\d/g, n => '۰۱۲۳۴۵۶۷۸۹'[Number(n)])} از ۴</Text>
    </LinearGradient>
    <Text accessibilityRole="header" style={s.title}>{titles[step]}</Text>
    {access.loadingAccess ? <ActivityIndicator color="#1769D2" accessibilityLabel="بررسی زبان‌های فعال" /> : languages.length === 0 ? <View style={s.notice}>
      <Text style={s.body}>{access.disabledMessage}</Text>
      <Pressable accessibilityRole="button" onPress={() => void access.refreshAccess()} style={s.secondary}><Text style={s.link}>بررسی دوبارهٔ زبان‌ها</Text></Pressable>
    </View> : <>
      {step === 0 && languages.map(item => <Choice key={item.id} title={item.name} description={`${item.nativeName} · ${item.lessonsCount} درس موجود`} selected={language === item.id} disabled={busy} onPress={() => { if (isJourneyLanguage(item.id)) chooseLanguage(item.id); }} />)}
      {step === 1 && <><Text style={s.body}>زبان انتخابی: {selected?.name}. این خودارزیابی است، نه آزمون یا مدرک سطح.</Text>{FAMILIARITIES.map(item => <Choice key={item.id} {...item} selected={familiarity === item.id} disabled={busy} onPress={() => setFamiliarity(item.id)} />)}</>}
      {step === 2 && <><Text style={s.body}>هدف برای شخصی‌سازی مسیر ثبت می‌شود؛ محتوای درس‌ها و ترتیب آموزشی تغییر نمی‌کند.</Text>{JOURNEY_GOALS.map(item => <Choice key={item.id} {...item} selected={goal === item.id} disabled={busy} onPress={() => setGoal(item.id)} />)}</>}
      {step === 3 && <View style={s.notice}>
        <Text style={s.title}>{selected?.name}</Text>
        <Text style={s.body}>{FAMILIARITIES.find(item => item.id === familiarity)?.title}</Text>
        <Text style={s.body}>هدف: {JOURNEY_GOALS.find(item => item.id === goal)?.title}</Text>
        <Text style={s.body}>مسیر پیشنهادی: مرحلهٔ {language && familiarity ? String(suggestedLevel(language, familiarity) + 1).replace(/\d/g, n => '۰۱۲۳۴۵۶۷۸۹'[Number(n)]) : '—'} از دورهٔ موجود؛ نام دقیق سطح و پیشرفت واقعی را در صفحهٔ بعد می‌بینی.</Text>
        <Text style={s.body}>انتخاب سطح، هیچ درسی را تکمیل‌شده حساب نمی‌کند و هیچ سابقه‌ای را پاک نمی‌کند. می‌توانی هر زمان مسیرت را تغییر بدهی.</Text>
        <Text style={s.caption}>انتخاب‌ها برای همین حساب روی این دستگاه ذخیره می‌شوند؛ دورهٔ موجود لزوماً معادل سطح واقعی یا مدرک زبان شما نیست.</Text>
      </View>}
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || !valid }} disabled={busy || !valid} onPress={() => step < 3 ? setStep(value => value + 1) : void finish()} style={[s.primary, (busy || !valid) && s.disabled]}>
        {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.primaryText}>{step === 3 ? 'ورود به کریدور و دیدن پیشرفت من' : 'ادامه'}</Text>}
      </Pressable>
      {step > 0 && <Pressable accessibilityRole="button" disabled={busy} onPress={() => setStep(value => value - 1)} style={s.secondary}><Text style={s.link}>مرحلهٔ قبل</Text></Pressable>}
    </>}
    {onSignOut && <Pressable accessibilityRole="button" disabled={busy} onPress={onSignOut} style={s.secondary}><Text style={s.link}>خروج از حساب</Text></Pressable>}
    {onCancel && <Pressable accessibilityRole="button" disabled={busy} onPress={onCancel} style={s.secondary}><Text style={s.link}>انصراف؛ برگشت به گزارش</Text></Pressable>}
  </ScrollView>;
}

function Choice({ title, description, selected, disabled, onPress }: { title: string; description: string; selected: boolean; disabled: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ selected, checked: selected, disabled }} disabled={disabled} onPress={onPress} style={[s.choice, selected && s.chosen]}>
    <View style={s.choiceHeading}><View style={[s.radio, selected && s.radioSelected]} /><Text style={s.choiceTitle}>{title}</Text></View>
    <Text style={s.body}>{description}</Text>
  </Pressable>;
}

export const journeyStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F7FC' },
  content: { padding: 20, paddingBottom: 42, gap: 16, width: '100%', maxWidth: 720, alignSelf: 'center' },
  hero: { borderRadius: 26, padding: 24, gap: 12 },
  eyebrow: { fontFamily: 'Inter-SemiBold', color: '#B9D8FF', fontSize: 11, letterSpacing: 1.5 },
  heroTitle: { fontFamily: Typography.boldFontFamily, color: '#FFFFFF', fontSize: 27, textAlign: 'right' },
  heroText: { fontFamily: Typography.fontFamily, color: '#E1EDFF', fontSize: 14, lineHeight: 25, textAlign: 'right' },
  title: { fontFamily: Typography.boldFontFamily, fontSize: 21, color: '#102C57', textAlign: 'right', lineHeight: 34 },
  body: { fontFamily: Typography.fontFamily, color: '#415672', fontSize: 14, lineHeight: 26, textAlign: 'right' },
  caption: { fontFamily: Typography.fontFamily, color: '#64748B', fontSize: 12, lineHeight: 23, textAlign: 'right' },
  notice: { backgroundColor: '#EAF2FF', padding: 20, borderRadius: 22, gap: 10 },
  choice: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#DCE5F1', borderRadius: 20, padding: 18, gap: 8, minHeight: 100 },
  chosen: { backgroundColor: '#EDF5FF', borderColor: '#1769D2' },
  choiceHeading: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  choiceTitle: { fontFamily: Typography.boldFontFamily, fontSize: 16, color: '#102C57', flex: 1, textAlign: 'right', lineHeight: 28 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#9DAFC7' },
  radioSelected: { borderWidth: 6, borderColor: '#1769D2' },
  steps: { flexDirection: 'row-reverse', gap: 8 }, step: { height: 4, flex: 1, borderRadius: 3, backgroundColor: '#6684A9' }, stepActive: { backgroundColor: '#93DAD3' },
  primary: { backgroundColor: '#1769D2', minHeight: 54, borderRadius: 17, alignItems: 'center', justifyContent: 'center', padding: 14 },
  primaryText: { fontFamily: Typography.boldFontFamily, color: '#FFFFFF', fontSize: 15, textAlign: 'center', lineHeight: 25 },
  secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center', padding: 10 },
  link: { fontFamily: Typography.boldFontFamily, color: '#175BA4', fontSize: 14, textAlign: 'center', lineHeight: 25 },
  disabled: { opacity: .45 }, error: { fontFamily: Typography.fontFamily, color: '#AB2738', textAlign: 'right', lineHeight: 25 },
});
const s = journeyStyles;
