import { useEffect, useState } from 'react';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SplashScreen } from 'expo-router';
import { I18nManager, Image, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createAudioPlayer } from 'expo-audio';
import { Vazirmatn_700Bold } from '@expo-google-fonts/vazirmatn';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { getPairingState, isOnboardingComplete } from '@/lib/storage';
import { isSupabaseConfigured } from '@/lib/pairing';
import { RtlDirection } from '@/lib/theme';
import { useRealAgent } from '@/lib/useRealAgent';
import { warmSpeech } from '@/lib/responsiveSpeech';

// Older React Native builds do not expose this switch at runtime.
(I18nManager as typeof I18nManager & { swapLeftAndRightInRTL?: (value: boolean) => void })
  .swapLeftAndRightInRTL?.(false);
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
  const [introComplete, setIntroComplete] = useState(Platform.OS === 'web');
  const [fontsLoaded, fontError] = useFonts({
    // Persian copy uses the bold Vazirmatn face throughout the application.
    Vazirmatn: Vazirmatn_700Bold,
    'Vazirmatn-Medium': Vazirmatn_700Bold,
    'Vazirmatn-Bold': Vazirmatn_700Bold,
  });

  useEffect(() => {
    if (!fontsLoaded && !fontError) return;
    void SplashScreen.hideAsync();

    if (Platform.OS === 'web') {
      setIntroComplete(true);
      return;
    }
    if (startupChimePlayed) {
      setIntroComplete(true);
      return;
    }

    // The React splash and the 1.65-second chime start and finish together.
    // It follows the native splash seamlessly, so there is no dark flash.
    startupChimePlayed = true;
    let player: ReturnType<typeof createAudioPlayer> | null = null;
    try {
      player = createAudioPlayer(require('../assets/audio/welcome-chime.wav'));
      player.volume = 0.28;
      player.play();
    } catch {
      // A device without playback support still receives the same visual intro.
    }
    const finish = setTimeout(() => {
      player?.remove();
      setIntroComplete(true);
      warmSpeech('en-US');
      setTimeout(() => warmSpeech('de-DE'), 350);
    }, 1650);
    return () => clearTimeout(finish);
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;
  if (!introComplete) {
    return (
      <View style={introStyles.root}>
        <Image source={require('../assets/images/splash-learning-light.png')} resizeMode="contain" style={introStyles.image} />
        <Text style={introStyles.brand}>MILO</Text>
        <Text style={introStyles.caption}>LANGUAGE LEARNING</Text>
        <View style={introStyles.loader}><View style={introStyles.loaderFill} /></View>
        <StatusBar style="dark" />
      </View>
    );
  }

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
          <StatusBar style="dark" />
        </View>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const introStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5FAFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  image: { width: 280, height: 280, marginBottom: -12 },
  brand: { color: '#102A56', fontSize: 24, lineHeight: 31, fontWeight: '800', letterSpacing: 5, writingDirection: 'ltr' },
  caption: { color: '#6882A6', fontSize: 7, fontWeight: '800', letterSpacing: 2.1, writingDirection: 'ltr', marginTop: 2 },
  loader: { width: 92, height: 3, borderRadius: 99, overflow: 'hidden', backgroundColor: '#DCE9F8', marginTop: 24 },
  loaderFill: { width: '100%', height: '100%', borderRadius: 99, backgroundColor: '#2878DE' },
});
