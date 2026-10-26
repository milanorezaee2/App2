import { useEffect } from 'react';
import Constants from 'expo-constants';
import { Redirect, useRouter } from 'expo-router';
import { RUSSIAN_ONLY_BUILD, TURKISH_EDITION } from '@/lib/features';

/** Each APK has a single clear role: learner or private management. */
export default function Index() {
  const router = useRouter();
  const admin = Constants.expoConfig?.extra?.appRole === 'admin'
    || process.env.EXPO_PUBLIC_MILO_ADMIN_APP === 'true';
  // Each edition has one obvious entry point: Russian-only and Turkish editions
  // open their own course directly, the default edition opens the catalog.
  const target = admin
    ? '/admin'
    : TURKISH_EDITION
      ? '/learn/tr'
      : RUSSIAN_ONLY_BUILD
        ? '/learn/ru'
        : '/languages';

  // Replace the launch entry so a stale deep link cannot reopen the
  // pronunciation workshop as the app's startup screen.
  useEffect(() => {
    router.replace(target as never);
  }, [router, target]);

  return <Redirect href={target as never} />;
}
