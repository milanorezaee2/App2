const base = require('./app.json').expo;

const build = () => {
  const admin = process.env.MILO_ADMIN_APP === 'true' || process.env.EXPO_PUBLIC_MILO_ADMIN_APP === 'true';
  if (process.env.EXPO_PUBLIC_RUSSIAN_ONLY === 'true' && !admin) {
    return {
      ...base,
      name: 'MiloMultiLanguage Russian',
      slug: 'milo-russian',
      scheme: 'milorussian',
      android: {
        ...base.android,
        package: 'com.devicecontrol.milorussian',
      },
      ios: {
        ...base.ios,
        bundleIdentifier: 'com.devicecontrol.milorussian',
      },
    };
  }
  const learnerLogin = process.env.EXPO_PUBLIC_LEARNER_LOGIN === 'true';
  // Second edition: Turkish replaces the Russian track. The default edition
  // (without this flag) stays exactly as it is today.
  const turkishEdition = process.env.EXPO_PUBLIC_TURKISH_EDITION === 'true';
  if (!admin && turkishEdition) {
    return {
      ...base,
      name: 'MiloMultiLanguage Turkish',
      slug: learnerLogin ? 'milomultilanguage-turkish-login' : 'milomultilanguage-turkish',
      scheme: 'miloturkish',
      android: { ...base.android, package: 'com.devicecontrol.miloturkish' },
      ios: { ...base.ios, bundleIdentifier: 'com.devicecontrol.miloturkish' },
      extra: { ...base.extra, turkishEdition: true, learnerLogin },
    };
  }
  if (!admin && learnerLogin) {
    return {
      ...base,
      name: 'MiloMultiLanguage',
      slug: 'milomultilanguage-login',
      android: { ...base.android, package: 'com.devicecontrol.milomultilang' },
      ios: { ...base.ios, bundleIdentifier: 'com.devicecontrol.milomultilang' },
      extra: { ...base.extra, learnerLogin: true },
    };
  }
  if (!admin) {
    return {
      ...base,
      name: 'MML',
      slug: 'mml',
      android: { ...base.android, package: 'com.devicecontrol.mml' },
      ios: { ...base.ios, bundleIdentifier: 'com.devicecontrol.mml' },
      extra: { ...base.extra, learnerLogin: true },
    };
  }
  return {
    ...base,
    name: 'Adminapp',
    slug: 'milo-language-admin',
    scheme: 'miloadmin',
    android: {
      ...base.android,
      package: 'com.devicecontrol.miloadmin',
      versionCode: 1,
    },
    ios: {
      ...base.ios,
      bundleIdentifier: 'com.devicecontrol.miloadmin',
    },
    extra: {
      ...base.extra,
      appRole: 'admin',
    },
  };
};

// Expo push tokens require the EAS project id. Keep the public project id as a
// fallback so local and GitHub Actions builds cannot silently disable Push.
module.exports = () => {
  const config = build();
  const projectId = process.env.EAS_PROJECT_ID || process.env.EXPO_PUBLIC_EAS_PROJECT_ID || 'af0dc4eb-5312-4157-ad1d-e1fd71aba769';
  if (!projectId) return config;
  return {
    ...config,
    extra: { ...config.extra, eas: { ...(config.extra?.eas || {}), projectId } },
  };
};
