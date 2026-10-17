import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { isSupabaseConfigured } from './pairing';

export interface AppAccessState {
  blocked: boolean;
  reason: string | null;
}

const cacheKey = (userId: string) => `milo_app_access_v1:${userId}`;

export async function loadCachedAppAccess(userId: string): Promise<AppAccessState | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object'
      || typeof (value as AppAccessState).blocked !== 'boolean'
      || !((value as AppAccessState).reason === null || typeof (value as AppAccessState).reason === 'string')) return null;
    return value as AppAccessState;
  } catch {
    return null;
  }
}

export async function fetchAppAccess(userId: string): Promise<AppAccessState | null> {
  if (!userId || !isSupabaseConfigured()) return null;
  const { data, error } = await supabase.rpc('current_app_access');
  if (error) throw error;
  if (!data || typeof data !== 'object' || typeof data.blocked !== 'boolean') {
    throw new Error('ACCESS_POLICY_INVALID');
  }
  const state = {
    blocked: data.blocked,
    reason: typeof data.reason === 'string' ? data.reason : null,
  } satisfies AppAccessState;
  await AsyncStorage.setItem(cacheKey(userId), JSON.stringify(state));
  return state;
}
