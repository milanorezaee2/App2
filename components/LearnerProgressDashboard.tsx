import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { FEATURES, MANAGEMENT_BUILD } from '@/lib/features';
import { LearnerSetup, journeyStyles as s } from '@/components/LearnerSetup';
import { useLearnerJourney } from '@/components/LearnerJourneyGate';
import { useLearnerLanguageAccess } from '@/components/LearnerLanguageAccess';
import { FAMILIARITIES, JOURNEY_GOALS, isJourneyLanguage, journeyLibrary, suggestedLevel, type JourneyLanguage } from '@/lib/learnerJourney';
import { loadJourneyReport, type JourneyReport } from '@/lib/learnerProgressSummary';
import { setActiveLanguage } from '@/lib/activeLanguage';

const fa = (n: number) => n.toLocaleString('fa-IR', { maximumFractionDigits: 1 });
const dateLabel = (value: string | null) => value ? new Date(value).toLocaleDateString('fa-IR') : 'هنوز ثبت نشده';
export default function LearnerProgressDashboard() {
  const { profile, save } = useLearnerJourney();
  const access = useLearnerLanguageAccess();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [reports, setReports] = useState<JourneyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const request = useRef(0);
  const visibleLanguages = access.loadingAccess ? [] : access.allowedLanguages.filter(item => isJourneyLanguage(item.id));
  const languagesKey = visibleLanguages.map(item => item.id).join(',');
  const refresh = useCallback(async () => {
    const ticket = ++request.current;
    setLoading(true);
    const languages = languagesKey.split(',').filter(isJourneyLanguage);
    const result: JourneyReport[] = [];
    for (const language of languages) {
      if (ticket !== request.current) return;
      // Yield between curricula instead of parsing all three on one JS frame.
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      result.push(await loadJourneyReport(language));
      if (ticket === request.current) setReports([...result]);
    }
    if (ticket === request.current) setLoading(false);
  }, [languagesKey]);
  useFocusEffect(useCallback(() => {
    void refresh();
    return () => { ++request.current; };
  }, [refresh]));
  const selected = visibleLanguages.find(item => item.id === profile.language);
  const path = profile.paths[profile.language]!;
  const level = suggestedLevel(profile.language, path.familiarity);
  const selectedReport = reports.find(item => item.language === profile.language)?.data;
  const selectedLevel = selectedReport?.levels.find(item => item.id === level);
  const openLibrary = (language: JourneyLanguage, target?: number) => {
    if (access.loadingAccess || !access.isLanguageAllowed(language)) return;
    void setActiveLanguage(language);
    router.push((target === undefined ? journeyLibrary(language) : { pathname: journeyLibrary(language), params: { level: String(target) } }) as never);
  };
  const openCorridor = (language: JourneyLanguage) => {
    const meta = access.allowedLanguages.find(item => item.id === language);
    if (!meta || access.loadingAccess) return;
    void setActiveLanguage(language);
    router.push(meta.home as never);
  };
  const sync = async () => {
    if (syncing) return;
    setSyncing(true); setSyncMessage('');
    try {
      const { syncPersonalLearningData } = await import('@/lib/personalLearningSync');
      const result = await syncPersonalLearningData();
      setSyncMessage(result.status === 'synced'
        ? 'همگام‌سازی شخصی انگلیسی و آلمانی انجام شد. ترکی و انتخاب‌های مسیر در این نسخه روی همین دستگاه‌اند.'
        : 'نشست حساب در دسترس نیست؛ داده‌های محلی حفظ شدند. دوباره وارد حساب شوید.');
    } catch {
      setSyncMessage('همگام‌سازی انجام نشد؛ داده‌های محلی حفظ شدند. اتصال یا آماده‌بودن سرویس حساب را بررسی کنید.');
    } finally { setSyncing(false); await refresh(); }
  };
  if (editing) return <LearnerSetup initial={profile} onSave={async (...args) => { await save(...args); setEditing(false); }} onCancel={() => setEditing(false)} />;
  return <ScrollView style={s.screen} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}>
    <LinearGradient colors={['#102C57', '#175CA5']} style={s.hero}>
      <Text style={s.eyebrow}>MILO · MY LEARNING JOURNEY</Text>
      <Text accessibilityRole="header" style={s.heroTitle}>مسیر من، پیشرفت واقعی من</Text>
      <Text style={s.heroText}>از همین‌جا ببین چه خوانده‌ای و قدم بعدی‌ات را انتخاب کن.</Text>
    </LinearGradient>
    <View style={styles.card}>
      <Text accessibilityRole="header" style={s.title}>{access.loadingAccess ? 'در حال بررسی دسترسی به کریدور…' : selected ? `کریدور ${selected.name}` : 'زبان انتخابی فعلاً غیرفعال است'}</Text>
      <Text style={s.body}>شروع مسیر: از سطح مقدماتی</Text>
      <Text style={s.body}>هدف: {JOURNEY_GOALS.find(item => item.id === path.goal)?.title}</Text>
      {!!selectedLevel && <Text style={s.body}>سطح شروع دوره: {selectedLevel.title} · {selectedLevel.cefr}</Text>}
      <Text style={s.caption}>همه از اولین سطح شروع می‌کنند. محتوای آموزشی و سابقهٔ قبلی دست‌نخورده باقی می‌مانند.</Text>
      {selected && <>
        <Action label={`باز کردن کریدور ${selected.name}`} disabled={access.loadingAccess} onPress={() => openCorridor(profile.language)} />
        <Action label="درس‌های مقدماتی" secondary disabled={access.loadingAccess || !selectedLevel?.total} onPress={() => openLibrary(profile.language, level)} />
      </>}
      <Action label="تغییر زبان" secondary onPress={() => setEditing(true)} />
      {!selected && !access.loadingAccess && <Text style={s.body}>{access.disabledMessage}</Text>}
    </View>
    <Text accessibilityRole="header" style={s.title}>گزارش یادگیری تا امروز</Text>
    <Text style={s.body}>نمای کلی دوره‌های جمله‌محورِ زبان‌های فعال. این گزارش داده‌های ذخیره‌شدهٔ همین دستگاه را می‌خواند؛ سابقهٔ قدیمی دستگاه لزوماً مختص این حساب نیست. برای دریافت سابقهٔ حساب از دستگاه دیگر، همگام‌سازی را بزن.</Text>
    {(loading || access.loadingAccess) && <ActivityIndicator color="#1769D2" accessibilityLabel="خواندن پیشرفت ذخیره‌شده" />}
    {visibleLanguages.map(meta => {
      const report = reports.find(item => item.language === meta.id);
      const data = report?.data;
      return <View key={meta.id} style={styles.card}>
        <Text accessibilityRole="header" style={s.title}>{meta.name}</Text>
        {report?.error ? <><Text accessibilityRole="alert" style={s.error}>{report.error}</Text><Action secondary label="خواندن دوبارهٔ گزارش" onPress={() => void refresh()} /></> : data ? <>
          <View style={styles.stats}>
            <Metric value={`${fa(data.completed)} / ${fa(data.total)}`} label="درس تکمیل‌شده" />
            <Metric value={`${fa(data.percent)}٪`} label="پیشرفت دوره" />
            <Metric value={data.inProgress === null ? 'نامشخص' : fa(data.inProgress)} label="درس در جریان" />
            <Metric value={fa(data.dueReviews)} label="مرور سررسیدشده" />
          </View>
          <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: data.percent }} style={styles.track}><View style={[styles.fill, { width: `${data.percent}%` }]} /></View>
          {data.completed === 0 && data.inProgress === 0 && <Text style={s.body}>هنوز درس یا جلسه‌ای برای این دوره روی دستگاه ثبت نشده؛ از اولین درس شروع کن.</Text>}
          <Text style={s.body}>جمله‌های درس‌های تکمیل‌شده: {fa(data.coveredSentences)} · کارت‌های مرور: {fa(data.reviewCards)}</Text>
          <Text style={s.caption}>تکمیل درس یا دیدن جمله به معنی تسلط قطعی بر آن نیست.</Text>
          <Text style={s.body}>زنجیرهٔ فعال: {fa(data.currentStreak)} روز · بهترین زنجیره: {fa(data.longestStreak)} روز</Text>
          <Text style={s.body}>آخرین روز فعالیت: {dateLabel(data.lastActiveDate)}</Text>
          <Text style={s.caption}>آخرین ثبت پیشرفت دوره: {dateLabel(data.updatedAt)}</Text>
          {meta.id === 'en' ? <Text style={s.body}>زمان اندازه‌گیری‌شدهٔ دورهٔ اصلی: {data.measuredMinutes === null ? 'نامشخص' : `${fa(data.measuredMinutes)} دقیقه`} · امروز: {data.todayMeasuredMinutes === null ? 'نامشخص' : `${fa(data.todayMeasuredMinutes)} دقیقه`}</Text> : <Text style={s.caption}>زمان مطالعهٔ اندازه‌گیری‌شده برای این دوره در دسترس نیست؛ از تعداد درس، زمان یا تسلط تخمین نمی‌زنیم.</Text>}
          {data.legacyMinutes > 0 && <Text style={s.caption}>زمان ذخیره‌شدهٔ قدیمی: {fa(data.legacyMinutes)} دقیقه؛ ممکن است برآورد نسخه‌های قبلی باشد و با زمان اندازه‌گیری‌شده جمع نمی‌شود.</Text>}
          {data.warnings.map(warning => <Text key={warning} accessibilityRole="alert" style={s.error}>{warning}</Text>)}
          <Text style={styles.sectionTitle}>پیشرفت هر سطح</Text>
          {data.levels.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${item.title}؛ ${fa(item.completed)} از ${fa(item.total)} درس`} onPress={() => openLibrary(report!.language, item.id)} style={styles.levelRow}>
            <Text style={[s.body, { flex: 1 }]}>{item.title} · {item.cefr}</Text><Text style={styles.count}>{fa(item.completed)} / {fa(item.total)}</Text>
          </Pressable>)}
          <Action secondary label={`درس‌ها، کارگاه‌ها و جزئیات ${meta.name}`} disabled={access.loadingAccess} onPress={() => openCorridor(report!.language)} />
        </> : !loading ? <Text style={s.body}>گزارش هنوز آماده نیست؛ صفحه را تازه کن.</Text> : null}
      </View>;
    })}
    {access.allDisabledByAdmin && <Text style={s.body}>{access.disabledMessage}</Text>}
    <View style={s.notice}>
      <Text style={s.title}>داده‌ها از کجا آمده‌اند؟</Text>
      <Text style={s.body}>عددهای بالا از تکمیل درس، جلسه‌های ذخیره‌شده و کارت‌های مرور دوره‌های جمله‌محور می‌آیند. جزئیات کارگاه‌های مستقل، تمرین تلفظ و فعالیت‌های تکمیلی در بخش‌های خودشان داخل هر کریدور باقی می‌مانند و به این درصد اضافه نمی‌شوند.</Text>
      <Text style={s.body}>همگام‌سازی شخصیِ موجود برای انگلیسی و آلمانی است؛ ترکی و انتخاب‌های مسیر فعلاً روی دستگاه‌اند. خروج از حساب یا تغییر زبان، سابقهٔ درس‌ها را پاک نمی‌کند. این گزارش را با گواهی تسلط یا نسخهٔ پشتیبان اشتباه نگیر.</Text>
      <Action label={syncing ? 'در حال همگام‌سازی…' : 'همگام‌سازی سابقهٔ انگلیسی و آلمانی'} disabled={syncing} onPress={() => void sync()} />
      {!!syncMessage && <Text accessibilityRole="alert" style={s.body}>{syncMessage}</Text>}
      <Action secondary label="حساب من و خروج" onPress={() => router.push('/personal-sync' as never)} />
      <Action secondary label="دیدن همهٔ زبان‌های فعال" onPress={() => router.push('/languages' as never)} />
      <Action secondary label="تازه‌سازی گزارش محلی" disabled={loading} onPress={() => void refresh()} />
    </View>
  </ScrollView>;
}
function Action({ label, onPress, secondary, disabled = false }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[secondary ? s.secondary : s.primary, disabled && s.disabled]}><Text style={secondary ? s.link : s.primaryText}>{label}</Text></Pressable>;
}
function Metric({ value, label }: { value: string; label: string }) {
  return <View style={styles.metric}><Text style={styles.value}>{value}</Text><Text style={s.caption}>{label}</Text></View>;
}
const styles = StyleSheet.create({
  card: { padding: 20, borderRadius: 24, borderWidth: 1, borderColor: '#DEE7F3', backgroundColor: '#FFFFFF', gap: 12 },
  stats: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  metric: { minWidth: 118, flexGrow: 1, flexBasis: '45%', borderRadius: 16, backgroundColor: '#F2F6FC', padding: 14, alignItems: 'flex-end', gap: 4 },
  value: { fontFamily: 'Vazir-Black', fontSize: 22, color: '#154D8B', textAlign: 'right' },
  track: { height: 7, backgroundColor: '#E2EAF5', borderRadius: 5, overflow: 'hidden', alignItems: 'flex-end' },
  fill: { height: 7, backgroundColor: '#158E87', borderRadius: 5 },
  sectionTitle: { fontFamily: 'Vazir-Bold', fontSize: 16, textAlign: 'right', color: '#102C57', marginTop: 8 },
  levelRow: { flexDirection: 'row-reverse', gap: 12, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#EBF0F7', minHeight: 52 },
  count: { fontFamily: 'Vazir-Bold', color: '#175BA4', fontSize: 14 },
});
