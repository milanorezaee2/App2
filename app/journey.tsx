import { useRef, useState, type ComponentType } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { FEATURES, MANAGEMENT_BUILD } from '@/lib/features';
import { useLearnerJourney } from '@/components/LearnerJourneyGate';
import { useLearnerLanguageAccess } from '@/components/LearnerLanguageAccess';
import { journeyStyles as s } from '@/components/LearnerSetup';
import { isJourneyLanguage, journeyLibrary, type JourneyLanguage } from '@/lib/learnerJourney';
import { setActiveLanguage } from '@/lib/activeLanguage';

export default function JourneyRoute() {
  if (MANAGEMENT_BUILD || !FEATURES.learnerLogin) return <Redirect href="/languages" />;
  return <QuickLanguageEntry />;
}

/** Startup contains metadata only. Reports and curricula load only on demand. */
function QuickLanguageEntry() {
  const { profile, save } = useLearnerJourney();
  const access = useLearnerLanguageAccess();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<ComponentType | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const opening = useRef(false);
  const choose = async (language: JourneyLanguage) => {
    if (opening.current || access.loadingAccess || !access.isLanguageAllowed(language)) return;
    opening.current = true; setBusy(true); setError('');
    try {
      await save(language, 'new', 'daily');
      await setActiveLanguage(language);
      router.push({ pathname: journeyLibrary(language), params: { level: '0' } } as never);
    } catch { setError('باز کردن مسیر انجام نشد؛ دوباره تلاش کن. هیچ سابقه‌ای پاک نشده است.'); }
    finally { opening.current = false; setBusy(false); }
  };
  const showReport = async () => {
    if (loadingReport) return;
    setLoadingReport(true); setError('');
    try {
      const module = await import('@/components/LearnerProgressDashboard');
      setReport(() => module.default);
    } catch { setError('گزارش باز نشد؛ انتخاب زبان و درس‌ها همچنان در دسترس‌اند.'); }
    finally { setLoadingReport(false); }
  };
  if (report) {
    const Report = report;
    return <View style={s.screen}>
      <Pressable accessibilityRole="button" style={s.secondary} onPress={() => setReport(null)}><Text style={s.link}>بازگشت به انتخاب سریع زبان</Text></Pressable>
      <Report />
    </View>;
  }
  return <ScrollView style={s.screen} contentContainerStyle={s.content}>
    <View style={[s.hero, { backgroundColor: '#133F78' }]}>
      <Text accessibilityRole="header" style={s.heroTitle}>زبانت را انتخاب کن؛ از صفر شروع کن</Text>
      <Text style={s.heroText}>بدون تعیین سطح و سؤال اضافی. مسیر هر زبان از درس اولِ سطح مقدماتی باز می‌شود.</Text>
    </View>
    {access.loadingAccess ? <ActivityIndicator accessibilityLabel="بررسی زبان‌های فعال" color="#1769D2" /> : access.allowedLanguages.filter(item => isJourneyLanguage(item.id)).map(item => <Pressable
      key={item.id} accessibilityRole="button" accessibilityLabel={`شروع ${item.name} از درس اول`}
      disabled={busy} accessibilityState={{ disabled: busy }} onPress={() => { if (isJourneyLanguage(item.id)) void choose(item.id); }}
      style={[s.choice, item.id === profile.language && s.chosen, busy && s.disabled]}>
      <Text style={s.choiceTitle}>{item.name} · {item.nativeName}</Text>
      <Text style={s.body}>شروع از درس اول · بدون تغییر محتوا</Text>
    </Pressable>)}
    {access.allDisabledByAdmin && <><Text style={s.body}>{access.disabledMessage}</Text><Pressable accessibilityRole="button" style={s.secondary} onPress={() => void access.refreshAccess()}><Text style={s.link}>بررسی دوبارهٔ زبان‌ها</Text></Pressable></>}
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {busy && <ActivityIndicator accessibilityLabel="باز کردن مسیر مقدماتی" color="#1769D2" />}
    <Text style={s.caption}>شروع از مقدماتی، سابقهٔ درس‌های قبلی را پاک یا دست‌کاری نمی‌کند. گزارش فقط وقتی بخواهی بارگذاری می‌شود.</Text>
    <Pressable accessibilityRole="button" disabled={loadingReport} style={s.secondary} onPress={() => void showReport()}><Text style={s.link}>{loadingReport ? 'آماده‌سازی گزارش…' : 'دیدن گزارش پیشرفت قبلی'}</Text></Pressable>
    <Pressable accessibilityRole="button" style={s.secondary} onPress={() => router.push('/personal-sync' as never)}><Text style={s.link}>حساب من و همگام‌سازی</Text></Pressable>
  </ScrollView>;
}
