import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { isSupabaseConfigured } from './supabaseConfig';
import { supabase } from './supabase';

export const RELEASE_TARGETS = [
  { packageName: 'com.devicecontrol.companion', label: 'اپ اصلی (بدون ورود)', apkName: 'MiloMultilang.apk' },
  { packageName: 'com.devicecontrol.milomultilang', label: 'اپ اصلی (با ورود)', apkName: 'MiloMultilang-Login.apk' },
  { packageName: 'com.devicecontrol.miloadmin', label: 'اپ مدیریت', apkName: 'MiloAdmin.apk' },
  { packageName: 'com.devicecontrol.milorussian', label: 'اپ مستقل روسی', apkName: 'MiloRussian.apk' },
] as const;

export type ReleaseTarget = (typeof RELEASE_TARGETS)[number];
export interface AppReleasePolicy {
  package_name: string;
  latest_version: string;
  minimum_version: string;
  apk_url: string;
  release_notes: string;
  force_update: boolean;
  enabled: boolean;
  updated_at?: string;
}

export const CURRENT_APP_PACKAGE = Application.applicationId
  || Constants.expoConfig?.android?.package
  || '';
export const CURRENT_APP_VERSION = Application.nativeApplicationVersion
  || Constants.expoConfig?.version
  || '0.0.0';

const cacheKey = (packageName: string) => `milo_release_policy_v1:${packageName}`;

export function compareVersions(left: string, right: string): number {
  const parse = (value: string) => {
    if (!/^\d+\.\d+\.\d+$/.test(value)) return null;
    return value.split('.').map(part => Number(part));
  };
  const a = parse(left);
  const b = parse(right);
  if (!a || !b) return 0;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;
  }
  return 0;
}

function isPolicy(value: unknown): value is AppReleasePolicy {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<AppReleasePolicy>;
  return typeof item.package_name === 'string'
    && typeof item.latest_version === 'string'
    && typeof item.minimum_version === 'string'
    && typeof item.apk_url === 'string'
    && typeof item.release_notes === 'string'
    && typeof item.force_update === 'boolean'
    && typeof item.enabled === 'boolean';
}

export async function loadCachedReleasePolicy(packageName: string): Promise<AppReleasePolicy | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(packageName));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isPolicy(parsed) && parsed.enabled ? parsed : null;
  } catch {
    return null;
  }
}

export async function fetchReleasePolicy(packageName: string): Promise<AppReleasePolicy | null> {
  if (!packageName || !isSupabaseConfigured()) return null;
  const { data, error } = await supabase.rpc('public_app_release_policy', { p_package_name: packageName });
  if (error) throw error;
  if (!isPolicy(data) || !data.enabled) {
    await AsyncStorage.removeItem(cacheKey(packageName));
    return null;
  }
  await AsyncStorage.setItem(cacheKey(packageName), JSON.stringify(data));
  return data;
}

export function shouldForceUpdate(policy: AppReleasePolicy | null, installedVersion: string): boolean {
  return !!policy?.enabled && policy.force_update
    && compareVersions(installedVersion, policy.minimum_version) < 0;
}

export function shouldOfferUpdate(policy: AppReleasePolicy | null, installedVersion: string): boolean {
  return !!policy?.enabled && compareVersions(installedVersion, policy.latest_version) < 0;
}

export function isAndroidUpdateSupported(): boolean {
  return Platform.OS === 'android';
}
