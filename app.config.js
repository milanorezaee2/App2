const base = require('./app.json').expo;

module.exports = () => {
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
  if (!admin) return base;
  return {
    ...base,
    name: 'Milo Admin',
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
