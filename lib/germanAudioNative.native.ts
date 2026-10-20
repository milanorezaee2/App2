/**
 * Native playback for the bundled German voice.
 *
 * Android and iOS have no `Audio` element, so the same MP3 clips are played with
 * `expo-audio`. Metro copies them into the app bundle through the generated
 * `germanAudioAssets.ts` map, which means German works on a phone with no German
 * text-to-speech installed and with no network connection.
 *
 * Lesson clips are slices of a longer per-lesson MP3: the manifest stores
 * `[start, end]` for every sentence and word. Playing such a slice naively
 * (`seekTo()` then `play()`) sounds broken on a phone: the player is still
 * loading, so the seek is dropped and the listener hears the head of a *different*
 * sentence, or the safety timer starts before the audio does and cuts the tail off
 * mid-word. Every clip here is therefore played in this order:
 *
 *   1. wait until the file reports `isLoaded`,
 *   2. seek and then wait until the reported position really is the clip start,
 *   3. start the player and only then start the stop timer,
 *   4. stop on the real playback position (plus a short natural tail) — never on a
 *      guess, so words are not clipped and nothing overlaps.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { GERMAN_AUDIO_FILES, GERMAN_AUDIO_MANIFEST } from './germanAudioAssets';

export type NativeManifest = typeof GERMAN_AUDIO_MANIFEST;

export { GERMAN_AUDIO_MANIFEST };

/** Extra room after the manifest end so the final consonant is never clipped. */
const TAIL_SECONDS = 0.12;
/** The words pack leaves 0.22 s between two words; stay well inside that. */
const MAX_TAIL_SECONDS = 0.18;

let player: AudioPlayer | null = null;
let stopTimer: ReturnType<typeof setTimeout> | null = null;
let statusSub: { remove: () => void } | null = null;
let session = 0;
let modeReady: Promise<void> | null = null;

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

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

function detachStatus(): void {
  try {
    statusSub?.remove();
  } catch {
    /* listener already gone */
  }
  statusSub = null;
}

function releasePlayer(): void {
  clearStopTimer();
  detachStatus();
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
  session += 1;
  releasePlayer();
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
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
  const range = pack?.clips?.[normalize(text)];
  if (!pack?.file || !range) return null;
  return { file: pack.file, start: range[0], end: range[1] };
}

export function hasBundledGermanLesson(lessonId: string | null | undefined): boolean {
  return !!lessonId && !!GERMAN_AUDIO_MANIFEST.lessons[lessonId];
}

/** Wait until the freshly created player has loaded its file. */
async function waitForLoaded(target: AudioPlayer, timeoutMs = 3000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let loaded = false;
    try {
      loaded = target.isLoaded;
    } catch {
      loaded = false;
    }
    if (loaded) return true;
    await sleep(25);
  }
  return false;
}

/** Seek, then wait until the player position really moved to the requested time. */
async function seekAndSettle(target: AudioPlayer, seconds: number, timeoutMs = 1500): Promise<boolean> {
  const tolerance = 0.06;
  try {
    await target.seekTo(seconds);
  } catch {
    return false;
  }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let position: number | null = null;
    try {
      position = target.currentTime;
    } catch {
      position = null;
    }
    if (position !== null && Math.abs(position - seconds) <= tolerance) return true;
    await sleep(25);
  }
  // Some engines only report a position while playing; one more attempt is
  // better than starting the clip from the wrong place.
  try {
    target.currentTime = seconds;
  } catch {
    /* read-only on this platform */
  }
  await sleep(60);
  return true;
}

/**
 * Play one bundled clip. Resolves `false` only when the clip cannot start at all,
 * so the caller can fall back to the device voice.
 */
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

  const request = ++session;
  const isCurrent = () => request === session;

  await ensureAudioMode();
  releasePlayer();
  if (!isCurrent()) return true;

  const created = createAudioPlayer(assetId);
  player = created;

  const rate = options.rate ?? 1;
  const speed = rate >= 0.85 ? 1 : rate >= 0.7 ? 0.85 : 0.75;
  try {
    created.volume = 1;
    created.playbackRate = speed;
  } catch {
    /* older players expose fewer setters */
  }

  // Wait for the file, but never treat a slow loader as a failure: a bundled
  // asset that reports nothing must still be attempted, otherwise a phone with
  // no German voice would fall back to reading German with a foreign accent.
  await waitForLoaded(created, 1500);
  if (!isCurrent()) return true;

  const settled = await seekAndSettle(created, clip.start);
  if (!isCurrent()) return true;
  if (!settled) {
    releasePlayer();
    return false;
  }

  const tail = Math.min(TAIL_SECONDS, MAX_TAIL_SECONDS);
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearStopTimer();
    detachStatus();
    if (!isCurrent()) return;
    releasePlayer();
    options.onDone?.();
  };

  try {
    statusSub = created.addListener('playbackStatusUpdate', status => {
      if (!isCurrent() || finished) return;
      if (status.didJustFinish) {
        finish();
        return;
      }
      if (status.currentTime >= clip.end + tail) finish();
    });
  } catch {
    /* no status events: the timer below still ends the clip */
  }

  try {
    created.play();
  } catch {
    releasePlayer();
    return false;
  }

  options.onStart?.();

  // Safety net only: the status listener normally ends the clip at its real end.
  // This timer starts *after* playback began, so the seek latency can no longer
  // eat into the sentence.
  const expectedMs = ((clip.end - clip.start + tail) / speed) * 1000;
  stopTimer = setTimeout(() => finish(), expectedMs + 400);
  return true;
}
