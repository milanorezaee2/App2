import { Platform } from 'react-native';
import {
  GERMAN_DEFAULT_NARRATOR_ID,
  findGermanNarrator,
  germanDeviceRate,
  isGermanNarratorId,
} from './languages/germanNarrator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import {
  getGermanAudioLesson,
  playGermanClip,
  setGermanAudioVoice,
  stopGermanClip,
  type GermanClipKind,
} from './germanAudio';
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
  /**
   * Lesson intent, not a literal engine rate: 0.9 normal, 0.75 shadowing,
   * 0.55 slow. The chosen narrator's real device rates live in
   * `config/german-narrator.json`, so the same intent sounds equally fast in
   * the bundled pack and on the phone.
   */
  rate?: number;
  onStart?: () => void;
  onDone?: () => void;
  onBoundary?: (charIndex: number) => void;
  onError?: (reason: GermanSpeechError) => void;
};

export const GERMAN_SPEECH_LOCALE = 'de-DE';
const NORMAL_RATE = 0.9;
const VOICE_PREFERENCE_KEY = 'german_voice_preference_v1';
/** Which of the three bundled narrators the learner chose. */
const NARRATOR_KEY = 'german_narrator_v1';
/** Keys written by older builds that let the learner pick another voice. */
const LEGACY_VOICE_KEYS = ['german_voice_source_v1', 'german_voice_source_migrated_v2'];

/**
 * The German course ships three neural narrators
 * (`config/german-narrator.json`) and the learner picks one on the
 * `صدای آلمانی` page. Every German screen then plays that narrator's pack, and
 * the choice is remembered across launches.
 *
 * There is still no "use the phone's voice" option: a preference written by an
 * older build is deleted on first launch, so the old, worse voice cannot come
 * back. The phone's German voice survives only as a *failure cover*: when a clip
 * cannot be played at all, the sentence is read instead of leaving the lesson
 * silent.
 */
export type GermanVoiceSource = 'app';

let activeNarratorId: string = GERMAN_DEFAULT_NARRATOR_ID;
/**
 * Reading the saved narrator is asynchronous on a phone (AsyncStorage), so the
 * first sentence of a cold start could otherwise be spoken by the default voice
 * and only the second one by the voice the learner chose. German speech waits
 * for this promise, which makes the very first clip come from the right pack.
 */
let narratorLoaded = false;
let narratorReady: Promise<string> | null = null;
/** Bumped on every manual choice, so a slow storage read cannot undo it. */
let narratorChoiceVersion = 0;

/** The narrator currently in use (the default until the saved choice loads). */
export function getGermanNarratorId(): string {
  return activeNarratorId;
}

/** Switch narrator everywhere: bundled packs, device fallback and the UI. */
export function setGermanNarratorId(narratorId: string): void {
  activeNarratorId = findGermanNarrator(narratorId).id;
  narratorLoaded = true;
  narratorChoiceVersion += 1;
  setGermanAudioVoice(activeNarratorId);
  if (Platform.OS === 'web') {
    if (!webStorageAvailable()) return;
    try {
      window.localStorage.setItem(NARRATOR_KEY, activeNarratorId);
    } catch {
      /* private browsing: the in-memory choice still applies */
    }
    return;
  }
  void AsyncStorage.setItem(NARRATOR_KEY, activeNarratorId).catch(() => undefined);
}

/**
 * Read the saved narrator and apply it. Called once on the German screens; the
 * default narrator stays active when nothing (or something unknown) is stored.
 */
export async function loadGermanNarratorPreference(): Promise<string> {
  const version = narratorChoiceVersion;
  let saved: string | null = null;
  try {
    saved = Platform.OS === 'web'
      ? (webStorageAvailable() ? window.localStorage.getItem(NARRATOR_KEY) : null)
      : await AsyncStorage.getItem(NARRATOR_KEY);
  } catch {
    saved = null;
  }
  // The learner tapped another voice while the storage read was in flight: the
  // tap wins, never the older saved value.
  if (version === narratorChoiceVersion && isGermanNarratorId(saved)) {
    activeNarratorId = saved;
    setGermanAudioVoice(saved);
  }
  return activeNarratorId;
}

/**
 * The saved narrator, read at most once per launch. Every German screen calls
 * this before its first clip, so a lesson opened straight from a link already
 * speaks the chosen voice.
 */
export function ensureGermanNarratorLoaded(): Promise<string> {
  if (narratorLoaded) return Promise.resolve(activeNarratorId);
  if (!narratorReady) {
    narratorReady = loadGermanNarratorPreference()
      .then(id => { narratorLoaded = true; return id; })
      .catch(() => { narratorLoaded = true; return activeNarratorId; });
  }
  return narratorReady;
}

