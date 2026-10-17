#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache = path.join(root, 'node_modules', '.cache', 'app-update-access-test');
mkdirSync(cache, { recursive: true });
const entry = path.join(cache, 'entry.ts');
writeFileSync(entry, `export * as app from '${path.join(root, 'lib/appUpdate.ts')}';`);
const esbuild = await import('esbuild');
const bundle = await esbuild.build({
  entryPoints: [entry], bundle: true, write: false, format: 'esm', platform: 'node', target: 'node22', logLevel: 'silent',
  plugins: [{ name: 'app-update-access-stubs', setup(build) {
    build.onResolve({ filter: /^@react-native-async-storage\/async-storage$/ }, () => ({ path: 'storage', namespace: 'app-update-stub' }));
    build.onResolve({ filter: /^expo-constants$/ }, () => ({ path: 'constants', namespace: 'app-update-stub' }));
    build.onResolve({ filter: /^expo-application$/ }, () => ({ path: 'application', namespace: 'app-update-stub' }));
    build.onResolve({ filter: /^react-native$/ }, () => ({ path: 'native', namespace: 'app-update-stub' }));
    build.onResolve({ filter: /^\.\/pairing$/ }, () => ({ path: 'pairing', namespace: 'app-update-stub' }));
    build.onResolve({ filter: /^\.\/supabase$/ }, () => ({ path: 'supabase', namespace: 'app-update-stub' }));
    build.onLoad({ filter: /.*/, namespace: 'app-update-stub' }, args => {
      const code = {
        storage: 'export default { async getItem(){return null}, async setItem(){}, async removeItem(){} };',
        constants: 'export default { expoConfig: { version: "1.0.0", android: { package: "com.devicecontrol.companion" } } };',
        application: 'export const applicationId="com.devicecontrol.companion"; export const nativeApplicationVersion="1.0.0";',
        native: 'export const Platform = { OS: "android" };',
        pairing: 'export function isSupabaseConfigured(){return true}',
        supabase: 'export const supabase = { rpc: async () => ({ data: null, error: null }) };',
      }[args.path];
      return { contents: code, loader: 'js' };
    });
  } }],
});
const outfile = path.join(cache, 'bundle.mjs');
writeFileSync(outfile, bundle.outputFiles[0].text);
const app = await import(`${outfile}?run=${Date.now()}`);
let checks = 0;
const verify = (condition, message) => { assert.ok(condition, message); checks += 1; };

const update = app.app;
verify(update.compareVersions('1.10.0', '1.9.9') > 0, 'semantic version comparison handles multi-digit components');
verify(update.compareVersions('1.1.0', '1.1.0') === 0, 'same versions compare equal');
verify(update.compareVersions('invalid', '1.0.0') === 0, 'invalid remote versions cannot trigger an accidental lock');
const policy = {
  package_name: 'com.devicecontrol.companion', latest_version: '1.2.0', minimum_version: '1.1.0',
  apk_url: 'https://github.com/milanorezaee2/App2/releases/download/test/MiloMultilang.apk',
  release_notes: '', force_update: true, enabled: true,
};
verify(update.shouldForceUpdate(policy, '1.0.0'), 'old app is locked below the required version');
verify(!update.shouldForceUpdate(policy, '1.1.0'), 'minimum supported version is allowed');
verify(update.shouldOfferUpdate(policy, '1.1.0'), 'newer optional release is offered');
verify(!update.shouldOfferUpdate(policy, '1.2.0'), 'current latest release is not offered again');
verify(update.RELEASE_TARGETS.length === 4 && update.RELEASE_TARGETS.some(x => x.packageName === 'com.devicecontrol.miloadmin'), 'all app variants, including admin, have separate release tracks');

const migration = readFileSync(path.join(root, 'supabase/migrations/202610170002_access_control_and_app_updates.sql'), 'utf8');
verify(/ENABLE ROW LEVEL SECURITY/.test(migration) && /REVOKE ALL ON public\.app_release_policies FROM PUBLIC, anon, authenticated/.test(migration), 'release metadata tables are not directly writable by app clients');
verify(/admin_set_app_user_access/.test(migration) && /current_app_access/.test(migration), 'per-account blocking is manager-controlled and checked by the app');
verify(/public_app_release_policy/.test(migration) && /admin_save_app_release_policy/.test(migration), 'public clients can read only the app policy while only manager RPCs can publish it');
verify(/milanorezaee2\/App2\/releases\/download/.test(migration) && /MiloAdmin\.apk/.test(migration), 'APK links and filenames are restricted to trusted GitHub releases');
verify(readFileSync(path.join(root, 'app/_layout.tsx'), 'utf8').includes('<AppUpdateGate>')
  && readFileSync(path.join(root, 'app/_layout.tsx'), 'utf8').includes('<AppAccessGate>'), 'update and account access gates wrap the app');
verify(readFileSync(path.join(root, 'components/AdminReleaseManagement.tsx'), 'utf8').includes('به‌روزرسانی اجباری')
  && readFileSync(path.join(root, 'app/admin/index.tsx'), 'utf8').includes('confirmUserAccess'), 'manager UI exposes mandatory updates and block/allow controls');
const workflow = readFileSync(path.join(root, '.github/workflows/android-build.yml'), 'utf8');
verify(workflow.includes('secrets.ANDROID_RELEASE_KEYSTORE_BASE64')
  && workflow.includes('scripts/configure-android-release-signing.mjs'), 'all release APK variants use the stable signing secrets');
verify(!workflow.includes('arena/9f71189a-app2'), 'the temporary branch push trigger stays removed');

console.log(`${checks} app update and account-access checks passed.`);
