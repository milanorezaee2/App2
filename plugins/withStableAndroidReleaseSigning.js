const { withAppBuildGradle } = require('@expo/config-plugins');

/** Use one owner-controlled keystore for every published APK variant. */
module.exports = function withStableAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, config => {
    if (config.modResults.language !== 'groovy') {
      throw new Error('Stable Android signing currently expects the generated Groovy app/build.gradle file.');
    }
    let contents = config.modResults.contents;
    const signingStart = contents.indexOf('    signingConfigs {');
    if (signingStart < 0) throw new Error('Android signingConfigs block was not found.');
    const signingEnd = contents.indexOf('\n    }', signingStart + '    signingConfigs {'.length);
    if (signingEnd < 0) throw new Error('Android signingConfigs block could not be parsed.');
    const releaseConfig = [
      '        release {',
      '            storeFile file("release-key.p12")',
      '            storeType "PKCS12"',
      '            storePassword findProperty("ANDROID_RELEASE_STORE_PASSWORD") ?: ""',
      '            keyAlias findProperty("ANDROID_RELEASE_KEY_ALIAS") ?: ""',
      '            keyPassword findProperty("ANDROID_RELEASE_KEY_PASSWORD") ?: ""',
      '        }',
    ].join('\n');
    contents = `${contents.slice(0, signingEnd)}\n${releaseConfig}${contents.slice(signingEnd)}`;

    const buildTypesStart = contents.indexOf('    buildTypes {');
    const releaseStart = contents.indexOf('        release {', buildTypesStart);
    const releaseSigning = contents.indexOf('signingConfig signingConfigs.debug', releaseStart);
    if (buildTypesStart < 0 || releaseStart < 0 || releaseSigning < 0) {
      throw new Error('Android release signing configuration could not be patched safely.');
    }
    contents = `${contents.slice(0, releaseSigning)}signingConfig signingConfigs.release${contents.slice(releaseSigning + 'signingConfig signingConfigs.debug'.length)}`;
    config.modResults.contents = contents;
    return config;
  });
};
