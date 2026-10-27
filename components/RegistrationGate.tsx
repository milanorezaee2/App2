import { type PropsWithChildren, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { completeGoogleCallback, isGoogleCallback, resumeGoogleSignIn, signInWithGoogle } from '@/lib/googleSignIn';
import BookOpenCheck from 'lucide-react-native/dist/esm/icons/book-open-check';
import MailCheck from 'lucide-react-native/dist/esm/icons/mail-check';
import ShieldCheck from 'lucide-react-native/dist/esm/icons/shield-check';
import UserPlus from 'lucide-react-native/dist/esm/icons/user-plus';
import LogIn from 'lucide-react-native/dist/esm/icons/log-in';
import { supabase } from '@/lib/supabase';
import { KeyboardAwareScrollView, KeyboardAvoidingView } from '@/components/KeyboardRuntime';
import { getRegisteredSession, registrationError, requestEmailCode, touchLearnerActivity, verifyEmailCode } from '@/lib/userRegistration';
import { Colors, Radius, Typography } from '@/lib/theme';
import { FEATURES } from '@/lib/features';

const IS_ADMIN_APP = Constants.expoConfig?.extra?.appRole === 'admin' || process.env.EXPO_PUBLIC_MILO_ADMIN_APP === 'true';
const BYPASS_GATE: boolean = IS_ADMIN_APP || !FEATURES.learnerLogin;
type Mode = 'register' | 'login';
type Stage = 'email' | 'code';

export function RegistrationGate({ children, onAuthenticated }: PropsWithChildren<{ onAuthenticated?: () => void }>) {
  const [checking, setChecking] = useState(!BYPASS_GATE);
  const [ready, setReady] = useState(BYPASS_GATE);
  const [mode, setMode] = useState<Mode>('register');
  const [stage, setStage] = useState<Stage>('email');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const verifying = useRef(false);
  const verifiedAccount = useRef<string | null>(null);
  const inspection = useRef(0);
  const authenticatedCallback = useRef(onAuthenticated);
  authenticatedCallback.current = onAuthenticated;

  const inspect = useCallback(async () => {
    if (BYPASS_GATE || verifying.current) return;
    const ticket = ++inspection.current;
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (ticket !== inspection.current) return;
      if (sessionError) throw sessionError;
      const user = data.session?.user;
      if (user?.id && user.email_confirmed_at && !user.is_anonymous && verifiedAccount.current === user.id) {
        setReady(true);
        return; // Do not re-fetch the profile on every foreground/token refresh.
      }
      const state = await getRegisteredSession();
      if (ticket !== inspection.current) return;
      const complete = !!state.session && !!state.profile;
      verifiedAccount.current = complete ? state.session!.user.id : null;
      setReady(complete);
      if (complete) void touchLearnerActivity().catch(() => undefined);
    } catch {
      if (ticket === inspection.current) setReady(false);
    } finally {
      if (ticket === inspection.current) setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (BYPASS_GATE) return;
    let alive = true;
    // Complete browser/cold-start redirects before inspecting the profile.
    // A cached profile is display data, never proof of authentication.
    const restore = async (url?: string) => {
      verifying.current = true;
      setChecking(true);
      try {
        const completed = url ? await completeGoogleCallback(url) : await resumeGoogleSignIn();
        if (!alive) return;
        if (completed) {
          setReady(true);
          authenticatedCallback.current?.();
        } else {
          verifying.current = false;
          await inspect();
        }
      } catch (reason) {
        if (alive) { setError(registrationError(reason)); setReady(false); }
      } finally {
        verifying.current = false;
        if (alive) setChecking(false);
      }
    };
    void restore();
    const linkSubscription = Linking.addEventListener('url', ({ url }) => {
      // openAuthSessionAsync owns warm links while its browser is open.
      if (!verifying.current && isGoogleCallback(url)) void restore(url);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) { ++inspection.current; verifiedAccount.current = null; setReady(false); }
      // Run outside Supabase's auth lock; avoid opening routes mid-verification.
      setTimeout(() => { if (alive && !verifying.current) void inspect(); }, 0);
    });
    const appState = AppState.addEventListener('change', state => { if (state === 'active') void inspect(); });
    return () => { alive = false; ++inspection.current; data.subscription.unsubscribe(); appState.remove(); linkSubscription.remove(); };
  }, [inspect]);

  useEffect(() => {
    if (!cooldown) return;
    const timer = setInterval(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const googleLogin = async () => {
    if (busy || verifying.current) return;
    verifying.current = true;
    setBusy(true); setGoogleBusy(true); setError(''); setNotice('');
    try {
      const result = await signInWithGoogle();
      if (result === 'authenticated') {
        setReady(true);
        authenticatedCallback.current?.();
      } else if (result === 'cancelled') {
        setNotice('ورود با گوگل لغو شد؛ می‌توانید دوباره امتحان کنید یا کد ایمیلی بگیرید.');
      }
    } catch (reason) {
      setError(registrationError(reason));
    } finally {
      verifying.current = false;
      setBusy(false); setGoogleBusy(false);
    }
  };

  const sendCode = async () => {
    if (busy || cooldown > 0) return;
    setBusy(true); setError(''); setNotice('');
    try {
      if (mode === 'register' && (fullName.trim().length < 2 || fullName.trim().length > 80)) throw new Error('NAME_INVALID');
      await requestEmailCode(email, mode === 'register' ? fullName : undefined);
      setStage('code'); setCooldown(60);
      setNotice(`کد ۶ رقمی به ${email.trim().toLowerCase()} فرستاده شد.`);
    } catch (reason) {
      setError(registrationError(reason));
    } finally { setBusy(false); }
  };

  const verifyCode = async () => {
    if (busy) return;
    verifying.current = true;
    setBusy(true); setError(''); setNotice('');
    try {
      await verifyEmailCode(email, code, fullName);
      setReady(true); setStage('email'); setCode(''); setNotice('ورود موفق بود.'); onAuthenticated?.();
      void inspect();
    } catch (reason) {
      setError(registrationError(reason));
    } finally { verifying.current = false; setBusy(false); }
  };

  if (BYPASS_GATE || ready) return <>{children}</>;
  if (checking) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary[600]} /><Text style={styles.loadingText}>در حال بررسی حساب…</Text></View>;

  return (
    <KeyboardAvoidingView style={styles.page} behavior="height" enabled>
      <KeyboardAwareScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" bottomOffset={24} extraKeyboardSpace={12}>
        <LinearGradient colors={['#EAF4FF', '#FFFFFF']} style={styles.card}>
          <View style={styles.logo}>{stage === 'email' ? <BookOpenCheck size={31} color="#FFFFFF" /> : <MailCheck size={31} color="#FFFFFF" />}</View>
          <Text style={styles.eyebrow}>MILO LANGUAGE LEARNING</Text>
          <Text style={styles.title}>{stage === 'email' ? (mode === 'register' ? 'ساخت حساب زبان‌آموز' : 'ورود به حساب') : 'کد ایمیل را وارد کن'}</Text>
          <Text style={styles.subtitle}>
            {stage === 'email'
              ? 'با حساب گوگل ادامه بده یا با کد یک‌بارمصرف ایمیلی وارد شو.'
              : `کد ارسال‌شده به ${email.trim().toLowerCase()} را وارد کن. کد فقط چند دقیقه اعتبار دارد.`}
          </Text>

          {stage === 'email' ? <>
            <GoogleSignInButton disabled={busy} loading={googleBusy} onPress={() => void googleLogin()} />
            <View style={styles.divider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>یا با ایمیل</Text><View style={styles.dividerLine} /></View>
            <View style={styles.switcher}>
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setMode('register'); setError(''); setNotice(''); }} style={[styles.switchButton, mode === 'register' && styles.switchActive]}><UserPlus size={17} color={mode === 'register' ? '#FFFFFF' : Colors.primary[700]} /><Text style={[styles.switchText, mode === 'register' && styles.switchTextActive]}>ثبت‌نام</Text></Pressable>
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setMode('login'); setError(''); setNotice(''); }} style={[styles.switchButton, mode === 'login' && styles.switchActive]}><LogIn size={17} color={mode === 'login' ? '#FFFFFF' : Colors.primary[700]} /><Text style={[styles.switchText, mode === 'login' && styles.switchTextActive]}>ورود</Text></Pressable>
            </View>
            {mode === 'register' ? <><Text style={styles.label}>نام و نام خانوادگی</Text><TextInput accessibilityLabel="نام و نام خانوادگی" value={fullName} editable={!busy} onChangeText={setFullName} style={styles.input} placeholder="مثلاً سارا احمدی" placeholderTextColor="#8799B2" textAlign="right" /></> : null}
            <Text style={styles.label}>ایمیل</Text>
            <TextInput accessibilityLabel="ایمیل حساب" value={email} editable={!busy} autoComplete="email" onChangeText={setEmail} style={[styles.input, styles.ltr]} placeholder="name@example.com" placeholderTextColor="#8799B2" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" onSubmitEditing={() => void sendCode()} />
          </> : <>
            <Text style={styles.label}>کد تأیید ایمیل</Text>
            <TextInput accessibilityLabel="کد تأیید ایمیل" value={code} editable={!busy} autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={6} onChangeText={value => setCode(value.replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).replace(/\D/g, '').slice(0, 6))} style={[styles.input, styles.codeInput]} placeholder="۱۲۳۴۵۶" placeholderTextColor="#8799B2" keyboardType="number-pad" autoFocus onSubmitEditing={() => void verifyCode()} />
            <Pressable accessibilityRole="button" disabled={busy || cooldown > 0} onPress={() => void sendCode()}><Text style={[styles.resend, (busy || cooldown > 0) && styles.resendDisabled]}>{cooldown ? `ارسال دوباره تا ${cooldown} ثانیه` : 'ارسال دوبارهٔ کد'}</Text></Pressable>
          </>}

          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || (stage === 'email' ? cooldown > 0 : code.length !== 6) }} disabled={busy || (stage === 'email' ? cooldown > 0 : code.length !== 6)} style={[styles.submit, busy && styles.disabled]} onPress={() => void (stage === 'email' ? sendCode() : verifyCode())}>
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>{stage === 'email' ? 'دریافت کد ورود' : 'تأیید و ورود'}</Text>}
          </Pressable>
          {stage === 'code' && <Pressable disabled={busy} accessibilityRole="button" onPress={() => { setStage('email'); setCode(''); setError(''); setNotice(''); }}><Text style={styles.changeEmail}>تغییر ایمیل</Text></Pressable>}
          <View style={styles.privacy}><ShieldCheck size={18} color="#16835D" /><Text style={styles.privacyText}>پیشرفت هر زبان جداگانه نگهداری می‌شود؛ با تغییر زبان، درس‌های قبلی پاک نمی‌شوند. پیام‌های خصوصی نمایش داده نمی‌شوند.</Text></View>
        </LinearGradient>
      </KeyboardAwareScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F6FAFF' }, scroll: { flex: 1 }, content: { flexGrow: 1, justifyContent: 'flex-start', paddingHorizontal: 18, paddingTop: 14, paddingBottom: 140 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#F6FAFF' }, loadingText: { fontFamily: Typography.fontFamily, color: '#334155', fontSize: 13 },
  card: { width: '100%', maxWidth: 500, alignSelf: 'center', borderRadius: 28, borderWidth: 1, borderColor: '#D7E7FA', padding: 22, shadowColor: '#2D6FB7', shadowOpacity: .12, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 5 },
  logo: { width: 58, height: 58, borderRadius: 19, backgroundColor: Colors.primary[600], alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 13 }, eyebrow: { fontFamily: Typography.latinFontFamily, fontSize: 9, fontWeight: '800', letterSpacing: 1.3, color: Colors.primary[600], textAlign: 'center', writingDirection: 'ltr' }, title: { fontFamily: Typography.boldFontFamily, fontSize: 23, lineHeight: 35, color: '#102A56', textAlign: 'center', marginTop: 5 }, subtitle: { fontFamily: Typography.fontFamily, fontSize: 13, lineHeight: 23, color: '#344761', textAlign: 'center', marginTop: 5, marginBottom: 17 },
  switcher: { flexDirection: 'row-reverse', borderRadius: Radius.full, backgroundColor: '#E9F2FD', padding: 4, marginBottom: 17 }, switchButton: { flex: 1, minHeight: 42, borderRadius: Radius.full, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' }, switchActive: { backgroundColor: Colors.primary[600] }, switchText: { fontFamily: Typography.boldFontFamily, fontSize: 12, color: Colors.primary[700] }, switchTextActive: { color: '#FFFFFF' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 17 }, dividerLine: { flex: 1, height: 1, backgroundColor: '#D7E2F0' }, dividerText: { fontFamily: Typography.fontFamily, color: '#64748B', fontSize: 11 },
  label: { fontFamily: Typography.boldFontFamily, fontSize: 12, color: '#111827', textAlign: 'right', marginBottom: 6, marginTop: 9 }, input: { minHeight: 50, borderRadius: 15, borderWidth: 1, borderColor: '#AFC4DE', backgroundColor: '#FFFFFF', paddingHorizontal: 14, fontFamily: Typography.fontFamily, fontSize: 14, fontWeight: '700', color: '#111111', writingDirection: 'rtl' }, ltr: { fontFamily: Typography.latinFontFamily, textAlign: 'left', writingDirection: 'ltr', fontWeight: '800' }, codeInput: { fontFamily: Typography.numberFontFamily, textAlign: 'center', writingDirection: 'ltr', fontSize: 24, letterSpacing: 7 }, resend: { fontFamily: Typography.boldFontFamily, color: Colors.primary[700], textAlign: 'center', marginTop: 12 }, resendDisabled: { color: '#8799B2' }, changeEmail: { fontFamily: Typography.boldFontFamily, color: Colors.primary[700], textAlign: 'center', marginTop: 12 },
  error: { fontFamily: Typography.fontFamily, color: '#B42318', backgroundColor: '#FEECEB', padding: 10, borderRadius: 12, textAlign: 'right', marginTop: 12 }, notice: { fontFamily: Typography.fontFamily, color: '#16603F', backgroundColor: '#E9F8F0', padding: 10, borderRadius: 12, textAlign: 'right', marginTop: 12 }, submit: { minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary[600], marginTop: 17 }, submitText: { fontFamily: Typography.boldFontFamily, color: '#FFFFFF', fontSize: 14 }, disabled: { opacity: .55 }, privacy: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 8, backgroundColor: '#EBF8F3', borderRadius: 14, padding: 11, marginTop: 14 }, privacyText: { flex: 1, fontFamily: Typography.fontFamily, fontSize: 10, lineHeight: 18, color: '#32604F', textAlign: 'right' },
});
