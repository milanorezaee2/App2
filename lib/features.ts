import Constants from 'expo-constants';

/** Deployment switches, not authorization. Server roles/RLS remain mandatory. */
const privateAdminBuild = Constants.expoConfig?.extra?.appRole === 'admin';
const educationAdminEnabled = privateAdminBuild || process.env.EXPO_PUBLIC_ENABLE_EDUCATION_ADMIN === 'true';
/** Build-time switch: a learner APK that contains only the Russian course. */
export const RUSSIAN_ONLY_BUILD = process.env.EXPO_PUBLIC_RUSSIAN_ONLY === 'true';

export const FEATURES = Object.freeze({
  /**
   * Learner login/registration screen. Temporarily OFF: the app opens directly.
   * Set to true to restore the registration gate (code is kept intact).
   */
  learnerLogin: false,
  adminPanel: educationAdminEnabled,
  educationEnrollment: educationAdminEnabled,
  // Roadmap modules are not implemented yet. Enabling a boolean cannot build them.
  contentEditor: false,
  assignments: false,
  announcements: false,
  billing: false,
  germanAI: false,
  russianCourse: true,
});
