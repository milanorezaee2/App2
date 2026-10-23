import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from '@/lib/narration';
import { NARRATION_ENABLED, registerNarrationStopHandler } from '@/lib/narration';
import { setAudioModeAsync } from 'expo-audio';
import { Platform } from 'react-native';
import {
  checkCloudNarrator,
  isCloudNarratorActive,
  NarratorBlockedError,
  NarratorCloudUnavailableError,
  pauseCloudNarration,
  playCloudNarration,
  resumeCloudNarration,
  stopCloudNarration,
  unlockCloudPlayback,
} from './cloudNarrator';
import {
  NARRATOR_PROSODY,
  narratorRateFor,
  resolveNarratorVoice,
  splitForNarration,
  type NarratorLocale,
  type NarratorSpeed,
} from './voiceCast';

/**
 * The lesson narrator engine.
 *
 * One warm female voice per language reads the sentence a learner is looking
 * at. It prefers the human-sounding cloud narrator when it is deployed and
 * falls back to the best neural voice on the device otherwise. All lesson
 * screens share this single engine, so a tap on any speaker control and the
 * automatic narrator can never talk over each other.
 */

export type NarratorStatus = 'idle' | 'loading' | 'speaking' | 'paused' | 'blocked' | 'error';
export type NarratorEngineKind = 'cloud' | 'device' | null;

export interface NarratorSnapshot {
  status: NarratorStatus;
  engine: NarratorEngineKind;
  voiceLabel: string;
  qualityLabel: string;
  auto: boolean;
  speed: NarratorSpeed;
  settingsReady: boolean;
  cloudAvailable: boolean;
  cloudChecked: boolean;
  message: string;
  locale: NarratorLocale | null;
  text: string;
}

const SETTINGS_KEY = 'mml_narrator_settings_v1';

type PersistedSettings = { auto?: boolean; speed?: NarratorSpeed };

let snapshot: NarratorSnapshot = {
  status: 'idle',
  engine: null,
  voiceLabel: 'در حال شناسایی صدا…',
  qualityLabel: '',
  auto: true,
  speed: 'normal',
  settingsReady: false,
  cloudAvailable: false,
  cloudChecked: false,
  message: '',
  locale: null,
  text: '',
};

const listeners = new Set<() => void>();
let requestId = 0;
let lastRequest: { text: string; locale: NarratorLocale } | null = null;
let settingsWriteTimer: ReturnType<typeof setTimeout> | null = null;

function emit(): void {
  for (const listener of listeners) listener();
}

function update(patch: Partial<NarratorSnapshot>): void {
  snapshot = { ...snapshot, ...patch };
  emit();
}

export function getNarratorSnapshot(): NarratorSnapshot {
  return snapshot;
}

export function subscribeNarrator(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function persistSettings(): void {
  if (settingsWriteTimer) clearTimeout(settingsWriteTimer);
  settingsWriteTimer = setTimeout(() => {
    const settings: PersistedSettings = { auto: snapshot.auto, speed: snapshot.speed };
    void AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)).catch(() => undefined);
  }, 250);
}

async function loadSettings(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    const parsed = raw ? (JSON.parse(raw) as PersistedSettings) : {};
    update({
      auto: parsed.auto !== false,
      speed: parsed.speed === 'slow' ? 'slow' : 'normal',
      settingsReady: true,
    });
  } catch {
    update({ settingsReady: true });
  }
}

void loadSettings();

/** Keeps the device audio session warm so iOS plays the narrator in silent mode. */
let audioSessionPrepared = false;
async function prepareAudioSession(): Promise<void> {
  if (audioSessionPrepared || Platform.OS === 'web') return;
  audioSessionPrepared = true;
  try {
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
  } catch {
    audioSessionPrepared = false;
  }
}

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

async function speakWithDevice(
  text: string,
  locale: NarratorLocale,
  speed: NarratorSpeed,
  id: number,
): Promise<void> {
  const profile = await resolveNarratorVoice(locale);
  if (id !== requestId) return;

  update({
    status: 'speaking',
    engine: 'device',
    voiceLabel: profile.label,
    qualityLabel: profile.quality,
    locale,
  });

  const rate = narratorRateFor(locale, speed);
  const { pitch, gapMs } = NARRATOR_PROSODY[locale];
  const chunks = splitForNarration(text);

  for (let index = 0; index < chunks.length; index += 1) {
    if (id !== requestId) return;
    await new Promise<void>(resolve => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      try {
        Speech.speak(chunks[index], {
          language: profile.language,
          voice: profile.voice,
          rate,
          pitch,
          onDone: finish,
          onStopped: finish,
          onError: finish,
        } as Parameters<typeof Speech.speak>[1]);
      } catch {
        // A device without a usable engine must not freeze the narrator bar.
        if (id === requestId) {
          update({ status: 'error', message: 'صدای دستگاه در دسترس نیست؛ متن درس همچنان خوانده می‌شود.' });
        }
        finish();
      }

      if (Platform.OS === 'web') {
        // Safari/Chrome block speech without a gesture and never call back.
        setTimeout(() => {
          if (settled) return;
          void Speech.isSpeakingAsync()
            .then(speaking => {
              if (!speaking) {
                if (id === requestId) {
                  update({
                    status: 'blocked',
                    message: 'مرورگر برای پخش صدا نیاز به یک لمس دارد.',
                  });
                }
                finish();
              }
            })
            .catch(finish);
        }, 1400);
      }
    });
    if (index < chunks.length - 1) await delay(gapMs);
  }

  if (id !== requestId) return;
  if (snapshot.status === 'blocked') return;
  update({ status: 'idle' });
}

