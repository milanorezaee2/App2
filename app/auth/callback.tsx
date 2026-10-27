import { Redirect } from 'expo-router';
import { FEATURES } from '@/lib/features';

/** RegistrationGate completes PKCE before any protected route can mount. */
export default function AuthCallback() {
  return <Redirect href={FEATURES.learnerLogin ? "/journey" : "/languages"} />;
}
