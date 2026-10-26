const base = require('./app.json').expo;

/**
 * Official 4-APK Milo Android Suite (in strict release order):
 *  1. Admin App (`MILO_ADMIN_APP=true`)
 *     -> package `com.devicecontrol.miloadmin`, manages Login Learner App ONLY
 *  2. Learner No-Login EN+RU (`EXPO_PUBLIC_APP_EDITION=en_ru`)
 *     -> package `com.devicecontrol.mml`, English + Russian ONLY, no login
 *  3. Learner No-Login All 4 Languages (`EXPO_PUBLIC_APP_EDITION=all_four`)
 *     -> package `com.devicecontrol.miloall`, English + German + Russian + Turkish, no login
 *  4. Learner With-Login EN+DE+TR (`EXPO_PUBLIC_LEARNER_LOGIN=true` / `edition=login_en_de_tr`)
 *     -> package `com.devicecontrol.milomultilang`, English + German + Turkish (NO Russian), cloud login + Admin control
 */
const build = () => {
  const admin = process.env.MILO_ADMIN_APP === 'true' || process.env.EXPO_PUBLIC_MILO_ADMIN_APP === 'true';
  if (admin) {
    return {
      ...base,
      name: 'Adminapp',
      slug: 'milo-language-admin',
      scheme: 'miloadmin',
      android: {
        ...base.android,
        package: 'com.devicecontrol.miloadmin',
        versionCode: 3,
      },
      ios: {
        ...base.ios,
        bundleIdentifier: 'com.devicecontrol.miloadmin',
      },
      extra: {
        ...base.extra,
        appRole: 'admin',
        edition: 'admin',
      },
    };
  }

  if (process.env.EXPO_PUBLIC_RUSSIAN_ONLY === 'true') {
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

  const edition = (process.env.EXPO_PUBLIC_APP_EDITION || '').trim();
  const learnerLogin = process.env.EXPO_PUBLIC_LEARNER_LOGIN === 'true' || edition === 'login_en_de_tr';

  // App #4: With-Login Learner App (English + German + Turkish ONLY — NEVER Russian)
  if (learnerLogin) {
    return {
      ...base,
      name: 'MiloMultiLanguage',
      slug: 'milomultilanguage-login',
      scheme: 'milologin',
      android: { ...base.android, package: 'com.devicecontrol.milomultilang' },
      ios: { ...base.ios, bundleIdentifier: 'com.devicecontrol.milomultilang' },
      extra: {
        ...base.extra,
        edition: 'login_en_de_tr',
        learnerLogin: true,
        turkishEdition: true,
        englishCourse: true,
        germanCourse: true,
        russianCourse: false,
        turkishCourse: true,
      },
    };
  }

  // App #3: No-Login Learner App with ALL 4 languages (English + German + Russian + Turkish)
  if (edition === 'all_four') {
    return {
      ...base,
      name: 'Milo 4Lang',
      slug: 'milo-all-languages',
      scheme: 'miloall',
      android: { ...base.android, package: 'com.devicecontrol.miloall' },
      ios: { ...base.ios, bundleIdentifier: 'com.devicecontrol.miloall' },
      extra: {
        ...base.extra,
        edition: 'all_four',
        learnerLogin: false,
        englishCourse: true,
        germanCourse: true,
        russianCourse: true,
        turkishCourse: true,
      },
    };
  }

  // Legacy Turkish-only edition switch preserved for course validation scripts
  if (process.env.EXPO_PUBLIC_TURKISH_EDITION === 'true') {
    return {
      ...base,
      name: 'Milo Turkish',
      slug: 'milomultilanguage-turkish',
      scheme: 'miloturkish',
      android: { ...base.android, package: 'com.devicecontrol.miloturkish' },
      ios: { ...base.ios, bundleIdentifier: 'com.devicecontrol.miloturkish' },
      extra: {
        ...base.extra,
        edition: 'turkish',
        turkishEdition: true,
        learnerLogin: false,
        englishCourse: true,
        germanCourse: true,
        russianCourse: false,
        turkishCourse: true,
      },
    };
  }

  // App #2 (Default no-login APK): English + Russian ONLY (`en_ru`)
  return {
    ...base,
    name: 'Milo EN-RU',
    slug: 'mml',
    scheme: 'companionenglish',
    android: { ...base.android, package: 'com.devicecontrol.mml' },
    ios: { ...base.ios, bundleIdentifier: 'com.devicecontrol.mml' },
    extra: {
      ...base.extra,
      edition: edition === 'en_ru' ? 'en_ru' : 'en_ru',
      learnerLogin: false,
      englishCourse: true,
      germanCourse: false,
      russianCourse: true,
      turkishCourse: false,
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
