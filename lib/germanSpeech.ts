import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import {
  detectSpeechSupport,
  loadAvailableVoices,
  preloadSpeechVoices,
  resolveRequiredSpeechOptions,
  selectBestVoiceForLocale,
  speechTagFor,
  waitForSpeechVoices,
  type SpeechVoiceInfo,
} from './speechLanguage';

/**
 * German lesson narration.
 *
 * Why this file exists instead of calling `expo-speech` directly:
 *  - Chrome exposes the natural "Google Deutsch" voice as a *network* voice.
 *    The old German code required an installed/enhanced voice and therefore
 *    rejected it, so German lessons stayed silent while Russian worked.
 *  - Browsers fill `speechSynthesis.getVoices()` asynchronously; the first
 *    auto-play could pick the English system default.
 *  - Chrome stops long utterances when the queue is cancelled; we cancel the
 *    previous sentence and resume the queue before every new utterance.
 *  - The lesson UI wants word-boundary events to highlight the word being read.
 *    `expo-speech` does not forward those events on the web, so the web path
 *    uses the native Web Speech API directly.
 *  - A learner can now choose which installed German voice to use (for example
 *    Google Deutsch instead of a robotic eSpeak voice). The choice is stored
 *    locally and reused by the lesson, the library and the review screen.
 */

export type GermanSpeechError =
  | 'no-german-voice'
  | 'unsupported'
  | 'blocked'
  | 'failed';

export type GermanSpeechRequest = {
  text: string;
  /** 1 = natural speed. The lesson uses 0.9 natural, 0.55 slow, 0.75 shadowing. */
  rate?: number;
  onStart?: () => void;
  onDone?: () => void;
  onBoundary?: (charIndex: number) => void;
  onError?: (reason: GermanSpeechError) => void;
};

const NORMAL_RATE = 0.9;
const VOICE_PREFERENCE_KEY = 'german_voice_preference_v1';

const FEMININE_GERMAN = /anna|petra|katja|helena|marlene|vicki|hedda|claudia|amala|elke|female|google deutsch|google german/;
const MASCULINE_GERMAN = /markus|martin|conrad|hans|stefan|male|google deutsch male/;

let sequence = 0;
let webUtterance: SpeechSynthesisUtterance | null = null;

let webPreference: string | null | undefined;
let nativePreference: string | null = null;
let nativePreferenceLoaded = false;
let nativePreferencePromise: Promise<string | null> | null = null;

function webSynth(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null;
  if (!('speechSynthesis' in window) || !window.speechSynthesis) return null;
  if (typeof window.SpeechSynthesisUtterance === 'undefined') return null;
  return window.speechSynthesis;
}

function delay(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

function readWebPreference(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage?.getItem(VOICE_PREFERENCE_KEY) ?? null;
  } catch {
    return null;
  }
}

function getWebPreference(): string | null {
  if (webPreference === undefined) webPreference = readWebPreference();
  return webPreference;
}

async function getNativePreference(): Promise<string | null> {
  if (nativePreferenceLoaded) return nativePreference;
  if (!nativePreferencePromise) {
    nativePreferencePromise = AsyncStorage.getItem(VOICE_PREFERENCE_KEY)
      .then(value => {
        nativePreference = value;
        nativePreferenceLoaded = true;
        return value;
      })
      .catch(() => {
        nativePreference = null;
        nativePreferenceLoaded = true;
        return null;
      })
      .finally(() => { nativePreferencePromise = null; });
  }
  return nativePreferencePromise;
}

/** Await the stored native choice before rendering a voice picker. */
export function loadGermanVoicePreference(): Promise<string | null> {
  return Platform.OS === 'web' ? Promise.resolve(getWebPreference()) : getNativePreference();
}

/** Persist the learner's chosen German voice; pass `null` to use the automatic choice. */
export function setGermanVoicePreference(identifier: string | null): void {
  if (Platform.OS === 'web') {
    webPreference = identifier;
    try {
      if (identifier) window.localStorage?.setItem(VOICE_PREFERENCE_KEY, identifier);
      else window.localStorage?.removeItem(VOICE_PREFERENCE_KEY);
    } catch {
      /* private mode or storage disabled: the in-memory choice still applies */
    }
    return;
  }
  nativePreference = identifier;
  nativePreferenceLoaded = true;
  nativePreferencePromise = null;
  void (identifier
    ? AsyncStorage.setItem(VOICE_PREFERENCE_KEY, identifier)
    : AsyncStorage.removeItem(VOICE_PREFERENCE_KEY)
  ).catch(() => undefined);
}

export function getGermanVoicePreference(): string | null {
  if (Platform.OS === 'web') return getWebPreference();
  return nativePreference;
}

