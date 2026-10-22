const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Ship one CPU architecture only.
 *
 * The Expo SDK 54 Android template no longer reads `reactNativeArchitectures`
 * from `defaultConfig`, so `-PreactNativeArchitectures=arm64-v8a` on the
 * Gradle command line changed nothing: the release APK still carried the
 * `armeabi-v7a`, `x86` and `x86_64` copies of every native library (tens of
 * megabytes of duplicated `.so` files that no phone in use needs).
 *
 * This plugin writes an explicit `ndk.abiFilters` into `android/app/build.gradle`
 * during prebuild, which is what AGP actually honours when it packages the APK.
 * Nothing about the app, its screens, content or audio changes — only the unused
 * machine-code copies stop being packed.
 */
const ABI = 'arm64-v8a';
const MARKER = '// @milo-single-abi';

module.exports = function withAndroidSingleAbi(config) {
  return withAppBuildGradle(config, androidConfig => {
    if (androidConfig.modResults.language !== 'groovy') return androidConfig;

    let contents = androidConfig.modResults.contents;
    if (contents.includes(MARKER)) return androidConfig;

    // Insert right after the opening of `defaultConfig {` in the app module.
    const injected = contents.replace(
      /(defaultConfig\s*\{)/,
      `$1\n        ${MARKER} — one CPU architecture (see plugins/withAndroidSingleAbi.js)\n        ndk {\n            abiFilters '${ABI}'\n        }\n`,
    );

    if (injected === contents) {
      throw new Error(
        'withAndroidSingleAbi: could not find `defaultConfig {` in android/app/build.gradle',
      );
    }

    androidConfig.modResults.contents = injected;
    return androidConfig;
  });
};
