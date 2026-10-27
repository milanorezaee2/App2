import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';
import { ensureGooglePkceCrypto } from './googlePkceCrypto';
import { getRegisteredSession } from './userRegistration';

// Matches the dedicated login learner APK's scheme in app.config.js.
export const GOOGLE_NATIVE_REDIRECT = 'milologinv2://auth/callback';
const CALLBACK_PATH = '/auth/callback';
let exchangedCode: string | null = null;
let exchangePromise: Promise<boolean> | null = null;
let loginInProgress = false;

export function googleRedirectUri(): string {
  if (Platform.OS !== 'web') return GOOGLE_NATIVE_REDIRECT;
  if (typeof window === 'undefined') throw new Error('GOOGLE_BROWSER_REQUIRED');
  const base = String(Constants.expoConfig?.experiments?.baseUrl || '').replace(/\/+$/, '');
  return `${window.location.origin}${base}${CALLBACK_PATH}`;
}

/** Only consume the exact callback, never arbitrary incoming lesson/deep links. */
export function isGoogleCallback(url: string): boolean {
  try {
    const received = new URL(url);
    const expected = new URL(googleRedirectUri());
    return received.protocol === expected.protocol
      && received.host === expected.host
      && received.pathname === expected.pathname;
  } catch {
    return false;
  }
}

function cleanWebCallback(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  // Remove the short-lived code/provider errors from browser history. No tokens
  // or provider responses are ever logged or stored in the profile cache.
  window.history.replaceState(window.history.state, '', googleRedirectUri());
}

/** Called by both the native browser result and cold/warm deep-link handling. */
export async function completeGoogleCallback(url: string): Promise<boolean> {
  if (!isGoogleCallback(url)) return false;
  const received = new URL(url);
  const params = received.searchParams;
  // Some provider failures are returned in a fragment even with code flow.
  const fragment = new URLSearchParams(received.hash.slice(1));
  if (params.has('error') || params.has('error_code') || fragment.has('error')) {
    cleanWebCallback();
    // Do not echo untrusted provider error descriptions into the login form.
    if ((params.get('error') || fragment.get('error')) === 'access_denied') throw new Error('GOOGLE_ACCESS_DENIED');
    throw new Error('GOOGLE_CALLBACK_FAILED');
  }
  const code = params.get('code');
  if (!code) return false;
  // Android can deliver the same link to openAuthSessionAsync and Linking.
  // Exchange each code exactly once, including duplicate failure notifications.
  if (exchangedCode === code && exchangePromise) return exchangePromise;
  exchangedCode = code;
  exchangePromise = (async () => {
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw new Error('GOOGLE_SESSION_FAILED');
      if (!data.session?.user?.email || !data.session.user.email_confirmed_at || data.session.user.is_anonymous) {
        throw new Error('EMAIL_NOT_VERIFIED');
      }
      // A provider redirect alone is not authentication. Only open the app after
      // PKCE exchange succeeds and the verified user's protected profile exists.
      const state = await getRegisteredSession();
      if (!state.session || !state.profile || state.session.user.id !== data.session.user.id || state.profile.user_id !== data.session.user.id) {
        throw new Error('GOOGLE_PROFILE_FAILED');
      }
      return true;
    } finally {
      cleanWebCallback();
    }
  })();
  return exchangePromise;
}

export async function resumeGoogleSignIn(): Promise<boolean> {
  const url = Platform.OS === 'web'
    ? (typeof window !== 'undefined' ? window.location.href : null)
    : await Linking.getInitialURL();
  return url ? completeGoogleCallback(url) : false;
}

/** Google owns the account picker/consent screen; the app never asks for its password. */
export async function signInWithGoogle(): Promise<'redirecting' | 'authenticated' | 'cancelled'> {
  if (loginInProgress) return 'cancelled';
  if (Platform.OS !== 'web' && Constants.appOwnership === 'expo') throw new Error('GOOGLE_NATIVE_BUILD_REQUIRED');
  loginInProgress = true;
  try {
    ensureGooglePkceCrypto();
    const redirectTo = googleRedirectUri();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) throw error;
    if (!data.url) throw new Error('GOOGLE_URL_MISSING');
    if (Platform.OS === 'web') {
      // Same-tab redirect works on mobile browsers without popup blockers and
      // keeps the PKCE verifier in the same origin's persisted auth storage.
      window.location.assign(data.url);
      return 'redirecting';
    }
    // A system browser, not an embedded WebView (Google blocks embedded OAuth).
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') return 'cancelled';
    if (!await completeGoogleCallback(result.url)) throw new Error('GOOGLE_CALLBACK_FAILED');
    return 'authenticated';
  } finally {
    loginInProgress = false;
  }
}
