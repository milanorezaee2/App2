import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, InteractionManager, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useLearnerLanguageAccess } from '@/components/LearnerLanguageAccess';
import { setActiveLanguage } from '@/lib/activeLanguage';
import { FEATURES, MANAGEMENT_BUILD } from '@/lib/features';
import type { LanguageId } from '@/lib/languages/types';
import { Typography } from '@/lib/theme';

const FAMILIARITY_ANSWERS = ['تازه شروع می‌کنم', 'چند کلمه و جمله بلدم', 'تا حدی می‌توانم صحبت کنم'] as const;

/** Entry questions only: never place learners, reorder lessons or write progress. */
export default function LearningEntryRoute() {
  if (MANAGEMENT_BUILD || !FEATURES.learnerLogin) return <Redirect href="/languages" />;
  return <LearningEntry />;
}

function LearningEntry() {
  const router = useRouter();
  const access = useLearnerLanguageAccess();
  const [language, setLanguage] = useState<LanguageId | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const opening = useRef(false);
  const alive = useRef(true);
  const currentAccess = useRef(access);
  currentAccess.current = access;
  const selected = access.allowedLanguages.find(item => item.id === language);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  useEffect(() => {
    if (!access.loadingAccess && language && !access.isLanguageAllowed(language)) setLanguage(null);
  }, [access.loadingAccess, access.isLanguageAllowed, language]);

  // Load only the chosen route module while the learner reads question two.
  // Importing a module does not mount its screen or read/write learning records.
  useEffect(() => {
    if (!language) return;
    const task = InteractionManager.runAfterInteractions(() => {
      const warm = language === 'en' ? import('./lang/index')
        : language === 'de' ? import('../components/GermanSentenceHome')
        : import('../components/TurkishHome');
      void warm.catch(() => undefined);
    });
    return () => task.cancel();
  }, [language]);

  const answerFamiliarity = async (_answer: typeof FAMILIARITY_ANSWERS[number]) => {
    if (!selected || opening.current || access.loadingAccess || !access.isLanguageAllowed(selected.id)) return;
    opening.current = true; setBusy(true); setError('');
    try {
      // Familiarity is self-report only, not a placement decision. Every answer
      // leads to exactly the same existing home for the selected language.
      void setActiveLanguage(selected.id);
      if (!alive.current) return;
      if (currentAccess.current.loadingAccess || !currentAccess.current.isLanguageAllowed(selected.id)) throw Error('Language access changed');
      router.replace(selected.home as never);
    } catch {
      if (alive.current) setError('باز کردن بخش زبان انجام نشد؛ دوباره تلاش کن. سابقهٔ درس‌ها حفظ شده است.');
    } finally {
      opening.current = false;
      if (alive.current) setBusy(false);
    }
  };

  return <ScrollView style={s.screen} contentContainerStyle={s.content}>
    <View style={s.card}>
      <Text style={s.step}>{selected ? '۲ از ۲' : '۱ از ۲'}</Text>
      <Text accessibilityRole="header" style={s.title}>{selected ? 'چقدر با این زبان آشنایی داری؟' : 'چه زبانی می‌خواهی یاد بگیری؟'}</Text>
      {access.loadingAccess ? <ActivityIndicator accessibilityLabel="بررسی زبان‌های فعال" color="#1769D2" /> : selected ? <>
        <Text style={s.body}>{selected.name} · {selected.nativeName}</Text>
        <Text style={s.body}>پاسخت فقط میزان آشنایی‌ات را بیان می‌کند؛ درس‌ها، ترتیب و سابقه‌ات تغییر نمی‌کنند.</Text>
        {FAMILIARITY_ANSWERS.map(answer => <Pressable key={answer} accessibilityRole="button" disabled={busy} accessibilityState={{ disabled: busy }} onPress={() => void answerFamiliarity(answer)} style={[s.choice, busy && s.disabled]}><Text style={s.choiceText}>{answer}</Text></Pressable>)}
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setLanguage(null); setError(''); }} style={s.back}><Text style={s.link}>بازگشت به انتخاب زبان</Text></Pressable>
      </> : access.allowedLanguages.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`انتخاب زبان ${item.name}`} onPress={() => { setLanguage(item.id); setError(''); }} style={s.choice}><Text style={s.choiceText}>{item.name} · {item.nativeName}</Text></Pressable>)}
      {access.allDisabledByAdmin && <><Text accessibilityRole="alert" style={s.body}>{access.disabledMessage}</Text><Pressable accessibilityRole="button" onPress={() => void access.refreshAccess()} style={s.back}><Text style={s.link}>بررسی دوبارهٔ زبان‌ها</Text></Pressable></>}
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      {busy && <ActivityIndicator accessibilityLabel="ورود به بخش زبان انتخابی" color="#1769D2" />}
    </View>
  </ScrollView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F8FD' },
  content: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 500, alignSelf: 'center', backgroundColor: '#FFFFFF', borderRadius: 24, padding: 22, gap: 16, borderWidth: 1, borderColor: '#D7E7FA' },
  step: { fontFamily: Typography.fontFamily, fontSize: 13, color: '#64748B', textAlign: 'right' },
  title: { fontFamily: Typography.boldFontFamily, fontSize: 23, lineHeight: 36, color: '#102A56', textAlign: 'right', writingDirection: 'rtl' },
  body: { fontFamily: Typography.fontFamily, fontSize: 14, lineHeight: 25, color: '#475569', textAlign: 'right', writingDirection: 'rtl' },
  choice: { borderWidth: 1, borderColor: '#BBD3EF', backgroundColor: '#F4F8FD', borderRadius: 16, padding: 16, minHeight: 54, justifyContent: 'center' },
  choiceText: { fontFamily: Typography.boldFontFamily, fontSize: 15, lineHeight: 26, color: '#133F78', textAlign: 'right', writingDirection: 'rtl' },
  disabled: { opacity: 0.55 },
  back: { minHeight: 44, justifyContent: 'center' },
  link: { fontFamily: Typography.boldFontFamily, color: '#1769D2', textAlign: 'right' },
  error: { fontFamily: Typography.fontFamily, color: '#B42318', textAlign: 'right', lineHeight: 24 },
});
