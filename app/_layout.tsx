import { useEffect, useState } from 'react';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SplashScreen } from 'expo-router';
import Constants from 'expo-constants';
import { I18nManager, Image, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { MiloLogoMotion } from '@/components/MiloLogoMotion';
import { KeyboardProvider } from '@/components/KeyboardRuntime';
import { createAudioPlayer } from 'expo-audio';
import { Inter_400Regular, Inter_600SemiBold, Inter_800ExtraBold } from '@expo-google-fonts/inter';
import { Vazirmatn_400Regular, Vazirmatn_500Medium, Vazirmatn_700Bold, Vazirmatn_900Black } from '@expo-google-fonts/vazirmatn';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AppLockGate } from '@/components/AppLockGate';
import { ChatNotificationBridge } from '@/components/ChatNotificationBridge';
import { RegistrationGate } from '@/components/RegistrationGate';
import { getPairingState, isOnboardingComplete } from '@/lib/storage';
import { isSupabaseConfigured } from '@/lib/pairing';
import { RtlDirection } from '@/lib/theme';
import { useRealAgent } from '@/lib/useRealAgent';
import { warmSpeech } from '@/lib/responsiveSpeech';

// Android native mirroring is disabled in withStableLayoutDirection. Persian
// and course-language direction are applied explicitly, independent of device locale.
I18nManager.allowRTL(false);
I18nManager.forceRTL(false);

// Keep typography metrics deterministic across OEM Android builds and user font
// scale settings. Accessibility labels remain available to screen readers.
type StableFontDefaults = { defaultProps?: Record<string, unknown> };
const stableText = Text as typeof Text & StableFontDefaults;
const stableInput = TextInput as typeof TextInput & StableFontDefaults;
stableText.defaultProps = {
  ...stableText.defaultProps,
  allowFontScaling: false,
  maxFontSizeMultiplier: 1,
  includeFontPadding: false,
  textBreakStrategy: 'simple',
  android_hyphenationFrequency: 'none',
};
stableInput.defaultProps = {
  ...stableInput.defaultProps,
  allowFontScaling: false,
  maxFontSizeMultiplier: 1,
  includeFontPadding: false,
};

SplashScreen.preventAutoHideAsync();

let startupChimePlayed = false;
const IS_ADMIN_APP = Constants.expoConfig?.extra?.appRole === 'admin'
  || process.env.EXPO_PUBLIC_MILO_ADMIN_APP === 'true';

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
    // Bundle Vazir locally so Persian typography and numerals stay identical
    // offline and independent of each Android manufacturer's system fonts.
    Vazir: Vazirmatn_400Regular,
    'Vazir-Medium': Vazirmatn_500Medium,
    'Vazir-Bold': Vazirmatn_700Bold,
    'Vazir-Black': Vazirmatn_900Black,
    // Latin teaching content uses bundled faces too, eliminating Android OEM
    // font and fallback-metric differences between phones.
    Inter: Inter_400Regular,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-ExtraBold': Inter_800ExtraBold,
    // Legacy aliases now resolve to Vazir too, preventing an old screen from
    // silently falling back to an OEM font.
    Lalezar: Vazirmatn_400Regular,
    Vazirmatn: Vazirmatn_400Regular,
    'Vazirmatn-Medium': Vazirmatn_500Medium,
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
    }, 2200);
    return () => clearTimeout(finish);
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;
  if (!introComplete) {
    return (
      <View style={introStyles.root}>
        <MiloLogoMotion size="intro" />
        <View style={introStyles.loader}><View style={introStyles.loaderFill} /></View>
        <StatusBar style="dark" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <KeyboardProvider>
      <ErrorBoundary>
        <SafeAreaView style={{ flex: 1, ...RtlDirection }} edges={['top', 'bottom']}>
          <AppLockGate>
            <RegistrationGate>
              {!IS_ADMIN_APP && <RuntimeGate />}
              <ChatNotificationBridge />
              <Stack screenOptions={{ headerShown: false }} initialRouteName="index">
                <Stack.Screen name="index" />
                <Stack.Screen name="admin/index" />
                <Stack.Screen name="agent" />
                <Stack.Screen name="permissions" />
                <Stack.Screen name="app-lock" />
                <Stack.Screen name="lang/index" />
                <Stack.Screen name="+not-found" />
              </Stack>
            </RegistrationGate>
          </AppLockGate>
          <StatusBar style="dark" />
        </SafeAreaView>
      </ErrorBoundary>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}

const introStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5FAFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  image: { width: 280, height: 280, marginBottom: -12 },
  brand: { fontFamily: 'Inter-ExtraBold', color: '#102A56', fontSize: 24, lineHeight: 31, fontWeight: '800', letterSpacing: 5, writingDirection: 'ltr' },
  caption: { fontFamily: 'Inter-ExtraBold', color: '#6882A6', fontSize: 7, fontWeight: '800', letterSpacing: 2.1, writingDirection: 'ltr', marginTop: 2 },
  loader: { width: 92, height: 3, borderRadius: 99, overflow: 'hidden', backgroundColor: '#DCE9F8', marginTop: 24 },
  loaderFill: { width: '100%', height: '100%', borderRadius: 99, backgroundColor: '#2878DE' },
});
