#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const calls = [];
const user = { id: 'learner', email: 'learner@gmail.com', email_confirmed_at: '2026-10-27T00:00:00Z', is_anonymous: false, user_metadata: { full_name: 'Learner' } };
let session = null;
let verifyError = null;
globalThis.__emailLoginTest = {
  auth: {
    async signInWithOtp(args) { calls.push(['send', args]); return { error: null }; },
    async verifyOtp(args) { calls.push(['verify', args]); return { data: { user, session: { user } }, error: verifyError }; },
    async getSession() { return { data: { session }, error: null }; },
  },
  from() {
    return {
      async upsert(profile) { calls.push(['profile', profile]); session = { user }; return { error: null }; },
      select() { return { eq() { return { async maybeSingle() { return { data: { user_id: user.id, email: user.email, full_name: 'Learner' }, error: null }; } }; } }; },
    };
  },
};
globalThis.__emailLoginCache = [];
const bundle = await build({
  entryPoints: [new URL('../lib/userRegistration.ts', import.meta.url).pathname],
  bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent',
  plugins: [{ name: 'auth-test-doubles', setup(b) {
    const stubs = {
      'react-native': "export const Platform = { OS: 'web' };",
      'expo-application': "export const nativeApplicationVersion = 'test';",
      './supabase': 'export const supabase = globalThis.__emailLoginTest;',
      './registrationCache': `export async function clearCachedRegistration() { globalThis.__emailLoginCache.push('clear'); }
        export async function writeCachedRegistration(entry) { globalThis.__emailLoginCache.push(entry); }
        export async function readCachedRegistration() { return null; }`,
    };
    b.onResolve({ filter: /^(react-native|expo-application|\.\/supabase|\.\/registrationCache)$/ }, args => ({ path: args.path, namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, args => ({ contents: stubs[args.path], loader: 'js' }));
  } }],
});
const auth = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
assert.equal(auth.isPermanentLearner(null), false);
assert.equal(auth.isPermanentLearner({ ...user, email_confirmed_at: undefined }), false);
assert.equal(auth.isPermanentLearner({ ...user, is_anonymous: true }), false);
assert.equal(auth.isPermanentLearner(user), true);
await assert.rejects(auth.requestEmailCode('not-an-email'), /EMAIL_INVALID/);
assert.equal(calls.length, 0);
await auth.requestEmailCode(' Learner@Gmail.com ', ' Learner ');
assert.deepEqual(calls.at(-1), ['send', { email: 'learner@gmail.com', options: { shouldCreateUser: true, data: { full_name: 'Learner' } } }]);
assert.equal(globalThis.__emailLoginCache.length, 0, 'sending a code must not authenticate/cache a profile');
await auth.requestEmailCode('learner@gmail.com');
assert.equal(calls.at(-1)[1].options.shouldCreateUser, false);
await assert.rejects(auth.verifyEmailCode('learner@gmail.com', '123'), /CODE_INVALID/);
verifyError = new Error('Token has expired or is invalid');
await assert.rejects(auth.verifyEmailCode('learner@gmail.com', '123456'), /expired/);
assert.equal(calls.some(([name]) => name === 'profile'), false, 'invalid OTP must not create a profile');
assert.equal(globalThis.__emailLoginCache.length, 0);
verifyError = null;
await auth.verifyEmailCode('learner@gmail.com', '123456');
assert.deepEqual(calls.find(([name]) => name === 'verify')[1], { email: 'learner@gmail.com', token: '123456', type: 'email' });
assert.equal(calls.some(([name]) => name === 'profile'), true);
assert.equal((await auth.getRegisteredSession()).session.user.id, user.id);
session = null;
assert.deepEqual(await auth.getRegisteredSession(), { session: null, profile: null });
assert.equal(globalThis.__emailLoginCache.at(-1), 'clear');
assert.match(auth.registrationError(new Error('email rate limit exceeded')), /تعداد درخواست/);
assert.match(auth.registrationError(new Error('Error sending OTP via SMTP')), /تنظیم نشده/);

const gate = read('components/RegistrationGate.tsx');
assert.ok(!gate.includes('readCachedRegistration'), 'a local profile must never open protected routes');
assert.match(gate, /setTimeout\(\(\) => \{ if \(alive && !verifying.current\)/, 'auth listener must defer work outside the auth lock');
assert.match(gate, /autoComplete="one-time-code"/);
const languages = read('app/languages.tsx');
assert.match(languages, /!FEATURES.learnerLogin && previous && previous !== languageId/, 'login edition must enter the selected corridor without a confirmation dialog');
assert.match(languages, /await setActiveLanguage\(languageId\);\s*router.push\(home as never\)/);
const admin = read('app/admin/index.tsx');
assert.match(admin, /<View style=\{s.popupPublishToolbar\}>/);
assert.ok(!admin.includes('s.publishPrimaryBtn, { flex: 1, minWidth: 210 }'));
assert.match(admin, /publishPrimaryBtnText: \{\s*fontFamily: 'Vazir-Bold',\s*fontSize: 10/);
assert.ok(admin.indexOf('<View style={s.popupPublishToolbar}>') < admin.indexOf('<PopupCardPreview'), 'publish toolbar stays outside and before the image preview');
console.log('Email OTP behavior, verified-session gate, direct language navigation and compact publish regressions passed.');
