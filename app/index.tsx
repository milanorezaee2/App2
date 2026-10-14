import { Redirect } from 'expo-router';

/** Each APK has a single clear role: learner or private management. */
export default function Index() {
  if (process.env.EXPO_PUBLIC_MILO_ADMIN_APP === 'true') {
    return <Redirect href={'/admin' as never} />;
  }
  return <Redirect href={'/languages' as never} />;
}
