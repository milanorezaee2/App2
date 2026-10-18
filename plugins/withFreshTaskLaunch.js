const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Every re-launch of the app's task from the launcher (icon tap or recents)
 * restarts the run from the beginning: the complete MiloMultiLanguage startup
 * phrase plays and the app then always shows the first page — under any
 * condition. User progress is untouched by this: lessons, marks and history
 * live in AsyncStorage and Supabase and survive every restart, so nobody ever
 * has to start their learning over.
 */
module.exports = function withFreshTaskLaunch(config) {
  return withAndroidManifest(config, androidConfig => {
    const activities = androidConfig.modResults.manifest.application?.[0]?.activity ?? [];
    for (const activity of activities) {
      const name = activity.$?.['android:name'] ?? '';
      if (!name.endsWith('MainActivity')) continue;
      activity.$ = activity.$ || {};
      activity.$['android:finishOnTaskLaunch'] = 'true';
    }
    return androidConfig;
  });
};
