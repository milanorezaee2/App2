import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import { getGermanAudioLesson, playGermanClip, stopGermanClip, type GermanClipKind } from './germanAudio';
import {
  loadAvailableVoices,
  preloadSpeechVoices,
  selectBestVoiceForLocale,
  speechTagFor,
  waitForSpeechVoices,
  type SpeechVoiceInfo,
} from './speechLanguage';

/**
 * German narration.
 *
 * This module deliberately uses the **same** pipeline as the Russian and English
 * lessons: `expo-speech` (`Speech.speak`) with the shared `resolveSpeechOptions`
 * helper. The earlier German-only implementation talked to `speechSynthesis`
 * directly and refused to play when the browser did not list an explicit German
 * voice. Russian never does that, which is exactly why Russian kept working on
 * devices where German stayed silent.
 *
 * Rules that now match Russian one-to-one:
 *  - Always ask the platform to speak, with `language: 'de-DE'`.
 *  - Pass a real German voice when one is listed; never pass an English voice.
 *  - When no German voice is listed, still speak with the German language tag
 *    and let the platform choose (identical behaviour to Russian).
 *  - Surface a Persian message only when the engine itself reports an error.
 */

export type GermanSpeechError = 'unsupported' | 'failed';

export type GermanSpeechRequest = {
  text: string;
  /** `word` clips come from the lesson vocabulary pack, `sentence` from the sentence pack. */
  kind?: GermanClipKind;
  /** Defaults to the lesson currently shown on screen. */
  lessonId?: string | null;
  /** 1 = natural speed. The lesson uses 0.9 natural, 0.55 slow, 0.75 shadowing. */
  rate?: number;
  onStart?: () => void;
  onDone?: () => void;
  onBoundary?: (charIndex: number) => void;
  onError?: (reason: GermanSpeechError) => void;
};

export const GERMAN_SPEECH_LOCALE = 'de-DE';
const NORMAL_RATE = 0.9;
const VOICE_PREFERENCE_KEY = 'german_voice_preference_v1';
const VOICE_SOURCE_KEY = 'german_voice_source_v1';

/**
 * Which German voice the lessons use.
 *  - `app`:    the audio that ships with the app (always German, works offline,
 *              no install and no permission needed). Default.
 *  - `device`: the German voice installed on the phone/browser, when there is
 *              one; the bundled audio still covers anything the device refuses.
 */
export type GermanVoiceSource = 'app' | 'device';
let voiceSource: GermanVoiceSource | null = null;

export function getGermanVoiceSource(): GermanVoiceSource {
  if (voiceSource) return voiceSource;
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.localStorage) return 'app';
  voiceSource = window.localStorage.getItem(VOICE_SOURCE_KEY) === 'device' ? 'device' : 'app';
  return voiceSource;
}

export function setGermanVoiceSource(source: GermanVoiceSource): void {
  voiceSource = source;
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.localStorage) return;
  try {
    if (source === 'device') window.localStorage.setItem(VOICE_SOURCE_KEY, 'device');
    else window.localStorage.removeItem(VOICE_SOURCE_KEY);
  } catch {
    /* private browsing: the in-memory choice still applies */
  }
}

/**
 * What the lesson should tell the learner about the sound it is about to make.
 * `german: false` means the device has no German voice at all, so the engine
 * reads German with its default voice. Playback still happens (exactly like the
 * Russian lesson), but the UI explains how to install a real German voice.
 */
export type GermanVoiceStatus = { german: boolean; listed: boolean; checked: boolean; voiceName?: string };
let voiceStatus: GermanVoiceStatus = { german: true, listed: true, checked: false };
const voiceStatusListeners = new Set<(status: GermanVoiceStatus) => void>();

export function getGermanVoiceStatus(): GermanVoiceStatus {
  return voiceStatus;
}

export function subscribeGermanVoiceStatus(listener: (status: GermanVoiceStatus) => void): () => void {
  voiceStatusListeners.add(listener);
  listener(voiceStatus);
  return () => { voiceStatusListeners.delete(listener); };
}

function publishVoiceStatus(next: GermanVoiceStatus): void {
  const changed = next.german !== voiceStatus.german
    || next.listed !== voiceStatus.listed
    || next.checked !== voiceStatus.checked
    || next.voiceName !== voiceStatus.voiceName;
  voiceStatus = next;
  if (!changed) return;
  voiceStatusListeners.forEach(listener => listener(voiceStatus));
}

