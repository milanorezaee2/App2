import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { FEATURES, MANAGEMENT_BUILD } from '@/lib/features';
import { supabase } from '@/lib/supabase';
import { loadLearnerJourney, saveLearnerJourney, type Familiarity, type JourneyGoal, type JourneyLanguage, type LearnerJourney } from '@/lib/learnerJourney';
import { useLearnerLanguageAccess } from './LearnerLanguageAccess';
import { journeyStyles as s } from './LearnerSetup';

interface JourneyContextValue {
  profile: LearnerJourney | null;
  save: (language: JourneyLanguage, familiarity: Familiarity, goal: JourneyGoal) => Promise<void>;
}
const JourneyContext = createContext<JourneyContextValue | null>(null);
export const useLearnerJourney = () => {
  const value = useContext(JourneyContext);
  if (!value) throw Error('Learner journey must be inside the authenticated journey gate.');
  return value;
};

/** Auth remains owned by RegistrationGate. Admin and no-login apps are unchanged. */
export function LearnerJourneyGate({ children }: PropsWithChildren) {
  if (MANAGEMENT_BUILD || !FEATURES.learnerLogin) return <>{children}</>;
  return <AuthenticatedJourney>{children}</AuthenticatedJourney>;
}
function AuthenticatedJourney({ children }: PropsWithChildren) {
  const access = useLearnerLanguageAccess();
  const [profile, setProfile] = useState<LearnerJourney | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const account = useRef<string | null>(null);
  const generation = useRef(0);
  const load = useCallback(async (userId?: string) => {
    const ticket = ++generation.current;
    setLoading(true); setError(''); setProfile(null);
    try {
      const id = userId ?? (await supabase.auth.getSession()).data.session?.user.id;
      if (ticket !== generation.current) return;
      if (!id) throw Error('نشست حساب در دسترس نیست. دوباره وارد شوید.');
      account.current = id;
      const saved = await loadLearnerJourney(id);
      if (ticket === generation.current) setProfile(saved);
    } catch { if (ticket === generation.current) setError('انتخاب‌های این حساب خوانده نشدند. سابقهٔ درس‌ها دست‌نخورده است.'); }
    finally { if (ticket === generation.current) setLoading(false); }
  }, []);
  useEffect(() => {
    void load();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const id = session?.user.id ?? null;
      if (id !== account.current) {
        account.current = id;
        // Do not call Supabase APIs within its auth callback (auth lock).
        if (id) void load(id);
        else { ++generation.current; setProfile(null); setLoading(true); }
      }
    });
    return () => { ++generation.current; subscription.unsubscribe(); };
  }, [load]);
  const save = async (language: JourneyLanguage, familiarity: Familiarity, goal: JourneyGoal) => {
    if (access.loadingAccess || !access.isLanguageAllowed(language)) throw Error('این زبان فعلاً فعال نیست.');
    const id = account.current;
    const { data, error: authError } = await supabase.auth.getSession();
    if (authError || !id || data.session?.user.id !== id) throw Error('حساب تغییر کرده است.');
    const next: LearnerJourney = { schemaVersion: 1, userId: id, language,
      paths: { ...profile?.paths, [language]: { familiarity, goal } }, updatedAt: new Date().toISOString() };
    await saveLearnerJourney(next);
    if (account.current !== id) throw Error('حساب تغییر کرده است.');
    setProfile(next);
  };
  if (loading) return <View style={[s.screen, { alignItems: 'center', justifyContent: 'center', gap: 16 }]}><ActivityIndicator color="#1769D2" /><Text style={s.body}>آماده‌سازی مسیر شخصی…</Text></View>;
  if (error) return <View style={[s.screen, s.content]}>
    <Text accessibilityRole="alert" style={s.error}>{error}</Text>
    <Pressable accessibilityRole="button" onPress={() => void load()} style={s.primary}><Text style={s.primaryText}>تلاش دوباره</Text></Pressable>
    {!!account.current && <Pressable accessibilityRole="button" onPress={() => { setProfile(null); setError(''); }} style={s.secondary}><Text style={s.link}>انتخاب دوبارهٔ مسیر؛ بدون تغییر سابقهٔ درس‌ها</Text></Pressable>}
    <Pressable accessibilityRole="button" onPress={() => void supabase.auth.signOut()} style={s.secondary}><Text style={s.link}>خروج از حساب</Text></Pressable>
  </View>;
  return <JourneyContext.Provider value={{ profile, save }}>{children}</JourneyContext.Provider>;
}
