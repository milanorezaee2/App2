import { Platform } from 'react-native';

export type SpeechVoiceInfo = {
  identifier: string;
  name: string;
  language: string;
  quality?: string;
  /** Web Speech API only: true when the voice is installed on the device. */
  localService?: boolean;
  isDefault?: boolean;
};

type NativeVoiceFetcher = () => Promise<SpeechVoiceInfo[]>;

let nativeVoiceFetcher: NativeVoiceFetcher | null = null;

export function registerNativeVoiceFetcher(fetcher: NativeVoiceFetcher): void {
  nativeVoiceFetcher = fetcher;
  cachedVoices = null;
}

/**
 * Normalizes a BCP-47 speech locale for the current platform's TTS engine.
 *
 * On Android, `expo-speech` constructs `java.util.Locale(language)` with a single
 * string argument instead of `Locale.forLanguageTag(language)`, causing hyphenated
 * tags like `"de-DE"` to become an invalid `Locale("de-de", "")` and silently fall
 * back to `Locale.getDefault()` (an English US operator reading German words!).
 * Passing primary ISO-639 code `"de"` on Android yields a valid `Locale("de")`
 * while pairing with an explicit native `de-DE` `voice` identifier selected below.
 */
export function speechTagFor(locale: string, os: string = Platform.OS): string {
  const normalized = locale.replace(/_/g, '-').trim();
  if (os === 'android') return normalized.split('-')[0].toLowerCase();
  return normalized;
}

function getWebSynthesis(): SpeechSynthesis | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !window.speechSynthesis) {
    return null;
  }
  return window.speechSynthesis;
}

let cachedVoices: SpeechVoiceInfo[] | null = null;
let pendingVoicesPromise: Promise<SpeechVoiceInfo[]> | null = null;
let webListenerAttached = false;

function readWebVoicesSync(): SpeechVoiceInfo[] {
  const synth = getWebSynthesis();
  if (!synth || typeof synth.getVoices !== 'function') return [];
  if (!webListenerAttached && typeof synth.addEventListener === 'function') {
    webListenerAttached = true;
    synth.addEventListener('voiceschanged', () => {
      cachedVoices = null;
    });
  }
  const raw = synth.getVoices() || [];
  return raw.map(v => ({
    identifier: v.voiceURI || v.name,
    name: v.name,
    language: v.lang,
    quality: v.localService ? 'Enhanced' : 'Default',
    localService: v.localService,
    isDefault: v.default,
  }));
}

export async function loadAvailableVoices(): Promise<SpeechVoiceInfo[]> {
  if (Platform.OS === 'web') {
    const voices = readWebVoicesSync();
    if (voices.length > 0) cachedVoices = voices;
    return voices;
  }
  if (cachedVoices && cachedVoices.length > 0) {
    return cachedVoices;
  }
  if (!nativeVoiceFetcher) {
    return [];
  }
  if (!pendingVoicesPromise) {
    const fetcher = nativeVoiceFetcher;
    pendingVoicesPromise = Promise.race([
      fetcher().catch(() => [] as SpeechVoiceInfo[]),
      new Promise<SpeechVoiceInfo[]>(resolve => setTimeout(() => resolve([]), 800)),
    ]).then(voices => {
      if (voices.length > 0) cachedVoices = voices;
      pendingVoicesPromise = null;
      return voices;
    });
  }
  return pendingVoicesPromise;
}

/**
 * Ranks available TTS voices for a target BCP-47 locale (e.g., `'de-DE'`, `'ru-RU'`, `'en-US'`),
 * strictly rejecting wrong-language operators and strongly preferring native local voices
 * (high-quality on-device neural voices in Germany German `de-DE`, Russian `ru-RU`, US English `en-US`).
 */
export function scoreVoiceForLocale(voice: SpeechVoiceInfo, targetLocale: string): number {
  const voiceLang = (voice.language || '').replace(/_/g, '-').trim().toLowerCase();
  const target = targetLocale.replace(/_/g, '-').trim().toLowerCase();
  const [targetPrimary, targetRegion] = target.split('-');
  if (!voiceLang || !targetPrimary) return -1;

  const [voicePrimary, voiceRegion] = voiceLang.split('-');
  if (voicePrimary !== targetPrimary) return -1;

  let score = 100;
  if (targetRegion && voiceRegion === targetRegion) {
    score += 50;
  } else if (!voiceRegion) {
    score += 20;
  }

  const hay = `${voice.identifier} ${voice.name}`.toLowerCase();

  // Strongly prefer local / on-device neural voices over remote network voices.
  if (hay.includes('-local') || hay.includes('_local') || hay.includes('local')) score += 30;
  if (hay.includes('-network') || hay.includes('online')) score -= 10;

  if (String(voice.quality || '').toLowerCase() === 'enhanced') score += 25;

  if (
    hay.includes('anna') ||
    hay.includes('petra') ||
    hay.includes('markus') ||
    hay.includes('helena') ||
    hay.includes('martin') ||
    hay.includes('katja') ||
    hay.includes('conrad') ||
    hay.includes('de-de-x-') ||
    hay.includes('german') ||
    hay.includes('deutsch') ||
    hay.includes('milena') ||
    hay.includes('yuri') ||
    hay.includes('irina') ||
    hay.includes('pavel') ||
    hay.includes('russian') ||
    hay.includes('samantha')
  ) {
    score += 18;
  }

  if (hay.includes('compact') || hay.includes('espeak') || hay.includes('novelty')) {
    score -= 25;
  }

  return score;
}

export function selectBestVoiceForLocale(
  voices: readonly SpeechVoiceInfo[],
  targetLocale: string,
): SpeechVoiceInfo | undefined {
  let best: SpeechVoiceInfo | undefined;
  let bestScore = -1;
  for (const voice of voices) {
    const s = scoreVoiceForLocale(voice, targetLocale);
    if (s > bestScore) {
      bestScore = s;
      best = voice;
    }
  }
  return best;
}

