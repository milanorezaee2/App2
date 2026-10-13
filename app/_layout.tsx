import { useEffect, useState } from 'react';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SplashScreen } from 'expo-router';
import { I18nManager, Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createAudioPlayer } from 'expo-audio';
import {
  Vazirmatn_400Regular,
  Vazirmatn_500Medium,
  Vazirmatn_700Bold,
} from '@expo-google-fonts/vazirmatn';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { getPairingState, isOnboardingComplete } from '@/lib/storage';
import { isSupabaseConfigured } from '@/lib/pairing';
import { RtlDirection } from '@/lib/theme';
import { useRealAgent } from '@/lib/useRealAgent';
import { warmSpeech } from '@/lib/responsiveSpeech';

I18nManager.forceRTL(true);
I18nManager.allowRTL(true);
SplashScreen.preventAutoHideAsync();

let startupChimePlayed = false;

function RuntimeGate() {
  const pathname = usePathname();
  // The multi-language learning app never mounts the legacy device runtime.
  if (!pathname.startsWith('/agent') && !pathname.startsWith('/permissions')) return null;
  return <CompanionRuntime />;
}

function CompanionRuntime() {
  const pathname = usePathname();
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    Promise.all([getPairingState(), isOnboardingComplete()])
      .then(([pairing, complete]) => {
        setDeviceId(pairing?.deviceId ?? null);
        setEnabled(!!pairing && complete && isSupabaseConfigured());
      })
      .catch(() => {
        setDeviceId(null);
        setEnabled(false);
      });
  }, [pathname]);

  // Runs invisibly while the user studies: heartbeat, device status and
  // supported commands continue without exposing a complicated control UI.
  useRealAgent(deviceId, enabled);
  return null;
}

/**
 * Phone-2 companion only. There is no role chooser and no controller route in
 * this APK; it always boots into the companion connection screen.
 */
export default function RootLayout() {
  useFrameworkReady();
  const pathname = usePathname();
  const [fontsLoaded, fontError] = useFonts({
    Vazirmatn: Vazirmatn_400Regular,
    'Vazirmatn-Medium': Vazirmatn_500Medium,
    'Vazirmatn-Bold': Vazirmatn_700Bold,
  });

  useEffect(() => {
    if (!fontsLoaded && !fontError) return;
    void SplashScreen.hideAsync();

    // Keep the existing splash duration: the chime begins only as the ready app
    // replaces the native splash, and it never delays navigation.
    if (Platform.OS !== 'web' && !startupChimePlayed) {
      startupChimePlayed = true;
      try {
        const player = createAudioPlayer(require('../assets/audio/welcome-chime.wav'));
        player.volume = 0.32;
        player.play();
        setTimeout(() => player.remove(), 2400);
        // Prime both native TTS voices after the opening chime, well before a
        // learner reaches a lesson sound button.
        setTimeout(() => {
          warmSpeech('en-US');
          setTimeout(() => warmSpeech('de-DE'), 350);
        }, 1900);
      } catch {
        // Audio must never block startup on devices with unavailable playback.
      }
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <View style={{ flex: 1, ...RtlDirection }}>
          <RuntimeGate />
          <Stack screenOptions={{ headerShown: false }} initialRouteName="index">
            <Stack.Screen name="index" />
            <Stack.Screen name="agent" />
            <Stack.Screen name="permissions" />
            <Stack.Screen name="lang/index" />
            <Stack.Screen name="+not-found" />
          </Stack>
          <StatusBar style={pathname === '/lang' || pathname === '/languages' ? 'dark' : 'light'} />
        </View>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
