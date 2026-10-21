import { Platform } from 'react-native';
import { playNativeRussianClip, setNativeRussianVoice, stopNativeRussianClip } from './russianAudioNative';
import { RUSSIAN_DEFAULT_NARRATOR_ID, findRussianNarrator } from './languages/russianNarrator';

/**
 * In-app Russian voice.
 *
 * The Russian course ships its own audio (`public/audio/ru`): every sentence and
 * every vocabulary word was rendered once with the neural narrator, so the
 * lessons sound Russian on any device — including phones whose system voices are
 * English-only or missing `ru-RU` entirely, and Firefox for Android, which has no
 * speech synthesis at all.
 *
 * Nothing here touches the network beyond the app's own static files, and the
 * device voice is only used as a fallback when a clip is missing.
 */

export type RussianClipKind = 'sentence' | 'word';

type ClipRange = [number, number];

type PackEntry = { file: string; clips: Record<string, ClipRange> };

type LessonAudio = { sentences: PackEntry; words: PackEntry };

/** An `Audio`-compatible constructor; replaced in tests to record playback. */
type AudioFactory = (src: string) => HTMLAudioElement;
let audioFactory: AudioFactory | null = null;

export function setRussianAudioFactory(factory: AudioFactory | null): void {
  audioFactory = factory;
  audioCache = new Map();
}

type RussianAudioManifest = {
  version: number;
  narrator?: string;
  engine?: string;
  generatedAt?: string;
  lessons: Record<string, LessonAudio>;
};

/**
 * Every narrator has its own folder and its own manifest:
 * `/audio/ru/<narrator>/manifest.json`. A lesson always plays from one folder, so
 * the speaker can never change in the middle of a sentence.
 */
const manifestPath = (voiceId: string) => `/audio/ru/${voiceId}/manifest.json`;

/**
 * Playback window around every clip.
 *
 * The pack puts 0.30 s of digital silence before each sentence and 0.55 s after
 * it (0.45 s for the word pack). Starting 0.25 s early and stopping 0.15 s late
 * means the player only ever crosses silence between two clips: a slow seek, an
 * encoder delay, or a browser that lands a frame off can add silence, never a
 * fragment of the sentence before or after.
 */
const PREROLL_SECONDS = 0.25;
const TAIL_SECONDS = 0.15;

const manifests = new Map<string, Promise<RussianAudioManifest | null>>();
let activeLessonId: string | null = null;
let activeVoiceId = RUSSIAN_DEFAULT_NARRATOR_ID;
let audioCache = new Map<string, HTMLAudioElement>();
let currentStop: (() => void) | null = null;

function basePrefix(): string {
  const envBase = typeof process !== 'undefined' ? (process.env as Record<string, string | undefined>)?.EXPO_BASE_URL : undefined;
  if (envBase) return envBase.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location?.pathname?.startsWith('/App1')) return '/App1';
  return '';
}

export function russianAudioAssetUrl(path: string): string {
  return `${basePrefix()}${path.startsWith('/') ? path : `/${path}`}`;
}

/** The lesson whose clips should be used for the current screen. */
export function setRussianAudioLesson(lessonId: string | null): void {
  if (activeLessonId === lessonId) return;
  activeLessonId = lessonId;
  stopRussianClip();
}

export function getRussianAudioLesson(): string | null {
  return activeLessonId;
}

/**
 * The key a clip is stored under: no stress marks, lower case, one spacing.
 * Must stay identical to `normalize_key()` in `scripts/russian_voice.py`, which
 * wrote the manifest.
 */