/**
 * Deletes every voice preference that older builds could have stored.
 *
 * Web builds kept them in `localStorage`, Android/iOS in AsyncStorage. Both are
 * cleared so the old, worse voice cannot return after an update.
 */
export function clearLegacyGermanVoiceChoices(): void {
  webPreference = undefined;
  nativePreference = null;
  nativePreferenceLoaded = true;
  nativePreferencePromise = null;
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      for (const key of [VOICE_PREFERENCE_KEY, ...LEGACY_VOICE_KEYS]) {
        window.localStorage.removeItem(key);
      }
    } catch {
      /* private browsing: nothing was persisted anyway */
    }
    return;
  }
  for (const key of [VOICE_PREFERENCE_KEY, ...LEGACY_VOICE_KEYS]) {
    void AsyncStorage.removeItem(key).catch(() => undefined);
  }
}

export function getGermanVoiceSource(): GermanVoiceSource {
  // Always the packaged narrator; nothing else can be selected.
  return 'app';
}

/** Kept for older imports; there is nothing left to switch to. */
export function setGermanVoiceSource(_source: GermanVoiceSource): void {
  clearLegacyGermanVoiceChoices();
}

/**
 * What the lesson should tell the learner about the sound it is about to make.
 * `german: false` means the device has no German voice at all, so the engine
 * reads German with its default voice. Playback still happens (exactly like the
 * Russian lesson), but the UI explains how to install a real German voice.
 */
export type GermanVoiceStatus = {
  german: boolean;
  listed: boolean;
  checked: boolean;
  voiceName?: string;
  /** Which engine produced the last sound: the app's own audio or the device voice. */
  engine?: 'app' | 'device';
  /** True on browsers without any Web Speech API (Firefox for Android). */
  deviceSpeech?: boolean;
};
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
    || next.voiceName !== voiceStatus.voiceName
    || next.engine !== voiceStatus.engine
    || next.deviceSpeech !== voiceStatus.deviceSpeech;
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

/**
 * Firefox for Android has no Web Speech API at all: `window.speechSynthesis` is
 * `undefined`, and `expo-speech` would throw inside `Speech.stop()` / `speak()`.
 * Every call therefore goes through these guards; the bundled German audio does
 * not need the API and keeps working there.
 */
export function webSpeechAvailable(): boolean {
  return Platform.OS !== 'web'
    || (typeof window !== 'undefined' && !!(window as { speechSynthesis?: unknown }).speechSynthesis);
}

/**
 * True while the platform speech engine is actually speaking or has something
 * queued. Calling `cancel()` immediately before `speak()` makes Chrome drop the
 * new utterance (and Android TTS clip the first word), so the lesson only stops
 * the engine when there really is something to stop.
 */