export function preloadSpeechVoices(): void {
  void loadAvailableVoices();
}

export function primarySpeechLanguage(locale: string): string {
  return locale.replace(/_/g, '-').trim().toLowerCase().split('-')[0];
}

/** All voices that actually speak the requested language (de-DE and de-AT/de-CH for German). */
export function voicesForLocale(
  voices: readonly SpeechVoiceInfo[],
  targetLocale: string,
): SpeechVoiceInfo[] {
  const primary = primarySpeechLanguage(targetLocale);
  if (!primary) return [];
  return voices.filter(voice => primarySpeechLanguage(voice.language || '') === primary);
}

/**
 * Web browsers fill `speechSynthesis.getVoices()` asynchronously. Waiting a
 * short, bounded moment prevents the first tap from speaking with the wrong
 * (usually English) default voice.
 */
export async function waitForSpeechVoices(
  targetLocale: string,
  timeoutMs = 1400,
): Promise<SpeechVoiceInfo[]> {
  const ready = (list: readonly SpeechVoiceInfo[]) => voicesForLocale(list, targetLocale).length > 0;
  let voices = await loadAvailableVoices();
  if (ready(voices) || Platform.OS !== 'web') return voices;
  const synth = getWebSynthesis();
  if (!synth) return voices;
  if (typeof synth.addEventListener !== 'function') {
    return new Promise(resolve => setTimeout(() => resolve(readWebVoicesSync()), 250));
  }
  return new Promise(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      synth.removeEventListener('voiceschanged', onChange);
      clearTimeout(timer);
      clearTimeout(poll);
      resolve(readWebVoicesSync());
    };
    const onChange = () => {
      const next = readWebVoicesSync();
      if (ready(next)) finish();
    };
    const timer = setTimeout(finish, timeoutMs);
    // Some Chromium builds never fire voiceschanged after the first call.
    const poll = setTimeout(() => {
      if (ready(readWebVoicesSync())) finish();
    }, Math.min(600, timeoutMs));
    synth.addEventListener('voiceschanged', onChange);
    onChange();
  });
}

/**
 * Returns optimal options (`{ language, voice }`) for `Speech.speak(...)`.
 * Never passes an empty or unmatched `voice` string (which on Web causes
 * `expo-speech` to fall back to `voices[0]`, typically English!).
 */
export async function resolveSpeechOptions(
  targetLocale: string,
): Promise<{ language: string; voice?: string }> {
  const language = speechTagFor(targetLocale);
  const voices = await loadAvailableVoices();
  const matching = voicesForLocale(voices, targetLocale);
  const chosen = selectBestVoiceForLocale(matching, targetLocale);
  if (chosen?.identifier) {
    return { language, voice: chosen.identifier };
  }
  // No voice declared for this language: still ask the platform for the right
  // language instead of passing an explicit English voice.
  return { language };
}

/**
 * Resolve a German/Russian/English voice without ever silently falling back to
 * a different language. Network voices are fully eligible: on the web the
 * high-quality Chrome "Google Deutsch" voice is a network voice, and rejecting
 * it left German lessons silent while Russian (which already accepted it) worked.
 */
export async function resolveRequiredSpeechOptions(
  targetLocale: string,
): Promise<{ language: string; voice: string } | null> {
  const voices = await waitForSpeechVoices(targetLocale);
  const matching = voicesForLocale(voices, targetLocale);
  if (!matching.length) return null;

  const localNamed = matching.filter(voice => {
    const hay = `${voice.identifier} ${voice.name}`.toLowerCase();
    return voice.localService === true || /\blocal\b|\benhanced\b/.test(hay);
  });
  // Prefer an installed voice, then any declared voice for the language. Never
  // drop the only usable voice just because the platform labels it as network.
  const pool = localNamed.length ? localNamed : matching;

  // The German course uses a feminine narrator. Prefer an identifiable feminine
  // German voice, but never reject every available voice because of a naming
  // convention the platform does not expose.
  const nameOf = (voice: SpeechVoiceInfo) => `${voice.identifier} ${voice.name}`.toLowerCase();
  const feminineGermanVoice = /anna|petra|katja|helena|marlene|vicki|hedda|claudia|female|de-de-x-deb|google deutsch|google german/;
  const masculineGermanVoice = /markus|martin|conrad|hans|stefan|male|de-de-x-deg/;
  const preferred = targetLocale.toLowerCase().startsWith('de')
    ? (() => {
        const feminine = pool.filter(voice => feminineGermanVoice.test(nameOf(voice)));
        const neutral = pool.filter(voice => !masculineGermanVoice.test(nameOf(voice)));
        return feminine.length ? feminine : neutral.length ? neutral : pool;
      })()
    : pool;

  const chosen = selectBestVoiceForLocale(preferred, targetLocale)
    ?? selectBestVoiceForLocale(pool, targetLocale)
    ?? matching[0];
  if (!chosen?.identifier) return null;
  return { language: speechTagFor(targetLocale), voice: chosen.identifier };
}

/** Best-effort, language-safe voice check used by lesson UI to explain silence. */
export async function detectSpeechSupport(targetLocale: string): Promise<{
  available: boolean;
  voiceName?: string;
  local?: boolean;
}> {
  const voices = await waitForSpeechVoices(targetLocale, 900);
  const matching = voicesForLocale(voices, targetLocale);
  const chosen = selectBestVoiceForLocale(matching, targetLocale);
  return chosen
    ? { available: true, voiceName: chosen.name, local: chosen.localService !== false }
    : { available: false };
}
