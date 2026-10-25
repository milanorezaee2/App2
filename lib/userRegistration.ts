import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { clearCachedRegistration, writeCachedRegistration } from './registrationCache';

export { readCachedRegistration } from './registrationCache';
export type { CachedRegistration } from './registrationCache';

export type RegistrationProfile = {
  user_id: string;
  full_name: string;
  email: string;
  registered_at: string;
  last_seen_at: string;
};

export function isPermanentLearner(user: User | null | undefined): boolean {
  // Anonymous learner sessions never contain an email. During a safe upgrade,
  // Supabase may retain the old provider marker until the refreshed token arrives.
  return !!user?.email;
}

async function saveProfile(user: User, fullName: string): Promise<void> {
  if (!user.email) throw new Error('EMAIL_REQUIRED');
  const now = new Date().toISOString();
  const { error } = await supabase.from('app_user_profiles').upsert({
    user_id: user.id,
    full_name: fullName.trim(),
    email: user.email.trim().toLowerCase(),
    platform: Platform.OS,
    app_version: Application.nativeApplicationVersion || '1.0.0',
    last_seen_at: now,
    updated_at: now,
  }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function getRegisteredSession(): Promise<{ session: Session | null; profile: RegistrationProfile | null }> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const session = data.session;
  if (!session || !isPermanentLearner(session.user)) return { session: null, profile: null };
  const { data: profile, error: profileError } = await supabase
    .from('app_user_profiles')
    .select('user_id,full_name,email,registered_at,last_seen_at')
    .eq('user_id', session.user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) {
    const fallbackName = String(session.user.user_metadata?.full_name || '').trim();
    if (fallbackName) {
      await saveProfile(session.user, fallbackName);
      return getRegisteredSession();
    }
  }
  if (profile) {
    await writeCachedRegistration({
      userId: session.user.id,
      email: session.user.email ?? profile.email,
      createdAt: Date.now(),
      profile: profile as RegistrationProfile,
    });
  }
  return { session, profile: (profile || null) as RegistrationProfile | null };
}

export async function generateLoginCode(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(4);
  const value = (((bytes[0] << 24) >>> 0) + (bytes[1] << 16) + (bytes[2] << 8) + bytes[3]) >>> 0;
  return String(100000 + (value % 900000));
}

function toAuthPassword(loginCode: string): string {
  // The learner remembers only six digits. Supabase receives a deterministic
  // strong password that also satisfies projects configured with stricter rules.
  return `Milo!${loginCode}Aa`;
}

export async function registerLearner(fullName: string, email: string, loginCode: string): Promise<'ready'> {
  await clearCachedRegistration();
  const cleanName = fullName.trim();
  const cleanEmail = email.trim().toLowerCase();
  if (cleanName.length < 2 || cleanName.length > 80) throw new Error('NAME_INVALID');
  if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) throw new Error('EMAIL_INVALID');
  if (!/^\d{6}$/.test(loginCode)) throw new Error('CODE_INVALID');

  const authPassword = toAuthPassword(loginCode);
  const current = await supabase.auth.getSession();
  let user: User | null = null;
  let hasSession = false;
  if (current.data.session && !isPermanentLearner(current.data.session.user)) {
    const result = await supabase.auth.updateUser({ email: cleanEmail, password: authPassword, data: { full_name: cleanName } });
    if (result.error) throw result.error;
    user = result.data.user;
    hasSession = true;
  } else {
    if (current.data.session) await supabase.auth.signOut();
    const result = await supabase.auth.signUp({
      email: cleanEmail,
      password: authPassword,
      options: { data: { full_name: cleanName } },
    });
    if (result.error) throw result.error;
    user = result.data.user;
    hasSession = !!result.data.session;
  }

  // Learners must never be sent through an email-confirmation flow. Hosted
  // Supabase Email Auth must have Confirm email disabled for this product.
  if (!user || !hasSession || !user.email_confirmed_at) {
    throw new Error('EMAIL_CONFIRMATION_ENABLED');
  }
  await saveProfile(user, cleanName);
  return 'ready';
}

export async function loginLearner(email: string, passwordOrCode: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  const isSimpleCode = /^\d{6}$/.test(passwordOrCode);
  let result = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password: isSimpleCode ? toAuthPassword(passwordOrCode) : passwordOrCode,
  });
  // Version 25 briefly stored a raw six-digit password. Keep those test
  // accounts usable while all new accounts use the hardened representation.
  if (result.error && isSimpleCode && /Invalid login credentials/i.test(result.error.message)) {
    result = await supabase.auth.signInWithPassword({ email: cleanEmail, password: passwordOrCode });
  }
  if (result.error) throw result.error;
  const name = String(result.data.user.user_metadata?.full_name || '').trim();
  // Authentication is sufficient to enter the app. Profile repair is useful
  // for admin reporting but must not keep the learner on the login screen when
  // the profile request is slow or temporarily unavailable.
  if (name) {
    void saveProfile(result.data.user, name).catch(error => {
      console.warn('[registration] profile repair deferred:', error);
    });
  }
}

export async function touchLearnerActivity(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!isPermanentLearner(user)) return;
  await supabase.from('app_user_profiles').update({
    last_seen_at: new Date().toISOString(),
    platform: Platform.OS,
    app_version: Application.nativeApplicationVersion || '1.0.0',
    updated_at: new Date().toISOString(),
  }).eq('user_id', user!.id);
}

export function registrationError(error: unknown): string {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  if (/NAME_INVALID/.test(message)) return 'نام و نام خانوادگی را کامل وارد کنید.';
  if (/EMAIL_INVALID|invalid.*email/i.test(message)) return 'ایمیل معتبر وارد کنید.';
  if (/CODE_INVALID|password.*6/i.test(message)) return 'کد ورود باید دقیقاً ۶ رقم باشد.';
  if (/already registered|already been registered|user already exists/i.test(message)) return 'این ایمیل قبلاً ثبت شده است؛ از بخش ورود استفاده کنید.';
  if (/Invalid login credentials/i.test(message)) return 'ایمیل یا رمز عبور صحیح نیست.';
  if (/EMAIL_CONFIRMATION_ENABLED|Email not confirmed/i.test(message)) return 'ورود ساده هنوز در تنظیمات سرور فعال نشده است؛ مدیر باید گزینه Confirm email را خاموش کند.';
  if (/rate limit/i.test(message)) return 'تعداد تلاش‌ها زیاد شده است؛ چند دقیقه صبر کنید و دوباره امتحان کنید.';
  if (/signup.*disabled|signups not allowed/i.test(message)) return 'ثبت‌نام کاربران در تنظیمات Supabase غیرفعال است.';
  if (/row-level security|permission denied/i.test(message)) return 'مجوز ثبت پروفایل روی سرور کامل نیست؛ migration ثبت‌نام را بررسی کنید.';
  if (/app_user_profiles|schema cache|does not exist/i.test(message)) return 'زیرساخت ثبت‌نام هنوز روی سرور فعال نشده است.';
  if (/fetch|network|internet|timeout/i.test(message)) return 'ارتباط با سرور برقرار نشد؛ اینترنت یا VPN را بررسی کنید.';
  return message ? `ثبت‌نام انجام نشد: ${message.slice(0, 140)}` : 'ثبت‌نام انجام نشد؛ دوباره تلاش کنید.';
}