function speechEngineBusy(): boolean {
  if (Platform.OS === 'web') {
    if (!webSpeechAvailable()) return false;
    try {
      const engine = (window as unknown as { speechSynthesis?: { speaking?: boolean; pending?: boolean } }).speechSynthesis;
      return !!engine && !!(engine.speaking || engine.pending);
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * A listed voice that never starts (locked audio channel, broken TTS package)
 * must not swallow the sentence, but a voice that *is* speaking must never be
 * cut off by the fallback. The watchdog therefore only gives up while the engine
 * has reported idle for two consecutive checks, with an absolute cap.
 */
function watchDeviceStart(isSettled: () => boolean, onGiveUp: () => void): void {
  const startedAt = Date.now();
  let idleChecks = 0;
  const tick = () => {
    if (isSettled()) return;
    if (speechEngineBusy()) idleChecks = 0;
    else idleChecks += 1;
    if (idleChecks >= 2 || Date.now() - startedAt > 3500) {
      if (!isSettled()) onGiveUp();
      return;
    }
    setTimeout(tick, 240);
  };
  setTimeout(tick, 900);
}

function safeSpeechStop(): void {
  if (Platform.OS === 'web' && !webSpeechAvailable()) return;
  try {
    void Promise.resolve(Speech.stop()).catch(() => undefined);
  } catch {
    /* no engine: the bundled audio is the only path */
  }
}

function safeSpeechSpeak(text: string, options: Parameters<typeof Speech.speak>[1]): void {
  if (Platform.OS === 'web' && !webSpeechAvailable()) return;
  try {
    Speech.speak(text, options);
  } catch {
    /* no engine */
  }
}

function publishEngine(engine: 'app' | 'device'): void {
  publishVoiceStatus({ ...voiceStatus, engine, checked: true, deviceSpeech: webSpeechAvailable() });
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

/**
 * Speak one German phrase.
 *
 * The bundled audio and the device voice both speak German; this picks the best
 * available one for the chosen source and guarantees that a failure in one is
 * covered by the other instead of leaving the lesson silent.
 */
export function speakGerman(options: GermanSpeechRequest): void {
  const text = options.text.trim();
  if (!text) return;
  const request = ++sequence;

  const lessonId = options.lessonId === undefined ? getGermanAudioLesson() : options.lessonId;

  // The learner may have just switched narrator; the pack must follow before the
  // clip is looked up, otherwise the first sentence after the switch would still
  // come from the previous voice.
  setGermanAudioVoice(activeNarratorId);

  const playBundled = (): Promise<boolean> => playGermanClip({
    text,
    kind: options.kind ?? 'sentence',
    lessonId,
    rate: options.rate,
    onStart: () => {
      if (request !== sequence) return;
      publishEngine('app');
      options.onStart?.();
    },
    onDone: () => {
      if (request === sequence) options.onDone?.();
    },
  }).then(played => played).catch(() => false);

  const bundledFirst = () => {
    safeSpeechStop();
    void playBundled().then(played => {
      if (played || request !== sequence) return;
      if (!webSpeechAvailable()) {
        options.onError?.('unsupported');
        return;
      }
      speakWithDevice(text, options, request, null);
    });
  };

  // One narrator only: always the pack that ships with the app. If a clip
  // cannot start, `bundledFirst` lets the phone's German voice read that one
  // sentence instead of staying silent; that cover is not a voice choice.
  // The saved choice is read first so even the very first sentence of a cold
  // start uses the narrator the learner picked.
  void ensureGermanNarratorLoaded().then(() => {
    if (request !== sequence) return;
    setGermanAudioVoice(activeNarratorId);
    bundledFirst();
  });
}

/**
 * Does this phone have its own German voice?
 *
 * On the web that means a `de*` entry in `speechSynthesis.getVoices()`; on
 * Android/iOS it means a German voice installed for the system TTS engine
 * (`Speech.getAvailableVoicesAsync`). The APK used to skip this check entirely,
 * so it always fell back to the bundled clips even when the phone could speak
 * German far more naturally.
 */
async function hasGermanDeviceVoice(): Promise<boolean> {
  if (!webSpeechAvailable()) return false;
  const voices = await loadAvailableVoices();
  const german = voices.some(isGermanVoice);
  publishVoiceStatus({
    german,
    listed: voices.length > 0,
    checked: true,
    deviceSpeech: true,
    voiceName: voiceStatus.voiceName,
    engine: voiceStatus.engine,
  });
  return german;
}

function speakWithDevice(
  text: string,
  options: GermanSpeechRequest,
  request: number,
  onFailed?: (() => void) | null,
  onStarted?: (() => void) | null,
): () => void {
  let done = false;
  const fail = () => {
    if (done) return;
    done = true;
    if (onFailed) onFailed();
    else if (request === sequence) options.onError?.('failed');
  };
  if (Platform.OS === 'web' && !webSpeechAvailable()) {
    fail();
    return () => undefined;
  }
  void germanSpeechOptions()
    .then(({ germanVoice: _germanVoice, ...target }) => {
      if (request !== sequence) return;
      // The course narrator has one tempo. `germanDeviceRate` turns the lesson
      // intent into the device rate that matches the bundled packs.
      safeSpeechSpeak(text, {
        ...target,
        rate: germanDeviceRate(options.rate, activeNarratorId),
        onStart: () => {
          if (request !== sequence) return;
          if (onStarted) onStarted();
          else publishEngine('device');
          options.onStart?.();
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
          fail();
        },
      });
    })
    .catch(() => fail());
  return () => {
    done = true;
    safeSpeechStop();
  };
}

export function stopGermanSpeech(): Promise<void> {
  sequence += 1;
  stopGermanClip();
  if (Platform.OS === 'web' && !webSpeechAvailable()) return Promise.resolve();
  try {
    return Promise.resolve(Speech.stop()).catch(() => undefined);
  } catch {
    return Promise.resolve();
  }
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
  // Start reading the saved narrator in parallel with the voice preload.
  void ensureGermanNarratorLoaded();
  preloadSpeechVoices();
  if (Platform.OS === 'web' && !webSpeechAvailable()) {
    publishVoiceStatus({ ...voiceStatus, german: false, listed: false, checked: true, deviceSpeech: false });
    return;
  }
  try {
    void Speech.getAvailableVoicesAsync().catch(() => undefined);
  } catch {
    /* no engine */
  }
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
