import Constants from 'expo-constants';
import { Redirect } from 'expo-router';
import { RUSSIAN_ONLY_BUILD } from '@/lib/features';

/** Each APK has a single clear role: learner or private management. */
export default function Index() {
  const admin = Constants.expoConfig?.extra?.appRole === 'admin'
    || process.env.EXPO_PUBLIC_MILO_ADMIN_APP === 'true';
  if (!admin && RUSSIAN_ONLY_BUILD) return <Redirect href={'/learn/ru' as never} />;
  return <Redirect href={(admin ? '/admin' : '/languages') as never} />;
}
