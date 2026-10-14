import { type PropsWithChildren, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import { BookOpenCheck, LogIn, ShieldCheck, UserPlus } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { KeyboardAwareScrollView, KeyboardAvoidingView } from '@/components/KeyboardRuntime';
import { generateLoginCode, getRegisteredSession, loginLearner, registerLearner, registrationError, touchLearnerActivity } from '@/lib/userRegistration';
import { Colors, Radius, Spacing, Typography } from '@/lib/theme';

const IS_ADMIN_APP = Constants.expoConfig?.extra?.appRole === 'admin'
  || process.env.EXPO_PUBLIC_MILO_ADMIN_APP === 'true';

type Mode = 'register' | 'login';

export function RegistrationGate({ children }: PropsWithChildren) {
  const [checking, setChecking] = useState(!IS_ADMIN_APP);
  const [ready, setReady] = useState(IS_ADMIN_APP);
  const [mode, setMode] = useState<Mode>('register');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [registrationReady, setRegistrationReady] = useState(false);
  const holdForCode = useRef(false);

  const inspect = useCallback(async () => {
    if (IS_ADMIN_APP) return;
    try {
      const state = await getRegisteredSession();
      const complete = !!state.session && !!state.profile;
      setReady(complete && !holdForCode.current);
      if (complete) void touchLearnerActivity();
    } catch {
      setReady(false);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (IS_ADMIN_APP) return;
    void inspect();
    const { data } = supabase.auth.onAuthStateChange(() => { void inspect(); });
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') void inspect();
    });
    return () => { data.subscription.unsubscribe(); appState.remove(); };
  }, [inspect]);

  async function submit() {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      if (mode === 'register') {
        const code = await generateLoginCode();
        holdForCode.current = true;
        await registerLearner(fullName, email, code);
        setPassword(code);
        setGeneratedCode(code);
        setRegistrationReady(true);
        setNotice('حساب شما ساخته شد. هیچ تأیید ایمیلی لازم نیست؛ کد را وارد کنید و مستقیم وارد اپ شوید.');
      } else {
        await loginLearner(email, password);
        await inspect();
      }
    } catch (reason) {
      holdForCode.current = false;
      setError(registrationError(reason));
    } finally {
      setBusy(false);
    }
  }

  if (IS_ADMIN_APP || ready) return <>{children}</>;
  if (checking) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary[600]} /><Text style={styles.loadingText}>در حال بررسی حساب…</Text></View>;
  if (generatedCode) return (
    <KeyboardAvoidingView style={styles.page} behavior="height" enabled>
      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        bottomOffset={24}
        extraKeyboardSpace={12}
      >
        <LinearGradient colors={['#EAF4FF', '#FFFFFF']} style={styles.card}>
          <View style={styles.logo}><ShieldCheck size={31} color="#FFFFFF" /></View>
          <Text style={styles.title}>کد ورود شما آماده است</Text>
          <Text style={styles.subtitle}>این کد را برای ورودهای بعدی یادداشت کنید. اکنون بدون تایپ دوباره وارد اپ می‌شوید.</Text>
          <Text selectable accessibilityLabel={`کد ورود ${generatedCode}`} style={styles.code}>{generatedCode}</Text>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          <Pressable accessibilityRole="button" style={styles.submit} onPress={() => {
            if (!registrationReady) {
              holdForCode.current = false; setGeneratedCode(''); setMode('login'); return;
            }
            holdForCode.current = false; setGeneratedCode(''); void inspect();
          }}><Text style={styles.submitText}>{registrationReady ? 'ورود مستقیم به اپ' : 'رفتن به صفحه ورود'}</Text></Pressable>
        </LinearGradient>
      </KeyboardAwareScrollView>
    </KeyboardAvoidingView>
  );

  return (
    <KeyboardAvoidingView style={styles.page} behavior="height" enabled>
      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        bottomOffset={24}
        extraKeyboardSpace={12}
      >
        <LinearGradient colors={['#EAF4FF', '#FFFFFF']} style={styles.card}>
        <View style={styles.logo}><BookOpenCheck size={31} color="#FFFFFF" /></View>
        <Text style={styles.eyebrow}>MILO LANGUAGE LEARNING</Text>
        <Text style={styles.title}>{mode === 'register' ? 'ساخت حساب زبان‌آموز' : 'ورود به حساب'}</Text>
        <Text style={styles.subtitle}>{mode === 'register' ? 'فقط نام و ایمیل را وارد کنید؛ کد ورود ۶ رقمی به‌صورت خودکار ساخته می‌شود.' : 'ایمیل و کد ۶ رقمی خود را وارد کنید. رمزهای قدیمی نیز همچنان قابل استفاده‌اند.'}</Text>

        <View style={styles.switcher}>
          <Pressable accessibilityRole="button" onPress={() => { setMode('register'); setError(''); setNotice(''); }} style={[styles.switchButton, mode === 'register' && styles.switchActive]}><UserPlus size={17} color={mode === 'register' ? '#FFFFFF' : Colors.primary[700]} /><Text style={[styles.switchText, mode === 'register' && styles.switchTextActive]}>ثبت‌نام</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => { setMode('login'); setError(''); setNotice(''); }} style={[styles.switchButton, mode === 'login' && styles.switchActive]}><LogIn size={17} color={mode === 'login' ? '#FFFFFF' : Colors.primary[700]} /><Text style={[styles.switchText, mode === 'login' && styles.switchTextActive]}>ورود</Text></Pressable>
        </View>

        {mode === 'register' ? <><Text style={styles.label}>نام و نام خانوادگی</Text><TextInput accessibilityLabel="نام و نام خانوادگی" value={fullName} onChangeText={setFullName} style={styles.input} placeholder="مثلاً سارا احمدی" placeholderTextColor="#8799B2" textAlign="right" /></> : null}
        <Text style={styles.label}>ایمیل</Text>
        <TextInput accessibilityLabel="ایمیل حساب" value={email} onChangeText={setEmail} style={[styles.input, styles.ltr]} placeholder="name@example.com" placeholderTextColor="#8799B2" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
        {mode === 'login' ? <>
          <Text style={styles.label}>کد ورود</Text>
          <TextInput accessibilityLabel="کد ورود حساب" value={password} onChangeText={setPassword} style={[styles.input, styles.ltr]} placeholder="کد ۶ رقمی یا رمز قبلی" placeholderTextColor="#5E6E82" keyboardType="default" autoCapitalize="none" autoCorrect={false} onSubmitEditing={() => void submit()} />
        </> : null}

        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} style={[styles.submit, busy && styles.disabled]} onPress={() => void submit()}>
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>{mode === 'register' ? 'ساخت حساب و دریافت کد' : 'ورود به اپ'}</Text>}
        </Pressable>

        <View style={styles.privacy}><ShieldCheck size={18} color="#16835D" /><Text style={styles.privacyText}>مدیریت فقط اطلاعات حساب، وضعیت فعالیت و پیشرفت آموزشی را می‌بیند؛ پیام‌های خصوصی نمایش داده نمی‌شوند.</Text></View>
        </LinearGradient>
      </KeyboardAwareScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F6FAFF' },
  scroll: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'flex-start', paddingHorizontal: 18, paddingTop: 14, paddingBottom: 140 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#F6FAFF' },
  loadingText: { fontFamily: Typography.fontFamily, color: '#334155', fontSize: 13 },
  card: { width: '100%', maxWidth: 500, alignSelf: 'center', borderRadius: 28, borderWidth: 1, borderColor: '#D7E7FA', padding: 22, shadowColor: '#2D6FB7', shadowOpacity: .12, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 5 },
  logo: { width: 58, height: 58, borderRadius: 19, backgroundColor: Colors.primary[600], alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 13 },
  eyebrow: { fontFamily: Typography.latinFontFamily, fontSize: 9, fontWeight: '800', letterSpacing: 1.3, color: Colors.primary[600], textAlign: 'center', writingDirection: 'ltr' },
  title: { fontFamily: Typography.boldFontFamily, fontSize: 23, lineHeight: 35, color: '#102A56', textAlign: 'center', marginTop: 5 },
  subtitle: { fontFamily: Typography.fontFamily, fontSize: 13, lineHeight: 23, color: '#344761', textAlign: 'center', marginTop: 5, marginBottom: 17 },
  switcher: { flexDirection: 'row-reverse', borderRadius: Radius.full, backgroundColor: '#E9F2FD', padding: 4, marginBottom: 17 },
  switchButton: { flex: 1, minHeight: 42, borderRadius: Radius.full, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  switchActive: { backgroundColor: Colors.primary[600] },
  switchText: { fontFamily: Typography.boldFontFamily, fontSize: 12, color: Colors.primary[700] },
  switchTextActive: { color: '#FFFFFF' },
  label: { fontFamily: Typography.boldFontFamily, fontSize: 12, color: '#111827', textAlign: 'right', marginBottom: 6, marginTop: 9 },
  input: { minHeight: 50, borderRadius: 15, borderWidth: 1, borderColor: '#AFC4DE', backgroundColor: '#FFFFFF', paddingHorizontal: 14, fontFamily: Typography.fontFamily, fontSize: 14, fontWeight: '700', color: '#111111', writingDirection: 'rtl' },
  ltr: { fontFamily: Typography.latinFontFamily, textAlign: 'left', writingDirection: 'ltr', fontWeight: '800' },
  code: { fontFamily: Typography.numberFontFamily, fontSize: 38, lineHeight: 52, letterSpacing: 8, color: '#111111', backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#2878DE', borderRadius: 18, paddingVertical: 12, paddingHorizontal: 18, textAlign: 'center', writingDirection: 'ltr' },
  error: { fontFamily: Typography.fontFamily, color: '#B42318', backgroundColor: '#FEECEB', padding: 10, borderRadius: 12, textAlign: 'right', marginTop: 12 },
  notice: { fontFamily: Typography.fontFamily, color: '#16603F', backgroundColor: '#E9F8F0', padding: 10, borderRadius: 12, textAlign: 'right', marginTop: 12 },
  submit: { minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary[600], marginTop: 17 },
  submitText: { fontFamily: Typography.boldFontFamily, color: '#FFFFFF', fontSize: 14 },
  disabled: { opacity: .55 },
  privacy: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 8, backgroundColor: '#EBF8F3', borderRadius: 14, padding: 11, marginTop: 14 },
  privacyText: { flex: 1, fontFamily: Typography.fontFamily, fontSize: 10, lineHeight: 18, color: '#32604F', textAlign: 'right' },
});
