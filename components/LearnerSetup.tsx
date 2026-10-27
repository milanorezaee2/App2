import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLearnerLanguageAccess } from '@/components/LearnerLanguageAccess';
import { Typography } from '@/lib/theme';
import {
  isJourneyLanguage,
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
  const [language, setLanguage] = useState<JourneyLanguage | null>(initial?.language ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const scroll = useRef<ScrollView>(null);
  const allowed = language !== null && languages.some(item => item.id === language);
  const valid = allowed;
  const chooseLanguage = (value: JourneyLanguage) => setLanguage(value);
  const finish = async () => {
    if (!language || !allowed || busy) return;
    setBusy(true); setError('');
    try { await onSave(language, 'new', 'daily'); }
    catch { setError('انتخاب‌ها ذخیره نشدند. اتصال یا فضای ذخیره‌سازی را بررسی و دوباره تلاش کنید؛ سابقهٔ درس‌ها تغییر نکرد.'); }
    finally { setBusy(false); }
  };
  return <ScrollView ref={scroll} style={s.screen} contentContainerStyle={s.content}>
    <LinearGradient colors={['#102C57', '#175CA5']} style={s.hero}>
      <Text style={s.eyebrow}>MILO · YOUR LEARNING JOURNEY</Text>
      <Text style={s.heroTitle}>مسیر یادگیریِ خودت</Text>
      <Text style={s.heroText}>فقط زبان را انتخاب کن؛ مسیر همه از اولین درس شروع می‌شود.</Text>
    </LinearGradient>
    <Text accessibilityRole="header" style={s.title}>چه زبانی می‌خواهی یاد بگیری؟</Text>
    {access.loadingAccess ? <ActivityIndicator color="#1769D2" accessibilityLabel="بررسی زبان‌های فعال" /> : languages.length === 0 ? <View style={s.notice}>
      <Text style={s.body}>{access.disabledMessage}</Text>
      <Pressable accessibilityRole="button" onPress={() => void access.refreshAccess()} style={s.secondary}><Text style={s.link}>بررسی دوبارهٔ زبان‌ها</Text></Pressable>
    </View> : <>
      {languages.map(item => <Choice key={item.id} title={item.name} description={`${item.nativeName} · شروع از اولین درس`} selected={language === item.id} disabled={busy} onPress={() => { if (isJourneyLanguage(item.id)) chooseLanguage(item.id); }} />)}
      <Text style={s.body}>بدون سؤال تعیین سطح، از سطح مقدماتی و درس اول شروع می‌کنیم. متن، تعداد جمله‌ها و ترتیب درس‌ها تغییری نمی‌کند. سابقهٔ قبلی پاک نمی‌شود.</Text>
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || !valid }} disabled={busy || !valid} onPress={() => void finish()} style={[s.primary, (busy || !valid) && s.disabled]}>
        {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.primaryText}>شروع از اولین درس</Text>}
      </Pressable>
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
