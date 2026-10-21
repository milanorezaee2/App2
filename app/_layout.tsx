import { useEffect, useRef, useState } from 'react';
import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SplashScreen } from 'expo-router';
import Constants from 'expo-constants';
import { AppState, I18nManager, Image, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { MiloLogoMotion } from '@/components/MiloLogoMotion';
import { KeyboardProvider } from '@/components/KeyboardRuntime';
import { createAudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';
import { registerNativeVoiceFetcher } from '@/lib/speechLanguage';

registerNativeVoiceFetcher(() => Speech.getAvailableVoicesAsync());
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
import { clearLegacyGermanVoiceChoices } from '@/lib/germanSpeech';
import { RUSSIAN_ONLY_BUILD } from '@/lib/features';

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
  style: [{ fontFamily: 'Vazir' }, (stableText.defaultProps as { style?: unknown } | undefined)?.style],
};
stableInput.defaultProps = {
  ...stableInput.defaultProps,
  allowFontScaling: false,
  maxFontSizeMultiplier: 1,
  includeFontPadding: false,
};

SplashScreen.preventAutoHideAsync();

let startupChimePlayed = false;
/**
 * How long the brand animation stays up before the first screen appears.
 *
 * The animation itself finishes at ~615 ms (see `components/MiloLogoMotion.tsx`),
 * so this leaves ~0.6 s in which "Milo / MULTILANGUAGE" sits still and can be
 * read. It used to be 900 ms — the learner only caught the word "Milo" before
 * the app opened — and before that a hard 3400 ms on every launch, which is why
 * this is a single explicit number rather than an open-ended splash.
 */
const INTRO_DURATION_MS = 1200;
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
  const router = useRouter();
  const pathname = usePathname();
  const homeRoute = IS_ADMIN_APP ? '/admin' : RUSSIAN_ONLY_BUILD ? '/learn/ru' : '/languages';
  const pathnameRef = useRef(pathname);
  const wasBackgrounded = useRef(false);
  const startupRouteLocked = useRef(false);
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

  // An install that was upgraded from a build with a voice picker may still hold
  // the old device-voice choice. The German course has one narrator now, so that
  // stored choice is deleted once, off the startup path.
  useEffect(() => {
    clearLegacyGermanVoiceChoices();
  }, []);

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

    // The brand animation is a short greeting, not a loading screen: the app used
    // to stay on it for a fixed 3.4 s on every launch, which is the "app takes
    // seconds to open" complaint. It now stays exactly as long as the complete
    // logo needs — the mark, the whole word "Milo" and the MULTILANGUAGE line
    // underneath — so the name is never cut off after a flash of "Milo" only.
    // The chime keeps playing on top of the first screen instead of blocking it.
    startupChimePlayed = true;
    let player: ReturnType<typeof createAudioPlayer> | null = null;
    try {
      player = createAudioPlayer(require('../assets/audio/welcome-chime.wav'));
      player.volume = 0.28;
      player.play();
    } catch {
      // A device without playback support still receives the same visual intro.
    }
    // Warm the speech engines off the critical path, right away.
    warmSpeech('en-US');
    setTimeout(() => warmSpeech('de-DE'), 350);
    const finish = setTimeout(() => {
      setIntroComplete(true);
      // Silence the short chime once its natural length has passed.
      setTimeout(() => {
        try {
          player?.remove();
        } catch {
          /* already released */
        }
      }, 1600);
    }, INTRO_DURATION_MS);
    return () => clearTimeout(finish);
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // Returning to the app after leaving it should always start from the same
  // language chooser/home, not the last nested lesson, library, or conversation.
  // Only a real background -> active transition triggers this; temporary native
  // dialogs and permission prompts do not reset navigation.
  useEffect(() => {
    if (Platform.OS === 'web' || !introComplete) return;
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'background') {
        wasBackgrounded.current = true;
        return;
      }
      if (state === 'active' && wasBackgrounded.current) {
        wasBackgrounded.current = false;
        if (pathnameRef.current !== homeRoute) router.replace(homeRoute as never);
      }
    });
    return () => subscription.remove();
  }, [homeRoute, introComplete, router]);

  // Android can restore the last native navigation state (including a chat
  // route) instead of mounting index.tsx. Always normalize the first route of
  // a fresh app process to the correct home screen.
  useEffect(() => {
    if (!introComplete || startupRouteLocked.current) return;
    startupRouteLocked.current = true;
    if (Platform.OS === 'web') return;
    if (pathname !== homeRoute) router.replace(homeRoute as never);
  }, [homeRoute, introComplete, pathname, router]);

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
              <Stack screenOptions={{ headerShown: false }} initialRouteName="index">
                <Stack.Screen name="index" />
                <Stack.Screen name="admin/index" />
                <Stack.Screen name="agent" />
                <Stack.Screen name="permissions" />
                <Stack.Screen name="app-lock" />
                <Stack.Screen name="lang/index" />
                <Stack.Screen name="+not-found" />
              </Stack>
              <ChatNotificationBridge />
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
