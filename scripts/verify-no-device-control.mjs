import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const app = JSON.parse(fs.readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;
const blocked = new Set(app.android?.blockedPermissions || []);
const forbiddenPermissions = [
  'android.permission.ACCESS_BACKGROUND_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.BIND_ACCESSIBILITY_SERVICE',
  'android.permission.CAMERA',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.WRITE_EXTERNAL_STORAGE',
];
for (const permission of forbiddenPermissions) {
  assert.ok(blocked.has(permission), `Android must block ${permission}`);
  assert.ok(!(app.android?.permissions || []).includes(permission), `${permission} must not be explicitly requested`);
}

const forbiddenPlugins = [
  './plugins/withCompanionAccessibility',
  './plugins/withMediaProjectionService',
];
const plugins = JSON.stringify(app.plugins || []);
for (const plugin of forbiddenPlugins) assert.ok(!plugins.includes(plugin), `${plugin} must not be included`);
assert.ok(plugins.includes('./plugins/withRemoveScreenCaptureService'), 'The WebRTC screen-capture service must be removed during Android manifest merge');

const rootLayout = fs.readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
assert.ok(!rootLayout.includes('useRealAgent') && !rootLayout.includes('RuntimeGate'), 'The hidden remote-device runtime must not be mounted');
assert.ok(!rootLayout.includes('name="agent"') && !rootLayout.includes('name="permissions"'), 'Device-control routes must not be registered');

const removedAppFiles = [
  '../app/agent/index.tsx',
  '../app/agent/pair.tsx',
  '../app/permissions.tsx',
  '../lib/useRealAgent.ts',
  '../lib/pairing.ts',
  '../lib/accessibilityControl.native.ts',
  '../lib/accessibilityControl.ts',
  '../lib/liveScreen.native.tsx',
  '../lib/liveScreen.tsx',
  '../lib/liveScreen.web.tsx',
  '../plugins/withCompanionAccessibility.js',
  '../plugins/withMediaProjectionService.js',
];
for (const file of removedAppFiles) {
  assert.ok(!fs.existsSync(new URL(file, import.meta.url)), `Removed device-control module still exists: ${file}`);
}

const lock = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
for (const dependency of ['expo-battery', 'expo-camera', 'expo-location', 'expo-network']) {
  assert.ok(!lock.dependencies?.[dependency], `Unused device-control dependency remains: ${dependency}`);
}

const apkPaths = process.argv.slice(2);
if (apkPaths.length) {
  const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  assert.ok(sdkRoot, 'ANDROID_HOME or ANDROID_SDK_ROOT must be set to inspect APK manifests');
  const buildTools = path.join(sdkRoot, 'build-tools');
  const version = fs.readdirSync(buildTools).filter(name => /^\d+\.\d+\.\d+$/.test(name)).sort().at(-1);
  assert.ok(version, 'Android build-tools are not installed');
  const aapt = path.join(buildTools, version, process.platform === 'win32' ? 'aapt.exe' : 'aapt');

  for (const apk of apkPaths) {
    assert.ok(fs.statSync(apk).isFile(), `APK not found: ${apk}`);
    const manifest = execFileSync(aapt, ['dump', 'xmltree', apk, 'AndroidManifest.xml'], { encoding: 'utf8' });
    for (const forbidden of [
      'BIND_ACCESSIBILITY_SERVICE',
      'CompanionAccessibilityService',
      'com.oney.WebRTCModule.MediaProjectionService',
      'FOREGROUND_SERVICE_MEDIA_PROJECTION',
      'ACCESS_BACKGROUND_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'SYSTEM_ALERT_WINDOW',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
      'android.permission.CAMERA',
    ]) {
      assert.ok(!manifest.includes(forbidden), `${apk} still contains ${forbidden}`);
    }
  }
  console.log(`Phone-control routes, services and sensitive permissions are absent from ${apkPaths.length} APK(s).`);
} else {
  console.log('Phone-control routes, native plugins and sensitive permissions are removed from the app configuration.');
}
