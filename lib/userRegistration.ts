import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

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
  return { session, profile: (profile || null) as RegistrationProfile | null };
}

export async function generateLoginCode(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(4);
  const value = (((bytes[0] << 24) >>> 0) + (bytes[1] << 16) + (bytes[2] << 8) + bytes[3]) >>> 0;
  return String(100000 + (value % 900000));
}

export async function registerLearner(fullName: string, email: string, loginCode: string): Promise<'ready'> {
  const cleanName = fullName.trim();
  const cleanEmail = email.trim().toLowerCase();
  if (cleanName.length < 2 || cleanName.length > 80) throw new Error('NAME_INVALID');
  if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) throw new Error('EMAIL_INVALID');
  if (!/^\d{6}$/.test(loginCode)) throw new Error('CODE_INVALID');

  const current = await supabase.auth.getSession();
  let user: User | null = null;
  let hasSession = false;
  if (current.data.session && !isPermanentLearner(current.data.session.user)) {
    const result = await supabase.auth.updateUser({ email: cleanEmail, password: loginCode, data: { full_name: cleanName } });
    if (result.error) throw result.error;
    user = result.data.user;
    hasSession = true;
  } else {
    if (current.data.session) await supabase.auth.signOut();
    const result = await supabase.auth.signUp({
      email: cleanEmail,
      password: loginCode,
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

export async function loginLearner(email: string, password: string): Promise<void> {
  const result = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (result.error) throw result.error;
  const name = String(result.data.user.user_metadata?.full_name || '').trim();
  if (name) await saveProfile(result.data.user, name);
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
  if (/app_user_profiles|schema cache|does not exist/i.test(message)) return 'زیرساخت ثبت‌نام هنوز روی سرور فعال نشده است.';
  return 'عملیات انجام نشد؛ اتصال اینترنت را بررسی و دوباره تلاش کنید.';
}
