import Constants from 'expo-constants';

/** Deployment switches, not authorization. Server roles/RLS remain mandatory. */
const privateAdminBuild = Constants.expoConfig?.extra?.appRole === 'admin';
const educationAdminEnabled = privateAdminBuild || process.env.EXPO_PUBLIC_ENABLE_EDUCATION_ADMIN === 'true';
/** True in the private manager APK. Chat and user tools then run as the manager. */
export const MANAGEMENT_BUILD = privateAdminBuild || process.env.EXPO_PUBLIC_MILO_ADMIN_APP === 'true';
/** Build-time switch: a learner APK that contains only the Russian course. */
export const RUSSIAN_ONLY_BUILD = process.env.EXPO_PUBLIC_RUSSIAN_ONLY === 'true';
/**
 * Build-time switch for the second edition of the app: the Turkish course takes
 * the place of the Russian track. Both editions share the same code base, login
 * and design; only the language catalog and the entry route differ.
 */
export const TURKISH_EDITION = Constants.expoConfig?.extra?.turkishEdition === true
  || process.env.EXPO_PUBLIC_TURKISH_EDITION === 'true';

export const FEATURES = Object.freeze({
  /**
   * Learner login/registration screen. Temporarily OFF: the app opens directly.
   * Set to true to restore the registration gate (code is kept intact).
   */
  // Read from Expo extra so release APKs keep the login identity at runtime;
  // Metro does not reliably preserve arbitrary build-shell environment flags.
  learnerLogin: Constants.expoConfig?.extra?.learnerLogin === true
    || process.env.EXPO_PUBLIC_LEARNER_LOGIN === 'true',
  adminPanel: educationAdminEnabled,
  educationEnrollment: educationAdminEnabled,
  // Roadmap modules are not implemented yet. Enabling a boolean cannot build them.
  contentEditor: false,
  assignments: false,
  announcements: false,
  billing: false,
  germanAI: false,
  /** Russian track follows the edition: hidden in the Turkish edition. */
  russianCourse: !TURKISH_EDITION,
  /** Turkish track is only advertised in the Turkish edition. */
  turkishCourse: TURKISH_EDITION,
});
