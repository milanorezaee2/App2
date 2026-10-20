import { Platform } from 'react-native';
import { playNativeGermanClip, stopNativeGermanClip } from './germanAudioNative';

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
  engine?: string;
  generatedAt?: string;
  lessons: Record<string, LessonAudio>;
};

const MANIFEST_PATH = '/audio/de/manifest.json';

let manifestPromise: Promise<GermanAudioManifest | null> | null = null;
let activeLessonId: string | null = null;
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

export async function loadGermanAudioManifest(): Promise<GermanAudioManifest | null> {
  if (Platform.OS !== 'web') return null;
  if (typeof window === 'undefined' || typeof fetch !== 'function') return null;
  if (!manifestPromise) {
    try {
      manifestPromise = fetch(germanAudioAssetUrl(MANIFEST_PATH))
        .then(response => (response.ok ? response.json() as Promise<GermanAudioManifest> : null))
        .catch(() => null);
    } catch {
      // A relative URL is invalid outside a browser document (tests, SSR).
      manifestPromise = Promise.resolve(null);
    }
  }
  return manifestPromise;
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
  const cached = audioCache.get(file);
  if (cached) return cached;
  const create = audioFactory ?? (src => new Audio(src));
  const audio = create(germanAudioAssetUrl(`/audio/de/${file}`));
  audio.preload = 'auto';
  audioCache.set(file, audio);
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
  const manifest = await loadGermanAudioManifest();
  const clip = germanClipFor(manifest, options.lessonId ?? activeLessonId, options.kind ?? 'sentence', options.text);
  if (!clip) return false;

  stopGermanClip();
  const audio = audioFor(clip.file);
  // eSpeak reads quickly; the lesson's natural rate is 0.9 and 0.55 for slow replay.
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
  const onTime = () => {
    // Fallback in case `ended` never fires because we stop before the file ends.
    if (audio.currentTime >= clip.end - 0.02) finish(true);
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
    audio.currentTime = clip.start;
    if (audio.readyState < 2) {
      await new Promise<void>(resolve => {
        const ready = () => { audio.removeEventListener('canplay', ready); resolve(); };
        audio.addEventListener('canplay', ready);
        setTimeout(ready, 1200);
      });
      audio.currentTime = clip.start;
    }
    await audio.play();
  } catch {
    // Autoplay blocked or codec missing: let the caller use the device voice.
    done = true;
    cleanup();
    return false;
  }
  // Stop exactly at the end of this clip instead of waiting for the next
  // `timeupdate` (which only fires about four times a second).
  stopTimer = setTimeout(
    () => finish(true),
    Math.max(120, ((clip.end - clip.start) / playbackRate) * 1000 + 80),
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
  manifestPromise = null;
  activeLessonId = null;
}
