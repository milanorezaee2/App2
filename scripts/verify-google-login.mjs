#!/usr/bin/env node
import assert from 'node:assert/strict';
import { webcrypto, createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

let serial = 0;
async function scenario(platform = 'web', overrides = {}) {
  const state = {
    platform, base: '/App2', ownership: 'standalone', requests: [], exchanges: [], profiles: 0,
    initialURL: null, browserResult: { type: 'cancel' }, exchangeError: null, verified: true, profile: true,
    ...overrides,
  };
  globalThis.__googleTest = state;
  globalThis.__googleCrypto = webcrypto;
  globalThis.window = {
    location: { origin: 'https://milo.example', href: 'https://milo.example/App2/', assign(url) { state.assigned = url; } },
    history: { state: null, replaceState(_state, _unused, url) { state.cleaned = url; } },
  };
  const bundle = await build({
    entryPoints: [new URL('../lib/googleSignIn.ts', import.meta.url).pathname],
    bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent',
    plugins: [{ name: 'google-test-doubles', setup(b) {
      const stubs = {
        'react-native': 'export const Platform = { OS: globalThis.__googleTest.platform };',
        'react-native-url-polyfill/auto': '',
        'expo-crypto': `export const CryptoDigestAlgorithm={SHA256:'SHA-256'}; export function getRandomValues(array){return globalThis.__googleCrypto.getRandomValues(array)} export function digest(algorithm,data){return globalThis.__googleCrypto.subtle.digest(algorithm,data)}`,
        'expo-constants': 'export default { appOwnership: globalThis.__googleTest.ownership, expoConfig: { experiments: { baseUrl: globalThis.__googleTest.base } } };',
        'expo-linking': 'export async function getInitialURL(){ return globalThis.__googleTest.initialURL; }',
        'expo-web-browser': `export async function openAuthSessionAsync(url, redirect){const s=globalThis.__googleTest; s.browserArgs=[url,redirect]; return s.browserResult;}`,
        './userRegistration': `export async function getRegisteredSession(){const s=globalThis.__googleTest;s.profiles++;return {session:{user:{id:'learner'}},profile:s.profile?{user_id:'learner'}:null};}`,
        './supabase': `export const supabase={auth:{
          async signInWithOAuth(args){const s=globalThis.__googleTest;s.requests.push(args);return {data:{url:'https://auth.example/authorize?provider=google'},error:s.providerError||null};},
          async exchangeCodeForSession(code){const s=globalThis.__googleTest;s.exchanges.push(code);await Promise.resolve();return {data:{session:{user:{id:'learner',email:'learner@gmail.com',email_confirmed_at:s.verified?'2026-10-27':null,is_anonymous:!!s.anonymous}}},error:s.exchangeError};}
        }};`,
      };
      b.onResolve({ filter: /^(react-native|react-native-url-polyfill\/auto|expo-crypto|expo-constants|expo-linking|expo-web-browser|\.\/userRegistration|\.\/supabase)$/ }, a => ({ path: a.path, namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, a => ({ contents: stubs[a.path], loader: 'js' }));
    } }],
  });
  const source = `${bundle.outputFiles[0].text}\n// scenario ${serial++}`;
  const auth = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  return { state, auth };
}

{
  const { state, auth } = await scenario();
  assert.equal(auth.googleRedirectUri(), 'https://milo.example/App2/auth/callback');
  assert.equal(await auth.signInWithGoogle(), 'redirecting');
  assert.deepEqual(state.requests[0], { provider: 'google', options: { redirectTo: 'https://milo.example/App2/auth/callback', skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } } });
  assert.equal(state.assigned, 'https://auth.example/authorize?provider=google');
  assert.deepEqual(state.exchanges, [], 'opening Google must not authenticate');
  assert.equal(state.profiles, 0);
  assert.equal(await auth.completeGoogleCallback('https://other.example/App2/auth/callback?code=wrong'), false);
  assert.equal(await auth.completeGoogleCallback('https://milo.example/App2/languages?code=wrong'), false);
  assert.equal(await auth.completeGoogleCallback('https://milo.example/App2/auth/callback#access_token=untrusted'), false);
  assert.deepEqual(state.exchanges, []);
  const url = 'https://milo.example/App2/auth/callback?code=one-time';
  assert.deepEqual(await Promise.all([auth.completeGoogleCallback(url), auth.completeGoogleCallback(url)]), [true, true]);
  assert.deepEqual(state.exchanges, ['one-time'], 'duplicate redirect handlers must exchange once');
  assert.equal(state.profiles, 1);
  assert.equal(state.cleaned, 'https://milo.example/App2/auth/callback');
}
{
  const { state, auth } = await scenario('android');
  assert.equal(auth.googleRedirectUri(), 'milologinv2://auth/callback');
  assert.equal(await auth.signInWithGoogle(), 'cancelled');
  assert.deepEqual(state.exchanges, [], 'closing the account picker must not authenticate');
  assert.deepEqual(state.browserArgs, ['https://auth.example/authorize?provider=google', 'milologinv2://auth/callback']);
}
for (const platform of ['android', 'ios']) {
  const { state, auth } = await scenario(platform, { browserResult: { type: 'success', url: 'milologinv2://auth/callback?code=native-success' } });
  assert.equal(await auth.signInWithGoogle(), 'authenticated');
  assert.deepEqual(state.exchanges, ['native-success']);
  assert.equal(state.profiles, 1);
}
{
  const { auth } = await scenario('android', { ownership: 'expo' });
  await assert.rejects(auth.signInWithGoogle(), /GOOGLE_NATIVE_BUILD_REQUIRED/);
}
{
  const { state, auth } = await scenario('android', { initialURL: 'milologinv2://auth/callback?code=cold-start' });
  assert.equal(await auth.resumeGoogleSignIn(), true);
  assert.deepEqual(state.exchanges, ['cold-start']);
}
{
  const { auth } = await scenario('web', { base: '' });
  assert.equal(auth.googleRedirectUri(), 'https://milo.example/auth/callback');
  window.location.href = 'https://milo.example/auth/callback?code=web-resume';
  assert.equal(await auth.resumeGoogleSignIn(), true);
}
for (const overrides of [{ exchangeError: new Error('bad verifier') }, { verified: false }, { anonymous: true }, { profile: false }]) {
  const { auth } = await scenario('web', overrides);
  await assert.rejects(auth.completeGoogleCallback('https://milo.example/App2/auth/callback?code=invalid'));
}
{
  const { state, auth } = await scenario();
  await assert.rejects(auth.completeGoogleCallback('https://milo.example/App2/auth/callback?error=access_denied&error_description=do-not-display'), /GOOGLE_ACCESS_DENIED/);
  await assert.rejects(auth.completeGoogleCallback('https://milo.example/App2/auth/callback#error=access_denied'), /GOOGLE_ACCESS_DENIED/);
  assert.deepEqual(state.exchanges, []);
  assert.equal(state.cleaned, 'https://milo.example/App2/auth/callback');
}
{
  const { auth } = await scenario('web', { providerError: new Error('provider is not enabled') });
  await assert.rejects(auth.signInWithGoogle(), /not enabled/);
}
{
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
  try {
    const { auth } = await scenario('android');
    await auth.signInWithGoogle();
    const random = globalThis.crypto.getRandomValues(new Uint32Array(8));
    assert.ok(random.some(n => n !== 0));
    const bytes = new TextEncoder().encode('Milo PKCE');
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    assert.equal(Buffer.from(digest).toString('hex'), createHash('sha256').update(bytes).digest('hex'));
    const memory = new Map();
    const client = createClient('https://milo.example', 'public-test-key', { auth: {
      flowType: 'pkce', persistSession: true, autoRefreshToken: false, detectSessionInUrl: false,
      storage: { getItem: k => memory.get(k) ?? null, setItem: (k,v) => { memory.set(k,v); }, removeItem: k => { memory.delete(k); } },
    } });
    const { data, error } = await client.auth.signInWithOAuth({ provider: 'google', options: { skipBrowserRedirect: true } });
    assert.equal(error, null);
    const params = new URL(data.url).searchParams;
    assert.equal(params.get('code_challenge_method'), 's256', 'native auth-js must never downgrade to plain PKCE');
    const verifier = JSON.parse([...memory.entries()].find(([key]) => key.endsWith('-code-verifier'))[1]);
    assert.equal(params.get('code_challenge'), createHash('sha256').update(verifier).digest('base64url'));
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
    else delete globalThis.crypto;
  }
}
const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
assert.match(read('lib/googleSignIn.ts'), /react-native-url-polyfill\/auto/);
assert.match(read('lib/supabase.ts'), /flowType: 'pkce' as const/);
assert.match(read('lib/supabase.ts'), /detectSessionInUrl: false/);
assert.match(read('components/RegistrationGate.tsx'), /<GoogleSignInButton disabled=\{busy\}/);
assert.match(read('components/RegistrationGate.tsx'), /await verifyEmailCode\(email, code, fullName\)/, 'OTP stays available');
assert.match(read('components/GoogleSignInButton.tsx'), /accessibilityLabel="ادامه با حساب گوگل"/);
assert.match(read('components/GoogleSignInButton.tsx'), /borderRadius: 25/);
assert.match(read('app/auth/callback.tsx'), /Redirect href=\{FEATURES\.learnerLogin \? "\/journey" : "\/languages"\}/);
console.log('Google PKCE login: web/native, cold-start, duplicate callback, cancellation, unverified session, profile failure and OTP coexistence checks passed.');