function toVoiceInfo(voice: SpeechSynthesisVoice): SpeechVoiceInfo {
  return {
    identifier: voice.voiceURI || voice.name,
    name: voice.name,
    language: voice.lang,
    quality: voice.localService ? 'Enhanced' : 'Default',
    localService: voice.localService,
    isDefault: voice.default,
  };
}

function germanWebVoices(synth: SpeechSynthesis): SpeechSynthesisVoice[] {
  return (synth.getVoices() || []).filter(voice => (voice.lang || '').toLowerCase().startsWith('de'));
}

function pickGermanWebVoice(
  voices: readonly SpeechSynthesisVoice[],
  preferredIdentifier?: string | null,
): SpeechSynthesisVoice | undefined {
  const usable = voices.filter(voice => (voice.lang || '').toLowerCase().startsWith('de'));
  if (!usable.length) return undefined;

  if (preferredIdentifier) {
    const preferred = usable.find(voice => (voice.voiceURI || voice.name) === preferredIdentifier);
    if (preferred) return preferred;
  }

  const ranked = selectBestVoiceForLocale(usable.map(toVoiceInfo), 'de-DE');
  if (!ranked) return usable[0];
  const baseScore = (voice: SpeechSynthesisVoice) => {
    const hay = `${voice.voiceURI} ${voice.name}`.toLowerCase();
    let score = voice === usable.find(item => (item.voiceURI || item.name) === ranked.identifier) ? 1000 : 0;
    score += voice.lang.toLowerCase() === 'de-de' ? 40 : 0;
    if (voice.localService) score += 20;
    if (FEMININE_GERMAN.test(hay)) score += 16;
    if (MASCULINE_GERMAN.test(hay)) score -= 18;
    if (/compact|espeak|novelty/.test(hay)) score -= 30;
    return score;
  };
  return [...usable].sort((a, b) => baseScore(b) - baseScore(a))[0];
}

function finishCurrentWebUtterance(utterance: SpeechSynthesisUtterance | null) {
  if (webUtterance === utterance) webUtterance = null;
}

async function speakOnWeb(
  request: number,
  text: string,
  options: GermanSpeechRequest,
) {
  const synth = webSynth();
  if (!synth || typeof synth.speak !== 'function') {
    options.onError?.('unsupported');
    return;
  }

  try { if (typeof synth.cancel === 'function') synth.cancel(); } catch { /* browser already idle */ }
  webUtterance = null;
  await delay(45);
  if (request !== sequence) return;

  // Wait for the browser to expose its German voices. Without this step the
  // very first sentence of a freshly opened lesson can use the English default.
  await waitForSpeechVoices('de-DE');
  if (request !== sequence) return;

  const germanVoices = germanWebVoices(synth);
  if (!germanVoices.length) {
    // Never let the browser read German with its default English voice.
    options.onError?.('no-german-voice');
    return;
  }

  const chosen = pickGermanWebVoice(germanVoices, getWebPreference());
  const utterance = new window.SpeechSynthesisUtterance(text);
  if (chosen) {
    try {
      utterance.voice = chosen;
    } catch {
      // A browser can expose a voice object that it refuses to assign
      // (rare Safari/Firefox builds). The German language tag below still
      // keeps the utterance away from the English default.
    }
  }
  utterance.lang = chosen?.lang || 'de-DE';
  utterance.rate = options.rate ?? NORMAL_RATE;
  utterance.pitch = 1;
  utterance.volume = 1;

  let started = false;
  utterance.onstart = () => {
    started = true;
    if (request === sequence) options.onStart?.();
  };
  utterance.onboundary = event => {
    if (request !== sequence) return;
    if (typeof event.charIndex === 'number') options.onBoundary?.(event.charIndex);
  };
  utterance.onend = () => {
    finishCurrentWebUtterance(utterance);
    if (request === sequence) options.onDone?.();
  };
  utterance.onerror = event => {
    finishCurrentWebUtterance(utterance);
    if (request !== sequence) return;
    const reason = String((event as SpeechSynthesisErrorEvent).error || '');
    if (/cancel|interrupt/i.test(reason)) return;
    if (/not-allowed/i.test(reason)) {
      options.onError?.('blocked');
      return;
    }
    if (!started && !chosen) options.onError?.('no-german-voice');
    else options.onError?.('failed');
  };

  webUtterance = utterance;
  try {
    // Chrome sometimes leaves the synthesis queue paused after cancel().
    if (typeof synth.resume === 'function') synth.resume();
    synth.speak(utterance);
  } catch {
    finishCurrentWebUtterance(utterance);
    if (request === sequence) options.onError?.('failed');
  }
}

