#!/usr/bin/env node
/**
 * "بعد از باز کردن اپ، چند ثانیه طول می‌کشد تا اپ باز شود."
 *
 * Two things made the first screen slow, both on the native build:
 *   1. a hard-coded 3400 ms intro timer that gated the whole app,
 *   2. a network round-trip to Supabase before the registration gate opened.
 *
 * These checks pin the fixes: a short intro that does not block the chime, an
 * optimistic gate that opens from the local cache, and a cache that stores only
 * non-secret profile fields.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

let checks = 0;
const check = (label, value) => { assert.ok(value, label); checks += 1; console.log(`PASS ${label}`); };

const layout = read('app/_layout.tsx');
const gate = read('components/RegistrationGate.tsx');
const registration = read('lib/userRegistration.ts');
const cacheSource = read('lib/registrationCache.ts');

// --- 1. the intro no longer blocks the app for seconds ---------------------
const introMatch = layout.match(/const INTRO_DURATION_MS = (\d+);/);
check('the intro duration is a named, short constant',
  !!introMatch && Number(introMatch[1]) <= 1000);
check('the old 3.4 second intro timer is gone', !/\},\s*3400\)/.test(layout));
check('the app is revealed before the chime finishes, not after',
  /setIntroComplete\(true\);\s*\n\s*\/\/ Silence the short chime/.test(layout));
check('the chime is released on a timer instead of blocking the first screen',
  /player\?\.remove\(\)/.test(layout) && /1600/.test(layout));
check('speech engines are warmed off the critical path',
  layout.indexOf("warmSpeech('en-US');") < layout.indexOf('const finish = setTimeout'));

// --- 1b. the greeting still starts after the startup chime ----------------
const languages = read('app/languages.tsx');
const delayMatch = languages.match(/const WELCOME_DELAY_MS = (\d+);/);
check('the spoken greeting waits for the startup chime instead of talking over it',
  !!delayMatch && Number(delayMatch[1]) >= 1000);

// --- 2. the gate opens instantly from the local profile -------------------
check('the gate reads the local profile before the server check',
  gate.indexOf('readCachedRegistration()') !== -1
  && gate.indexOf('readCachedRegistration()') < gate.indexOf('void inspect()'));
check('the cached profile opens the gate without waiting for the network',
  /setReady\(current => current \|\| true\);[\s\S]{0,80}setChecking\(false\);/.test(gate));
check('the server check still runs and can close the gate again',
  /const complete = !!state\.session && !!state\.profile;/.test(gate)
  && /setReady\(complete && !holdForCode\.current\);/.test(gate));

// --- 3. the cache stores only non-secret profile fields -------------------
check('a verified profile is cached for the next launch',
  /writeCachedRegistration\(\{/.test(registration));
check('registering a new learner clears the previous cached profile',
  /clearCachedRegistration\(\);\s*\n\s*const cleanName/.test(registration));
// Strip comments first: the docstring explains what must *not* be stored.
const cacheCode = cacheSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
check('a network failure keeps the cached learner inside the app',
  /openedFromCache/.test(gate) && /if \(!openedFromCache\.current\) setReady\(false\)/.test(gate));
check('the cache never stores a token, password or login code',
  !/access_token|refresh_token|password|loginCode/i.test(cacheCode));

// --- 4. executable cache round-trip ---------------------------------------
(async () => {
  const outfile = path.join(root, 'node_modules/.cache/registration-cache.cjs');
  await esbuild.build({
    stdin: { contents: "export * from './lib/registrationCache';", resolveDir: root },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile,
    logLevel: 'silent',
    plugins: [{
      name: 'cache-stubs',
      setup(build) {
        build.onResolve({ filter: /^react-native$/ }, () => ({ path: 'react-native', namespace: 'stub' }));
        build.onResolve({ filter: /^@react-native-async-storage\/async-storage$/ }, () => ({ path: 'storage', namespace: 'stub' }));
        build.onLoad({ filter: /.*/, namespace: 'stub' }, args => {
          if (args.path === 'react-native') {
            return { contents: `export const Platform = { get OS() { return globalThis.__platform || 'android'; } };`, loader: 'js' };
          }
          return {
            contents: `const m = new Map();
              export default {
                getItem: async k => (m.has(k) ? m.get(k) : null),
                setItem: async (k, v) => { m.set(k, String(v)); },
                removeItem: async k => { m.delete(k); },
                __dump: () => Object.fromEntries(m),
              };`,
            loader: 'js',
          };
        });
      },
    }],
  });

  const store = await import(pathToFileURL(outfile));
  const app = store.default ?? store;
  globalThis.__platform = 'android';
  check('nothing is cached on a fresh install', (await app.readCachedRegistration()) === null);

  const entry = {
    userId: 'u-1',
    email: 'sara@example.com',
    createdAt: 1,
    profile: { user_id: 'u-1', full_name: 'Sara', email: 'sara@example.com', registered_at: 'now', last_seen_at: 'now' },
  };
  await app.writeCachedRegistration(entry);
  const restored = await app.readCachedRegistration();
  check('the verified learner survives a relaunch',
    restored?.userId === 'u-1' && restored?.profile?.full_name === 'Sara');
  check('the stored payload is small enough to read instantly',
    JSON.stringify(restored).length < 500);
  await app.clearCachedRegistration();
  check('signing out of the account clears the cached learner',
    (await app.readCachedRegistration()) === null);

  console.log(`\n${checks} fast-start checks passed.`);
})().catch(error => {
  console.error(error);
  process.exit(1);
});

function pathToFileURL(file) {
  return require('node:url').pathToFileURL(file).href;
}
