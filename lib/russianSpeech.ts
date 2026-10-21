/**
 * Russian speech, the same way the German course does it.
 *
 * The Russian course ships a neural female narrator inside the app
 * (`public/audio/ru`). Every sentence and every vocabulary word has its own clip,
 * so the lessons sound identical on every phone — with no Russian system voice
 * installed and with no network. The phone's own `ru-RU` voice is only a
 * *failure cover*: if a clip cannot start at all, that one sentence is read by
 * the device instead of leaving the lesson silent. The cover is not a choice and
 * is never used while the bundled audio works.
 *
 * The public API is small on purpose so the screens changed one call at a time:
 *
 *   speakRussian({ text, lessonId, rate })   // bundled clip, device fallback
 *   stopRussianSpeech()                      // both players, always
 *   primeRussianSpeech()                     // warm the cache on screen focus
 */
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { loadRussianAudioManifest, playRussianClip, setRussianAudioLesson, stopRussianClip } from './russianAudio';
import { preloadSpeechVoices, resolveSpeechOptions } from './speechLanguage';

export const RUSSIAN_SPEECH_LOCALE = 'ru-RU';

export type RussianSpeechRequest = {
  text: string;
  /** `sentence` for the lesson line, `word` for a vocabulary chip. */
  kind?: 'sentence' | 'word';
  /** Which lesson pack to read from; defaults to the last lesson set. */
  lessonId?: string | null;
  /** 0.85 = normal, 0.5-0.7 = slow replay. The bundled pack is pitched, not sped. */
  rate?: number;
  onStart?: () => void;
  onDone?: () => void;
  /** Called only when neither the bundled clip nor the device voice could speak. */
  onError?: () => void;
};

let sequence = 0;

/** Remember the lesson so callers that only pass text still find its clips. */
export function setRussianSpeechLesson(lessonId: string | null): void {
  setRussianAudioLesson(lessonId);
}

/**
 * Does this browser have any speech engine at all?
 *
 * Firefox for Android does not. Calling `Speech.speak` there used to produce an
 * unhandled rejection; a missing engine is a plain "no cover available", so the
 * error callback (and only that) runs.
 */
function deviceSpeechAvailable(): boolean {
  if (Platform.OS !== 'web') return true;
  if (typeof window === 'undefined') return false;
  return typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined';
}

function deviceSpeak(
  text: string,
  options: RussianSpeechRequest,
  request: number,
  onFailed?: (() => void) | null,
): void {
  if (!deviceSpeechAvailable()) {
    if (onFailed) onFailed();
    else options.onError?.();
    return;
  }
  const rate = options.rate ?? 0.85;
  void resolveSpeechOptions(RUSSIAN_SPEECH_LOCALE)
    .then(targetVoice => {
      if (request !== sequence) return;
      try {
        Speech.speak(text, {
          ...targetVoice,
          rate,
          onStart: () => { if (request === sequence) options.onStart?.(); },
          onDone: () => { if (request === sequence) options.onDone?.(); },
          onError: () => {
            if (request !== sequence) return;
            if (onFailed) onFailed();
            else options.onError?.();
          },
        });
      } catch {
        if (request !== sequence) return;
        if (onFailed) onFailed();
        else options.onError?.();
      }
    })
    .catch(() => {
      if (request !== sequence) return;
      if (onFailed) onFailed();
      else options.onError?.();
    });
}

/**
 * Speak one Russian sentence or word.
 *
 * `lessonId` wins over the remembered lesson, so a review card reads from the
 * card's own lesson even if the learner came from a different screen.
 */
export function speakRussian(options: RussianSpeechRequest): void {
  const text = options.text.trim();
  if (!text) return;
  const request = ++sequence;

  const lessonId = options.lessonId === undefined ? undefined : options.lessonId;
  if (lessonId !== undefined) setRussianAudioLesson(lessonId);

  // Both players must be quiet before the next clip starts: the device engine
  // and the Audio element do not know about each other.
  safeSpeechStop();

  void playRussianClip({
    text,
    kind: options.kind ?? 'sentence',
    lessonId,
    rate: options.rate,
    onStart: () => {
      if (request !== sequence) return;
      options.onStart?.();
    },
    onDone: () => {
      if (request === sequence) options.onDone?.();
    },
  }).then(played => {
    if (played || request !== sequence) return;
    // No bundled clip (missing pack, blocked autoplay, no codec): let the phone
    // read this one sentence rather than staying silent.
    deviceSpeak(text, options, request, null);
  }).catch(() => {
    if (request !== sequence) return;
    deviceSpeak(text, options, request, null);
  });
}

/** Stop whatever is speaking: bundled clip first, then the device voice. */
export function stopRussianSpeech(): void {
  sequence += 1;
  stopRussianClip();
  safeSpeechStop();
}

function safeSpeechStop(): void {
  if (!deviceSpeechAvailable()) return;
  try {
    // expo-speech's web `stop()` rejects when the engine is gone; an unhandled
    // rejection surfaces as a page error, so it is swallowed here.
    void Promise.resolve(Speech.stop()).catch(() => undefined);
  } catch {
    /* no engine */
  }
}

/**
 * Warm the paths used by the first sentence: the device voice list and the
 * bundled manifest. Cheap, and it keeps the first tap from feeling slow.
 */
export function primeRussianSpeech(): void {
  preloadSpeechVoices();
  if (Platform.OS === 'web' && typeof fetch === 'function') {
    // Cached, so one call warms the manifest for the first real sentence.
    void loadRussianAudioManifest().catch(() => undefined);
  }
}