export function normalizeRussianClipText(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[\u0301\u00b4\u02b9\u2032]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** The narrator whose audio is played. `setRussianAudioVoice` switches packs. */
export function setRussianAudioVoice(voiceId: string): void {
  const next = findRussianNarrator(voiceId).id;
  if (next === activeVoiceId) return;
  stopRussianClip();
  activeVoiceId = next;
  setNativeRussianVoice(next);
}

export function getRussianAudioVoice(): string {
  return activeVoiceId;
}

export async function loadRussianAudioManifest(voiceId = activeVoiceId): Promise<RussianAudioManifest | null> {
  if (Platform.OS !== 'web') return null;
  if (typeof window === 'undefined' || typeof fetch !== 'function') return null;
  if (!manifests.has(voiceId)) {
    try {
      manifests.set(voiceId, fetch(russianAudioAssetUrl(manifestPath(voiceId)))
        .then(response => (response.ok ? response.json() as Promise<RussianAudioManifest> : null))
        .catch(() => null));
    } catch {
      // A relative URL is invalid outside a browser document (tests, SSR).
      manifests.set(voiceId, Promise.resolve(null));
    }
  }
  return manifests.get(voiceId) as Promise<RussianAudioManifest | null>;
}

export function russianClipFor(
  manifest: RussianAudioManifest | null,
  lessonId: string | null,
  kind: RussianClipKind,
  text: string,
): { file: string; start: number; end: number } | null {
  if (!manifest || !lessonId) return null;
  const lesson = manifest.lessons[lessonId];
  if (!lesson) return null;
  const pack = kind === 'word' ? lesson.words : lesson.sentences;
  const range = pack?.clips?.[normalizeRussianClipText(text)];
  if (!pack?.file || !range) return null;
  return { file: pack.file, start: range[0], end: range[1] };
}

/** Playback speed for a requested rate; the pack itself was rendered once. */
export function russianPlaybackRate(rate?: number): number {
  const requested = rate ?? 0.85;
  if (requested >= 0.82) return 1;
  if (requested >= 0.62) return 0.85;
  return 0.75;
}

function audioFor(file: string): HTMLAudioElement {
  const key = `${activeVoiceId}/${file}`;
  const cached = audioCache.get(key);
  if (cached) return cached;
  const create = audioFactory ?? (src => new Audio(src));
  const audio = create(russianAudioAssetUrl(`/audio/ru/${key}`));
  audio.preload = 'auto';
  audioCache.set(key, audio);
  return audio;
}

export function stopRussianClip(): void {
  stopNativeRussianClip();
  if (currentStop) {
    const stop = currentStop;
    currentStop = null;
    stop();
  }
}

/**
 * Play one bundled Russian clip. Resolves `true` when the audio really started,
 * `false` when the caller should fall back to the device voice.
 */
export async function playRussianClip(options: {
  text: string;
  kind?: RussianClipKind;
  lessonId?: string | null;
  rate?: number;
  onStart?: () => void;
  onDone?: () => void;
  onError?: () => void;
}): Promise<boolean> {
  // Android/iOS play the same MP3s from the app bundle with expo-audio.
  if (Platform.OS !== 'web') {
    return playNativeRussianClip({
      text: options.text,
      kind: options.kind,
      lessonId: options.lessonId === undefined ? activeLessonId : options.lessonId,
      rate: options.rate,
      onStart: options.onStart,
      onDone: options.onDone,
    });
  }
  if (typeof window === 'undefined') return false;
  const voiceId = activeVoiceId;
  const clip = russianClipFor(
    await loadRussianAudioManifest(voiceId),
    options.lessonId ?? activeLessonId,
    options.kind ?? 'sentence',
    options.text,
  );
  if (!clip) return false;

  stopRussianClip();
  const audio = audioFor(clip.file);
  const playbackRate = russianPlaybackRate(options.rate);
  audio.playbackRate = playbackRate;

  let done = false;
  let stopTimer: ReturnType<typeof setTimeout> | null = null;
  const finish = (completed: boolean) => {
    if (done) return;
    done = true;
    cleanup();
    try { audio.pause(); } catch { /* element already detached */ }
    if (completed) options.onDone?.();
  };
  const stopAt = clip.end + TAIL_SECONDS;
  const onTime = () => {
    // Fallback in case `ended` never fires because we stop before the file ends.
    if (audio.currentTime >= stopAt) finish(true);
  };
  const onEnded = () => finish(true);
  const onError = () => {
    done = true;
    cleanup();
    options.onError?.();
  };
  const cleanup = () => {
    audio.removeEventListener('timeupdate', onTime);
    audio.removeEventListener('error', onError);
    audio.removeEventListener('ended', onEnded);
    if (stopTimer) clearTimeout(stopTimer);
    stopTimer = null;
    currentStop = null;
  };

  audio.addEventListener('timeupdate', onTime);
  audio.addEventListener('error', onError);
  audio.addEventListener('ended', onEnded);
  currentStop = () => finish(false);

  try {
    // Seeking before the metadata is available is ignored by some browsers.
    if (audio.readyState < 1) {
      await new Promise<void>(resolve => {
        const ready = () => { audio.removeEventListener('loadedmetadata', ready); resolve(); };
        audio.addEventListener('loadedmetadata', ready);
        setTimeout(ready, 1200);
      });
    }
    audio.currentTime = Math.max(0, clip.start - PREROLL_SECONDS);
    if (audio.readyState < 2) {
      await new Promise<void>(resolve => {
        const ready = () => { audio.removeEventListener('canplay', ready); resolve(); };
        audio.addEventListener('canplay', ready);
        setTimeout(ready, 1200);
      });
      audio.currentTime = Math.max(0, clip.start - PREROLL_SECONDS);
    }
    await audio.play();
  } catch {
    // Autoplay blocked or codec missing: let the caller use the device voice.
    done = true;
    cleanup();
    return false;
  }
  // The tail past the recorded end is silence in the pack, so cutting there
  // cannot clip the final consonant and cannot reach the next clip either.
  // Safety net only — the `timeupdate` handler above stops on the real position.
  stopTimer = setTimeout(
    () => finish(true),
    Math.max(120, ((stopAt - Math.max(0, clip.start - PREROLL_SECONDS)) / playbackRate) * 1000 + 300),
  );
  options.onStart?.();
  return true;
}

/** Test seam: the number of cached audio elements (kept small on purpose). */
export function russianAudioCacheSize(): number {
  return audioCache.size;
}

/** Drop cached elements, e.g. after the lesson changes drastically. */
export function resetRussianAudio(): void {
  stopRussianClip();
  audioCache = new Map();
  manifests.clear();
  activeLessonId = null;
}