let sequence = 0;
let webPreference: string | null | undefined;
let nativePreference: string | null = null;
let nativePreferenceLoaded = false;
let nativePreferencePromise: Promise<string | null> | null = null;

function webStorageAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

export function loadGermanVoicePreference(): Promise<string | null> {
  if (Platform.OS === 'web') {
    if (webPreference === undefined) webPreference = webStorageAvailable() ? window.localStorage.getItem(VOICE_PREFERENCE_KEY) : null;
    return Promise.resolve(webPreference);
  }
  if (nativePreferenceLoaded) return Promise.resolve(nativePreference);
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

/** Persist the learner's chosen German voice; `null` restores the automatic choice. */
export function setGermanVoicePreference(identifier: string | null): void {
  if (Platform.OS === 'web') {
    webPreference = identifier;
    if (!webStorageAvailable()) return;
    try {
      if (identifier) window.localStorage.setItem(VOICE_PREFERENCE_KEY, identifier);
      else window.localStorage.removeItem(VOICE_PREFERENCE_KEY);
    } catch {
      /* private browsing: the in-memory choice still applies */
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
  return Platform.OS === 'web' ? (webPreference ?? null) : nativePreference;
}

function isGermanVoice(voice: SpeechVoiceInfo): boolean {
  return (voice.language || '').toLowerCase().startsWith('de');
}

async function germanVoices(allowWait = true): Promise<SpeechVoiceInfo[]> {
  const voices = await loadAvailableVoices();
  if (voices.length > 0) return voices.filter(isGermanVoice);
  if (!allowWait || Platform.OS !== 'web') return [];
  // A completely empty list means the browser is still filling it (Chrome does
  // this on the first call). Wait a bounded moment so the first German sentence
  // is not read by the English default voice. A list that is present but has no
  // German voice is never waited on: that situation is reported, not delayed.
  const waited = await waitForSpeechVoices(GERMAN_SPEECH_LOCALE, 700);
  return waited.filter(isGermanVoice);
}

/**
 * The options handed to `Speech.speak`.
 *
 * This is the exact shape Russian uses: `{ language, voice? }`. A stored
 * preference wins only while it still exists on the device.
 */
async function germanSpeechOptions(): Promise<{ language: string; voice?: string; germanVoice: boolean }> {
  const all = await loadAvailableVoices();
  const voices = await germanVoices(true);
  const preference = await loadGermanVoicePreference();
  const preferred = preference ? voices.find(voice => voice.identifier === preference || voice.name === preference) : undefined;
  const chosen = preferred ?? selectBestVoiceForLocale(voices, GERMAN_SPEECH_LOCALE);
  const language = speechTagFor(GERMAN_SPEECH_LOCALE);
  // Android Chrome and some WebViews always report an empty list, yet they still
  // synthesise German correctly from `lang`. Never call that "missing".
  const listed = voices.length > 0 || all.length > 0;
  if (!chosen?.identifier) {
    publishVoiceStatus({ german: false, listed, checked: true });
    // No German voice on this device. Still ask for German - the platform may
    // know a voice the page cannot list - but never hand it a foreign voice.
    return { language, germanVoice: false };
  }
  // `expo-speech` on web silently falls back to `voices[0]` (usually English)
  // when the identifier is not in the live list, so re-check it right before use.
  const fresh = await loadAvailableVoices();
  const stillThere = fresh.some(voice => voice.identifier === chosen.identifier);
  publishVoiceStatus({ german: true, listed: true, checked: true, voiceName: chosen.name });
  return stillThere ? { language, voice: chosen.identifier, germanVoice: true } : { language, germanVoice: true };
}

/** Speak a German word or sentence with the shared lesson speech pipeline. */
export function speakGerman(options: GermanSpeechRequest): void {
  const text = options.text.trim();
  if (!text) return;
  const request = ++sequence;

  // Default on the web: the German audio that ships with the app. It needs no
  // installed voice, no network and no permission, and it is always German.
  if (Platform.OS === 'web' && getGermanVoiceSource() === 'app') {
    const lessonId = options.lessonId === undefined ? getGermanAudioLesson() : options.lessonId;
    void Speech.stop();
    void playGermanClip({
      text,
      kind: options.kind ?? 'sentence',
      lessonId,
      rate: options.rate,
      onStart: () => {
        if (request === sequence) options.onStart?.();
      },
      onDone: () => {
        if (request === sequence) options.onDone?.();
      },
    }).then(played => {
      if (played || request !== sequence) return undefined;
      return speakWithDevice(text, options, request);
    });
    return;
  }

  void Speech.stop();
  void speakWithDevice(text, options, request);
}

function speakWithDevice(text: string, options: GermanSpeechRequest, request: number): void {
  void germanSpeechOptions()
    .then(({ germanVoice: _germanVoice, ...target }) => {
      if (request !== sequence) return;
      Speech.speak(text, {
        ...target,
        rate: options.rate ?? NORMAL_RATE,
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
        onError: (error: unknown) => {
          // Chrome/Safari report every `speechSynthesis.cancel()` as an error
          // ("canceled" / "interrupted"). Stopping speech is normal in a lesson
          // (new sentence, word tap, stage change), so it must never surface as
          // a red "playback failed" banner.
          const reason = String((error as Error | undefined)?.message ?? error ?? '').toLowerCase();
          if (/cancel|interrupt|stopped|superseded/.test(reason)) {
            if (request === sequence) options.onDone?.();
            return;
          }
          if (request === sequence) options.onError?.('failed');
        },
      });
    })
    .catch(() => {
      if (request === sequence) options.onError?.('failed');
    });
}

export function stopGermanSpeech(): Promise<void> {
  sequence += 1;
  stopGermanClip();
  return Promise.resolve(Speech.stop()).catch(() => undefined);
}

/** Every German voice currently reported by the platform (installed or network). */
export async function listGermanVoices(): Promise<SpeechVoiceInfo[]> {
  return germanVoices();
}

/**
 * Informational only. `speechSynthesis` exists on every modern browser and
 * expo-speech is bundled on device, so this never blocks playback: the lesson
 * speaks first and reports a real error if the engine refuses.
 */
export async function germanSpeechSupport(): Promise<{
  available: boolean;
  voiceName?: string;
  local?: boolean;
  listed?: boolean;
}> {
  if (Platform.OS !== 'web') {
    const voices = await germanVoices(false);
    const best = selectBestVoiceForLocale(voices, GERMAN_SPEECH_LOCALE);
    return { available: true, voiceName: best?.name, local: best ? best.localService !== false : undefined, listed: voices.length > 0 };
  }
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !window.speechSynthesis) {
    return { available: false, listed: false };
  }
  const voices = await germanVoices();
  const best = selectBestVoiceForLocale(voices, GERMAN_SPEECH_LOCALE);
  return { available: true, voiceName: best?.name, local: best ? best.localService !== false : undefined, listed: voices.length > 0 };
}

/**
 * Inspect the device voice list without speaking, so a screen can tell the
 * learner straight away whether a real German voice exists.
 */
export function probeGermanVoice(): void {
  void germanSpeechOptions()
    .then(options => { if (options.voice) primeGermanSpeech(); })
    .catch(() => undefined);
}

/** Warm the voice list while a lesson screen is opening (same as Russian). */
export function primeGermanSpeech(): void {
  preloadSpeechVoices();
  void Speech.getAvailableVoicesAsync().catch(() => undefined);
  void germanVoices(false);
}

/** Late `voiceschanged` events (Chrome/Edge fill the list asynchronously). */
export function subscribeGermanVoices(listener: (voices: SpeechVoiceInfo[]) => void): () => void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return () => undefined;
  const synth = 'speechSynthesis' in window ? window.speechSynthesis : undefined;
  if (!synth || typeof synth.addEventListener !== 'function') return () => undefined;
  const handler = () => {
    const voices = (synth.getVoices() || [])
      .filter(voice => (voice.lang || '').toLowerCase().startsWith('de'))
      .map(voice => ({
        identifier: voice.voiceURI || voice.name,
        name: voice.name,
        language: voice.lang,
        quality: voice.localService ? 'Enhanced' : 'Default',
        localService: voice.localService,
        isDefault: voice.default,
      }));
    if (voices.length) listener(voices);
  };
  synth.addEventListener('voiceschanged', handler);
  return () => {
    try { synth.removeEventListener('voiceschanged', handler); } catch { /* already detached */ }
  };
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
