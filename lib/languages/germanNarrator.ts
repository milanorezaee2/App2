/**
 * The one German narrator.
 *
 * The voice is a neural one (`piper`, offline, rendered ahead of time), because
 * the formant synthesizer the course started with never sounded like a person.
 * Keeping the choice in `config/german-narrator.json` means the audio pack
 * generator (Python), the bundled clip player and the device-voice fallback all
 * read the same numbers, so "the voice I chose" cannot silently stay the old
 * one in one of the three places.
 *
 * `verify-german-narrator.cjs` pins the shipped manifest to this file.
 */
import preset from '../../config/german-narrator.json';
import { toPersianDigits } from '../format';

export type GermanNarrator = {
  /** Voice that built the bundled pack, e.g. `de_DE-kerstin-low`. */
  voice: string;
  /** Speech engine behind that voice (`piper` = neural, offline). */
  engine: string;
  /** Persian description shown in the app. */
  descriptionFa: string;
  /** Pack tempo in words per minute, measured from the shipped clips. */
  wordsPerMinute: number;
  /** expo-speech rate for a normal sentence (1 = the engine's own pace). */
  deviceRate: number;
  /** expo-speech rate for the shadowing stage. */
  deviceShadowRate: number;
  /** expo-speech rate for the "آهسته" replay. */
  deviceSlowRate: number;
  /** Free-form note about which sample this preset came from. */
  selection: string;
};

export const GERMAN_NARRATOR = preset as GermanNarrator;

/**
 * The French lesson API calls `speakGerman` with 0.9 for a normal sentence,
 * 0.75 for shadowing and 0.55 for slow replay. The device engine ignores the
 * sub-1 values today (anything >= 0.85 became 1), which is why German sounded
 * slower than the chosen narrator. These thresholds now map the same three
 * intents onto the preset's device rates.
 */
export function germanDeviceRate(requestedRate?: number): number {
  if (requestedRate === undefined || requestedRate >= 0.85) return GERMAN_NARRATOR.deviceRate;
  if (requestedRate >= 0.7) return GERMAN_NARRATOR.deviceShadowRate;
  return GERMAN_NARRATOR.deviceSlowRate;
}

/** Human-readable one-liner for the voice page and the release notes. */
export function germanNarratorLabel(): string {
  return `${GERMAN_NARRATOR.descriptionFa} · ${toPersianDigits(GERMAN_NARRATOR.wordsPerMinute)} کلمه در دقیقه`;
}
