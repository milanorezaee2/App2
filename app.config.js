const base = require('./app.json').expo;

const build = () => {
  const admin = process.env.MILO_ADMIN_APP === 'true' || process.env.EXPO_PUBLIC_MILO_ADMIN_APP === 'true';
  if (process.env.EXPO_PUBLIC_RUSSIAN_ONLY === 'true' && !admin) {
    return {
      ...base,
      name: 'Milo Russian',
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
  if (!admin && learnerLogin) {
    return {
      ...base,
      name: 'Milo MultiLanguage Login',
      android: { ...base.android, package: 'com.devicecontrol.milomultilang' },
      ios: { ...base.ios, bundleIdentifier: 'com.devicecontrol.milomultilang' },
      extra: { ...base.extra, learnerLogin: true },
    };
  }
  if (!admin) return base;
  return {
    ...base,
    name: 'Milo Admin',
    slug: 'milo-language-admin',
    scheme: 'miloadmin',
    android: {
      ...base.android,
      package: 'com.devicecontrol.miloadmin',
      versionCode: 4,
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

// EAS project id comes from the EAS_PROJECT_ID env (set in CI from a repo variable),
// which Expo push tokens require. Without it, push registration is skipped.
module.exports = () => {
  const config = build();
  const projectId = process.env.EAS_PROJECT_ID || process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (!projectId) return config;
  return {
    ...config,
    extra: { ...config.extra, eas: { ...(config.extra?.eas || {}), projectId } },
  };
};
