import { Platform } from 'react-native';
import { playNativeGermanClip, setNativeGermanVoice, stopNativeGermanClip } from './germanAudioNative';
import { GERMAN_DEFAULT_NARRATOR_ID, findGermanNarrator } from './languages/germanNarrator';

/**
 * In-app German voice.
 *
 * The German course ships its own audio (`public/audio/de`): every sentence and
 * every vocabulary word was rendered once, so the lessons sound German on any
 * device — including phones whose system voices are English-only, and Firefox
 * for Android, which has no Web Speech synthesis at all.
 *
 * Nothing here touches the network beyond the app's own static files, and the
 * device voice is only used as a fallback when a clip is missing.
 */

export type GermanClipKind = 'sentence' | 'word';

type ClipRange = [number, number];

type PackEntry = { file: string; clips: Record<string, ClipRange> };

type LessonAudio = { sentences: PackEntry; words: PackEntry };

/** A `Audio`-compatible constructor; replaced in tests to record clip playback. */
type AudioFactory = (src: string) => HTMLAudioElement;
let audioFactory: AudioFactory | null = null;

export function setGermanAudioFactory(factory: AudioFactory | null): void {
  audioFactory = factory;
  audioCache = new Map();
}

type GermanAudioManifest = {
  version: number;
  narrator?: string;
  engine?: string;
  generatedAt?: string;
  lessons: Record<string, LessonAudio>;
};

/**
 * Every narrator has its own folder and its own manifest:
 * `/audio/de/<narrator>/manifest.json`. One lesson always plays from one folder,
 * so choosing a voice can never mix two speakers in the same session.
 */
const manifestPath = (voiceId: string) => `/audio/de/${voiceId}/manifest.json`;

/**
 * Playback window around every clip.
 *
 * The pack puts 0.30 s of digital silence before each sentence and 0.55 s after
 * it (0.45 s for the word pack). Starting 0.25 s early and stopping 0.15 s late
 * means the player only ever crosses silence between two clips: a slow seek, an
 * encoder delay, or a browser that lands a frame off can add silence, never a
 * fragment of the sentence before or after. That is the "no interference"
 * promise for the German course.
 */
const PREROLL_SECONDS = 0.25;
const TAIL_SECONDS = 0.15;

const manifests = new Map<string, Promise<GermanAudioManifest | null>>();
let activeLessonId: string | null = null;
let activeVoiceId = GERMAN_DEFAULT_NARRATOR_ID;
let audioCache = new Map<string, HTMLAudioElement>();
let currentStop: (() => void) | null = null;

function basePrefix(): string {
  const envBase = typeof process !== 'undefined' ? (process.env as Record<string, string | undefined>)?.EXPO_BASE_URL : undefined;
  if (envBase) return envBase.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location?.pathname?.startsWith('/App1')) return '/App1';
  return '';
}

export function germanAudioAssetUrl(path: string): string {
  return `${basePrefix()}${path.startsWith('/') ? path : `/${path}`}`;
}

/** The lesson whose clips should be used for the current screen. */
export function setGermanAudioLesson(lessonId: string | null): void {
  if (activeLessonId === lessonId) return;
  activeLessonId = lessonId;
  stopGermanClip();
}

export function getGermanAudioLesson(): string | null {
  return activeLessonId;
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** The narrator whose audio is played. `setGermanAudioVoice` switches packs. */
export function setGermanAudioVoice(voiceId: string): void {
  const next = findGermanNarrator(voiceId).id;
  if (next === activeVoiceId) return;
  stopGermanClip();
  activeVoiceId = next;
  setNativeGermanVoice(next);
}

export function getGermanAudioVoice(): string {
  return activeVoiceId;
}

export async function loadGermanAudioManifest(voiceId = activeVoiceId): Promise<GermanAudioManifest | null> {
  if (Platform.OS !== 'web') return null;
  if (typeof window === 'undefined' || typeof fetch !== 'function') return null;
  if (!manifests.has(voiceId)) {
    try {
      manifests.set(voiceId, fetch(germanAudioAssetUrl(manifestPath(voiceId)))
        .then(response => (response.ok ? response.json() as Promise<GermanAudioManifest> : null))
        .catch(() => null));
    } catch {
      // A relative URL is invalid outside a browser document (tests, SSR).
      manifests.set(voiceId, Promise.resolve(null));
    }
  }
  return manifests.get(voiceId) as Promise<GermanAudioManifest | null>;
}

export function germanClipFor(
  manifest: GermanAudioManifest | null,
  lessonId: string | null,
  kind: GermanClipKind,
  text: string,
): { file: string; start: number; end: number } | null {
  if (!manifest || !lessonId) return null;
  const lesson = manifest.lessons[lessonId];
  if (!lesson) return null;
  const pack = kind === 'word' ? lesson.words : lesson.sentences;
  const range = pack?.clips?.[normalize(text)];
  if (!pack?.file || !range) return null;
  return { file: pack.file, start: range[0], end: range[1] };
}

function audioFor(file: string): HTMLAudioElement {
  // Keyed by narrator as well: the same lesson file name exists once per voice.
  const key = `${activeVoiceId}/${file}`;
  const cached = audioCache.get(key);
  if (cached) return cached;
  const create = audioFactory ?? (src => new Audio(src));
  const audio = create(germanAudioAssetUrl(`/audio/de/${key}`));
  audio.preload = 'auto';
  audioCache.set(key, audio);
  return audio;
}

export function stopGermanClip(): void {
  stopNativeGermanClip();
  if (currentStop) {
    const stop = currentStop;
    currentStop = null;
    stop();
  }
}

/**
 * Play one bundled German clip. Resolves `true` when the audio really started,
 * `false` when the caller should fall back to the device voice.
 */
export async function playGermanClip(options: {
  text: string;
  kind?: GermanClipKind;
  lessonId?: string | null;
  rate?: number;
  onStart?: () => void;
  onDone?: () => void;
  onError?: () => void;
}): Promise<boolean> {
  // Android/iOS play the same MP3s from the app bundle with expo-audio; the
  // files are referenced in the generated germanAudioAssets.native.ts.
  if (Platform.OS !== 'web') {
    return playNativeGermanClip({
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
  const clip = germanClipFor(await loadGermanAudioManifest(voiceId), options.lessonId ?? activeLessonId, options.kind ?? 'sentence', options.text);
  if (!clip) return false;

  stopGermanClip();
  const audio = audioFor(clip.file);
  // The lesson asks for 0.9 on a normal sentence and 0.55 for slow replay.
  const rate = options.rate ?? 0.9;
  const playbackRate = rate >= 0.85 ? 1 : rate >= 0.7 ? 0.85 : 0.75;
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
export function germanAudioCacheSize(): number {
  return audioCache.size;
}

/** Drop cached elements, e.g. after the lesson changes drastically. */
export function resetGermanAudio(): void {
  stopGermanClip();
  audioCache = new Map();
  manifests.clear();
  activeLessonId = null;
}
