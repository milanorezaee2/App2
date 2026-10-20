/**
 * Native playback for the bundled German voice.
 *
 * Android and iOS have no `Audio` element, so the same MP3 clips are played with
 * `expo-audio`. Metro copies them into the app bundle through the generated
 * `germanAudioAssets.native.ts` map, which means German works on a phone with no
 * German text-to-speech installed and with no network connection.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { GERMAN_AUDIO_FILES, GERMAN_AUDIO_MANIFEST } from './germanAudioAssets';

export type NativeManifest = typeof GERMAN_AUDIO_MANIFEST;

export { GERMAN_AUDIO_MANIFEST };

let player: AudioPlayer | null = null;
let stopTimer: ReturnType<typeof setTimeout> | null = null;
let modeReady: Promise<void> | null = null;

function ensureAudioMode(): Promise<void> {
  if (!modeReady) {
    modeReady = setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'duckOthers',
    }).catch(() => undefined);
  }
  return modeReady;
}

function clearStopTimer(): void {
  if (stopTimer) clearTimeout(stopTimer);
  stopTimer = null;
}

function releasePlayer(): void {
  clearStopTimer();
  if (!player) return;
  try {
    player.pause();
  } catch {
    /* already stopped */
  }
  try {
    player.remove();
  } catch {
    /* already released */
  }
  player = null;
}

export function stopNativeGermanClip(): void {
  releasePlayer();
}

export function bundledGermanClip(
  lessonId: string | null | undefined,
  kind: 'sentence' | 'word',
  text: string,
): { file: string; start: number; end: number } | null {
  if (!lessonId) return null;
  const lesson = GERMAN_AUDIO_MANIFEST.lessons[lessonId];
  if (!lesson) return null;
  const pack = kind === 'word' ? lesson.words : lesson.sentences;
  const key = text.trim().toLowerCase().replace(/\s+/g, ' ');
  const range = pack?.clips?.[key];
  if (!pack?.file || !range) return null;
  return { file: pack.file, start: range[0], end: range[1] };
}

export function hasBundledGermanLesson(lessonId: string | null | undefined): boolean {
  return !!lessonId && !!GERMAN_AUDIO_MANIFEST.lessons[lessonId];
}

/** Play one bundled clip; resolves false when it cannot start. */
export async function playNativeGermanClip(options: {
  text: string;
  kind?: 'sentence' | 'word';
  lessonId?: string | null;
  rate?: number;
  onStart?: () => void;
  onDone?: () => void;
}): Promise<boolean> {
  const clip = bundledGermanClip(options.lessonId, options.kind ?? 'sentence', options.text);
  if (!clip) return false;
  const assetId = GERMAN_AUDIO_FILES[clip.file];
  if (assetId === undefined) return false;

  await ensureAudioMode();
  releasePlayer();

  const created = createAudioPlayer(assetId);
  player = created;
  // eSpeak reads quickly; the lesson's natural rate is 0.9 and 0.55 for slow replay.
  const rate = options.rate ?? 0.9;
  try {
    created.playbackRate = rate >= 0.85 ? 1 : rate >= 0.7 ? 0.85 : 0.75;
    created.volume = 1;
  } catch {
    /* older players expose fewer setters */
  }

  try {
    await created.seekTo(clip.start);
    created.play();
  } catch {
    releasePlayer();
    return false;
  }

  options.onStart?.();
  const playbackRate = rate >= 0.85 ? 1 : rate >= 0.7 ? 0.85 : 0.75;
  const durationMs = Math.max(150, ((clip.end - clip.start) / playbackRate) * 1000 + 90);
  stopTimer = setTimeout(() => {
    const current = player;
    releasePlayer();
    if (current) options.onDone?.();
  }, durationMs);
  return true;
}
