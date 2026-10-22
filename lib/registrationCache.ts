/**
 * Local copy of the learner we last verified with the server.
 *
 * Checking Supabase on every launch made the app wait on the network before the
 * first screen ("چند ثانیه طول می‌کشد که اپ باز شود"). The gate now opens from
 * this cache immediately and re-validates in the background; if the server says
 * the session is gone, the gate comes back exactly as before.
 *
 * Only non-secret fields are stored - never a token, password or login code.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const REGISTRATION_CACHE_KEY = 'milo_learner_profile_v1';

export type CachedRegistration = {
  userId: string;
  email: string;
  createdAt: number;
  profile: {
    user_id: string;
    full_name: string;
    email: string;
    registered_at: string;
    last_seen_at: string;
  };
};

function readRaw(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return Promise.resolve(typeof window !== 'undefined' ? window.localStorage.getItem(REGISTRATION_CACHE_KEY) : null);
    } catch {
      return Promise.resolve(null);
    }
  }
  return AsyncStorage.getItem(REGISTRATION_CACHE_KEY).catch(() => null);
}

function writeRaw(value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(REGISTRATION_CACHE_KEY, value);
    } catch {
      /* private mode */
    }
    return Promise.resolve();
  }
  return AsyncStorage.setItem(REGISTRATION_CACHE_KEY, value).catch(() => undefined);
}

export async function readCachedRegistration(): Promise<CachedRegistration | null> {
  const raw = await readRaw();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CachedRegistration;
    if (!parsed?.userId || !parsed?.profile?.user_id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeCachedRegistration(entry: CachedRegistration): Promise<void> {
  await writeRaw(JSON.stringify(entry));
}

export async function clearCachedRegistration(): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined') window.localStorage.removeItem(REGISTRATION_CACHE_KEY);
    } catch {
      /* private mode */
    }
    return;
  }
  await AsyncStorage.removeItem(REGISTRATION_CACHE_KEY).catch(() => undefined);
}
