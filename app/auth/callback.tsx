import { Redirect } from 'expo-router';

/** RegistrationGate completes PKCE before any protected route can mount. */
export default function AuthCallback() {
  return <Redirect href="/languages" />;
}
