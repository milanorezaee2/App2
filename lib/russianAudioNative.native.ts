/**
 * Native playback for the bundled Russian narrator.
 *
 * Android and iOS have no `Audio` element, so the same MP3 clips are played with
 * `expo-audio`. Metro copies them into the app bundle through the generated
 * `russianAudioAssets.ts` map, which means Russian works on a phone with no
 * Russian text-to-speech installed and with no network connection.
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
 *
 * A seek that cannot be confirmed is a *failure*, never a success; the clip is
 * retried once on a fresh player and only then reported as unplayable.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { RUSSIAN_AUDIO_FILES, RUSSIAN_AUDIO_MANIFESTS } from './russianAudioAssets';
import { RUSSIAN_DEFAULT_NARRATOR_ID, findRussianNarrator } from './languages/russianNarrator';

/**
 * Same key as `normalize_key()` in `scripts/russian_voice.py` and as
 * `normalizeRussianClipText` in `russianAudio.ts`. Duplicated on purpose: this
 * module is bundled on its own for the phone, and importing the web player here
 * would create a cycle.
 */
function normalizeClipText(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[\u0301\u00b4\u02b9\u2032]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

type SingleManifest = (typeof RUSSIAN_AUDIO_MANIFESTS)[string];
export type NativeManifest = SingleManifest;

/** Which narrator's pack is played; changed by `setNativeRussianVoice`. */
let activeVoiceId = RUSSIAN_DEFAULT_NARRATOR_ID;

export function setNativeRussianVoice(voiceId: string): void {
  const next = findRussianNarrator(voiceId).id;
  if (next === activeVoiceId) return;
  stopNativeRussianClip();
  activeVoiceId = next;
}

export function getNativeRussianVoice(): string {
  return activeVoiceId;
}

function manifestFor(voiceId: string): SingleManifest {
  return RUSSIAN_AUDIO_MANIFESTS[voiceId] ?? RUSSIAN_AUDIO_MANIFESTS[RUSSIAN_DEFAULT_NARRATOR_ID];
}

/** Room after the recorded speech; the pack keeps 0.45-0.55 s of silence there. */
const TAIL_SECONDS = 0.15;
/**
 * Start 0.25 s inside the silence that precedes every clip. The pack guarantees
 * 0.30 s of digital silence before the speech and 0.45-0.55 s after it, so a
 * seek that lands late, or a decoder that overshoots, still lands in silence:
 * the learner can never hear a fragment of the previous or the next sentence.
 */
const PRE_ROLL_SECONDS = 0.25;
/** Never listen past the neighbour's guard silence, even with a slow seek. */
const MAX_TAIL_SECONDS = 0.25;

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

export function stopNativeRussianClip(): void {
  session += 1;
  releasePlayer();
}

export function bundledRussianClip(
  lessonId: string | null | undefined,
  kind: 'sentence' | 'word',
  text: string,
): { file: string; start: number; end: number } | null {
  if (!lessonId) return null;
  const lesson = manifestFor(activeVoiceId).lessons[lessonId];
  if (!lesson) return null;
  const pack = kind === 'word' ? lesson.words : lesson.sentences;
  const range = pack?.clips?.[normalizeClipText(text)];
  if (!pack?.file || !range) return null;
  return { file: pack.file, start: range[0], end: range[1] };
}

export function hasBundledRussianLesson(lessonId: string | null | undefined): boolean {
  return !!lessonId && !!manifestFor(activeVoiceId).lessons[lessonId];
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
async function seekAndSettle(target: AudioPlayer, seconds: number, timeoutMs = 1200): Promise<boolean> {
  // A clip that starts inside the first 0.25 s plays from the head of the file,
  // which the pack guarantees to be silence.
  if (seconds <= 0.001) return true;
  const tolerance = 0.06;
  let before = 0;
  try {
    before = target.currentTime ?? 0;
  } catch {
    before = 0;
  }
  const reached = async (): Promise<boolean> => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      let position: number | null = null;
      try {
        position = target.currentTime;
      } catch {
        position = null;
      }
      // The position must both match the target and differ from where the
      // player stood before the seek. Without the second half, a dropped seek
      // looks successful for clips that start near 0 (all first words).
      const moved = position !== null && Math.abs(position - before) > 0.01;
      if (position !== null && moved && Math.abs(position - seconds) <= tolerance) return true;
      await sleep(20);
    }
    return false;
  };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await target.seekTo(seconds);
    } catch {
      return false;
    }
    if (await reached()) return true;
    // Nothing is audible while we retry: the player has not been started, so a
    // failed seek costs a moment of silence instead of the wrong sentence.
  }
  return false;
}

/**
 * Play one bundled clip. Resolves `false` only when the clip cannot start at all,
 * so the caller can fall back to the device voice.
 */
export async function playNativeRussianClip(options: {
  text: string;
  kind?: 'sentence' | 'word';
  lessonId?: string | null;
  rate?: number;
  onStart?: () => void;
  onDone?: () => void;
}): Promise<boolean> {
  const clip = bundledRussianClip(options.lessonId, options.kind ?? 'sentence', options.text);
  if (!clip) return false;
  const assetId = RUSSIAN_AUDIO_FILES[`${activeVoiceId}/${clip.file}`];
  if (assetId === undefined) return false;

  const request = ++session;
  const isCurrent = () => request === session;
  const seekTo = Math.max(0, clip.start - PRE_ROLL_SECONDS);
  const rate = options.rate ?? 1;
  const speed = rate >= 0.82 ? 1 : rate >= 0.62 ? 0.85 : 0.75;

  await ensureAudioMode();
  if (!isCurrent()) return true;

  const attempt = async (): Promise<boolean | 'retry'> => {
    releasePlayer();
    if (!isCurrent()) return true;

    const created = createAudioPlayer(assetId);
    player = created;
    try {
      created.volume = 1;
      created.playbackRate = speed;
    } catch {
      /* older players expose fewer setters */
    }

    const loaded = await waitForLoaded(created, 1500);
    if (!isCurrent()) return true;
    if (!loaded) return 'retry';

    if (!(await seekAndSettle(created, seekTo))) {
      if (!isCurrent()) return true;
      return 'retry';
    }
    if (!isCurrent()) return true;

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
      return 'retry';
    }

    options.onStart?.();

    // Safety net only: the status listener normally ends the clip at its real
    // end. This timer starts *after* playback began, so the seek latency can no
    // longer eat into the sentence.
    const expectedMs = ((clip.end - seekTo + tail) / speed) * 1000;
    stopTimer = setTimeout(() => finish(), expectedMs + 400);
    return true;
  };

  const first = await attempt();
  if (first !== 'retry') return first;
  if (!isCurrent()) return true;
  const second = await attempt();
  if (second === 'retry') {
    if (isCurrent()) releasePlayer();
    return false;
  }
  return second;
}
