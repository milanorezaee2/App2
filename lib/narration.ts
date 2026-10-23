import * as ExpoSpeech from 'expo-speech';

/**
 * Single narration switch for the English, German and Russian learning tracks.
 *
 * The learner asked for the narrator to be removed completely: nothing is read
 * aloud automatically, and pressing a speaker/sound control no longer speaks
 * either. Lesson text, translations, pronunciation guides and the screen
 * structure stay exactly as they were, so the tracks only lose the voice.
 *
 * Every speech call in those tracks goes through this module, so the narration
 * can be turned back on from one line without touching any screen again.
 */
export const NARRATION_ENABLED = false;

export type SpeechOptions = Parameters<typeof ExpoSpeech.speak>[1];
export type Voice = ExpoSpeech.Voice;

/** Speak the text only when narration is enabled; otherwise stay silent. */
export function speak(text: string, options?: SpeechOptions): void {
  if (!NARRATION_ENABLED) return;
  void ExpoSpeech.speak(text, options);
}

/** Stop any narration that may still be playing. Safe when nothing plays. */
export function stop(): Promise<void> {
  return ExpoSpeech.stop();
}

export const getAvailableVoicesAsync = ExpoSpeech.getAvailableVoicesAsync;
export const isSpeakingAsync = ExpoSpeech.isSpeakingAsync;
export const pause = ExpoSpeech.pause;
export const resume = ExpoSpeech.resume;