async function speakOnDevice(
  request: number,
  text: string,
  options: GermanSpeechRequest,
) {
  try { await Speech.stop(); } catch { /* no active utterance */ }
  if (request !== sequence) return;

  const resolved = await resolveRequiredSpeechOptions('de-DE');
  if (request !== sequence) return;

  // No German voice means the platform would fall back to its default
  // (usually English). Fail loudly instead of reading German with English.
  if (!resolved) {
    options.onError?.('no-german-voice');
    return;
  }

  const preferred = await getNativePreference();
  let voice = resolved.voice;
  if (preferred) {
    try {
      const voices = await loadAvailableVoices();
      const match = voices.find(item =>
        item.identifier === preferred && (item.language || '').toLowerCase().startsWith('de'));
      if (match) voice = match.identifier;
    } catch {
      /* keep the automatic choice */
    }
  }

  try {
    Speech.speak(text, {
      // Android needs the primary tag ("de"); iOS accepts the full tag.
      language: resolved.language || speechTagFor('de-DE'),
      voice,
      rate: options.rate ?? NORMAL_RATE,
      pitch: 1,
      onStart: () => {
        if (request === sequence) options.onStart?.();
      },
      onBoundary: (event: unknown) => {
        if (request !== sequence) return;
        const charIndex = (event as { charIndex?: number } | undefined)?.charIndex;
        if (typeof charIndex === 'number') options.onBoundary?.(charIndex);
      },
      onDone: () => {
        if (request === sequence) options.onDone?.();
      },
      onStopped: () => {
        if (request === sequence) options.onDone?.();
      },
      onError: () => {
        if (request === sequence) options.onError?.('failed');
      },
    });
  } catch {
    if (request === sequence) options.onError?.('failed');
  }
}

/** Speak a German word or sentence with the best available German voice. */
export function speakGerman(options: GermanSpeechRequest): void {
  const text = options.text.trim();
  if (!text) return;
  const request = ++sequence;
  if (Platform.OS === 'web') {
    void speakOnWeb(request, text, options);
  } else {
    void speakOnDevice(request, text, options);
  }
}

export function stopGermanSpeech(): Promise<void> {
  sequence += 1;
  if (Platform.OS === 'web') {
    const synth = webSynth();
    try { if (synth && typeof synth.cancel === 'function') synth.cancel(); } catch { /* idle */ }
    webUtterance = null;
    return Promise.resolve();
  }
  return Speech.stop().catch(() => undefined);
}

/** All German voices the platform currently reports (installed, network, de-AT, de-CH). */
export async function listGermanVoices(): Promise<SpeechVoiceInfo[]> {
  if (Platform.OS === 'web') {
    const synth = webSynth();
    if (!synth) return [];
    const infos = germanWebVoices(synth).map(toVoiceInfo);
    if (infos.length) return infos;
    const waited = await waitForSpeechVoices('de-DE');
    return waited.filter(voice => (voice.language || '').toLowerCase().startsWith('de'));
  }
  await waitForSpeechVoices('de-DE');
  const voices = await loadAvailableVoices();
  return voices.filter(voice => (voice.language || '').toLowerCase().startsWith('de'));
}

/**
 * Listen for late-arriving browser voices. Chrome and Edge often report an
 * empty `getVoices()` list for the first second; without this, a lesson opened
 * immediately after page load can wrongly claim that no German voice exists.
 */
export function subscribeGermanVoices(listener: (voices: SpeechVoiceInfo[]) => void): () => void {
  if (Platform.OS !== 'web') return () => undefined;
  const synth = webSynth();
  if (!synth || typeof synth.addEventListener !== 'function') return () => undefined;
  const handler = () => {
    const voices = germanWebVoices(synth).map(toVoiceInfo);
    if (voices.length) listener(voices);
  };
  synth.addEventListener('voiceschanged', handler);
  return () => {
    try { synth.removeEventListener('voiceschanged', handler); } catch { /* already detached */ }
  };
}

/** Warm the voice list while the lesson screen is opening. */
export function primeGermanSpeech(): void {
  if (Platform.OS === 'web') {
    void waitForSpeechVoices('de-DE');
    return;
  }
  if (!nativePreferenceLoaded) void getNativePreference();
  preloadSpeechVoices();
  void Speech.getAvailableVoicesAsync().catch(() => undefined);
}

/** Used by the lesson header to tell the learner whether German audio is ready. */
export function germanSpeechSupport(): Promise<{ available: boolean; voiceName?: string; local?: boolean }> {
  return detectSpeechSupport('de-DE');
}

/** Convert a character index from a speech boundary event to a word index. */
export function wordIndexAt(text: string, charIndex: number): number {
  const matches = [...text.matchAll(/\S+/g)];
  if (!matches.length) return 0;
  if (charIndex <= 0) return 0;
  for (let index = 0; index < matches.length; index += 1) {
    const start = matches[index].index ?? 0;
    if (charIndex < start + matches[index][0].length) return index;
  }
  return matches.length - 1;
}
