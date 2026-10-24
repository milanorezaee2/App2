import * as ExpoSpeech from 'expo-speech';

/** Sentence read-aloud is removed in all three learning tracks. */
export const NARRATION_ENABLED = false;

export type SpeechOptions = Parameters<typeof ExpoSpeech.speak>[1];
export type Voice = ExpoSpeech.Voice;

/** Compatibility entry point for existing controls; never synthesises speech. */
export function speak(_text: string, _options?: SpeechOptions): void {}

/** Stop any narration that may still be playing. Safe when nothing plays. */
export function stop(): Promise<void> {
  return ExpoSpeech.stop();
}

export const getAvailableVoicesAsync = ExpoSpeech.getAvailableVoicesAsync;
export const isSpeakingAsync = ExpoSpeech.isSpeakingAsync;
export const pause = ExpoSpeech.pause;
export const resume = ExpoSpeech.resume;