/**
 * True while the engine itself calls `Speech.stop()`. The registered cleanup
 * must not mistake that internal stop for a learner pressing another button.
 */
let internalStop = false;

function haltPlayback(): void {
  stopCloudNarration();
  internalStop = true;
  try {
    void Speech.stop();
  } finally {
    internalStop = false;
  }
}

/**
 * Reads one sentence with the professional narrator.
 * Resolves when the voice finishes, pauses, or is replaced by a newer request.
 */
export async function narrate(
  text: string,
  locale: NarratorLocale,
  options: { speed?: NarratorSpeed } = {},
): Promise<void> {
  if (!NARRATION_ENABLED) return;
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return;

  const id = ++requestId;
  lastRequest = { text: clean, locale };
  const speed = options.speed ?? snapshot.speed;

  haltPlayback();
  await prepareAudioSession();
  if (id !== requestId) return;

  update({ status: 'loading', message: '', locale, text: clean });

  const deviceProfile = await resolveNarratorVoice(locale);
  if (id !== requestId) return;
  update({ voiceLabel: deviceProfile.label, qualityLabel: deviceProfile.quality });

  const cloud = await checkCloudNarrator();
  if (id !== requestId) return;
  update({ cloudAvailable: cloud, cloudChecked: true });

  if (cloud) {
    try {
      update({ status: 'speaking', engine: 'cloud', voiceLabel: 'نریتور حرفه‌ای', qualityLabel: 'انسانی' });
      await playCloudNarration({
        text: clean,
        locale,
        speed: speed === 'slow' ? 0.82 : 1,
        cancelled: () => id !== requestId,
      });
      if (id !== requestId) return;
      update({ status: snapshot.status === 'paused' ? 'paused' : 'idle' });
      return;
    } catch (error) {
      if (id !== requestId) return;
      if (error instanceof NarratorBlockedError) {
        update({ status: 'blocked', message: 'برای شنیدن نریتور، یک‌بار دکمهٔ پخش را لمس کنید.' });
        return;
      }
      // Any other cloud problem: fall back to the device voice without a pause.
      update({ cloudAvailable: false, message: '' });
    }
  }

  if (id !== requestId) return;
  update({ status: 'loading' });
  await speakWithDevice(clean, locale, speed, id);
}

/** Stops narration and clears the current request. */
export function stopNarration(): void {
  requestId += 1;
  stopCloudNarration();
  void Speech.stop();
  update({ status: 'idle', message: '', engine: null });
}

/** Pauses the narrator (cloud audio or device speech). */
export async function pauseNarration(): Promise<void> {
  if (snapshot.status !== 'speaking' && snapshot.status !== 'loading') return;
  if (!pauseCloudNarration()) {
    try {
      Speech.pause();
    } catch {
      // Speech engines that cannot pause simply keep reading the sentence.
    }
  }
  update({ status: 'paused' });
}

/** Resumes after a pause, or replays when the engine could not pause. */
export async function resumeNarration(): Promise<void> {
  if (snapshot.status !== 'paused') return;
  if (resumeCloudNarration()) {
    update({ status: 'speaking', engine: 'cloud' });
    return;
  }
  try {
    Speech.resume();
    update({ status: 'speaking' });
    return;
  } catch {
    // Fall through to a clean replay.
  }
  if (lastRequest) await narrate(lastRequest.text, lastRequest.locale);
}

/**
 * Called inside a user gesture after the browser blocked autoplay.
 * Unlocks the audio element, then restarts the sentence.
 */
export async function unlockAndReplay(): Promise<void> {
  await unlockCloudPlayback();
  update({ status: 'idle', message: '' });
  if (lastRequest) await narrate(lastRequest.text, lastRequest.locale);
}

export function setNarratorAuto(auto: boolean): void {
  update({ auto });
  persistSettings();
  if (!auto) stopNarration();
}

export function setNarratorSpeed(speed: NarratorSpeed): void {
  update({ speed });
  persistSettings();
  if (snapshot.status === 'paused' || snapshot.status === 'blocked') return;
  if (lastRequest) void narrate(lastRequest.text, lastRequest.locale, { speed });
}

/** Warms the voice list and the cloud availability check before the first word. */
export async function primeNarrator(locale: NarratorLocale): Promise<void> {
  const profile = await resolveNarratorVoice(locale);
  if (profile.label) update({ voiceLabel: profile.label, qualityLabel: profile.quality });
  const cloud = await checkCloudNarrator();
  update({ cloudAvailable: cloud, cloudChecked: true });
}

export function isNarratorBusy(): boolean {
  return isCloudNarratorActive() || snapshot.status === 'speaking' || snapshot.status === 'loading';
}

/**
 * Any screen that calls `Speech.stop()` — every existing speaker button does —
 * also silences the cloud narrator, so the two voices never overlap.
 */
registerNarrationStopHandler(() => {
  stopCloudNarration();
  if (internalStop) return;
  if (snapshot.engine === 'cloud' && snapshot.status !== 'blocked') {
    update({ status: 'idle', engine: null });
  }
  if (snapshot.engine === 'device' && snapshot.status === 'speaking') {
    const id = requestId;
    setTimeout(() => {
      if (requestId !== id || snapshot.status !== 'speaking' || snapshot.engine !== 'device') return;
      void Speech.isSpeakingAsync()
        .then(speaking => {
          if (!speaking && requestId === id) update({ status: 'idle', engine: null });
        })
        .catch(() => undefined);
    }, 180);
  }
});
