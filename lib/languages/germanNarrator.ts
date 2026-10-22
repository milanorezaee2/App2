/**
 * The German narrators.
 *
 * Three neural voices ship together and the learner picks one on the
 * `صدای آلمانی` page; the choice is remembered and every German screen then
 * speaks with exactly that voice. Keeping the list in
 * `config/german-narrator.json` means the pack generator (Python), the bundled
 * clip player and the device-voice fallback all read the same numbers, so the
 * voice the learner heard in the samples cannot silently become another one.
 *
 * `verify-german-narrator.cjs` pins the shipped packs to this file.
 */
import preset from '../../config/german-narrator.json';
import { toPersianDigits } from '../format';

export type GermanNarrator = {
  /** Stable id, also the folder name of its audio pack: `public/audio/de/<id>/`. */
  id: string;
  /** Speech engine behind the voice (`piper` = neural, generated offline). */
  engine: string;
  /** Voice that built the bundled pack, e.g. `de_DE-kerstin-low`. */
  voice: string;
  /** Short name shown on the picker, e.g. «کرستین». */
  nameFa: string;
  /** One-line description, e.g. «زن، نرم و گرم و مهربان». */
  descriptionFa: string;
  /** Pack tempo in words per minute, measured from the shipped clips. */
  wordsPerMinute: number;
  /** expo-speech rate for a normal sentence (1 = the engine's own pace). */
  deviceRate: number;
  /** expo-speech rate for the shadowing stage. */
  deviceShadowRate: number;
  /** expo-speech rate for the "آهسته" replay. */
  deviceSlowRate: number;
  /** Neural speed setting used to render the pack. */
  lengthScale: number;
};

export const GERMAN_NARRATORS = preset.narrators as GermanNarrator[];
export const GERMAN_DEFAULT_NARRATOR_ID: string = preset.default;

export function isGermanNarratorId(value: unknown): value is string {
  return typeof value === 'string' && GERMAN_NARRATORS.some(narrator => narrator.id === value);
}

/** The narrator with this id, or the default one when it is unknown/missing. */
export function findGermanNarrator(id?: string | null): GermanNarrator {
  return GERMAN_NARRATORS.find(narrator => narrator.id === id)
    ?? GERMAN_NARRATORS.find(narrator => narrator.id === GERMAN_DEFAULT_NARRATOR_ID)
    ?? GERMAN_NARRATORS[0];
}

/**
 * The French lesson API calls `speakGerman` with 0.9 for a normal sentence,
 * 0.75 for shadowing and 0.55 for slow replay. The device engine ignores the
 * sub-1 values today (anything >= 0.85 becomes 1), so they are mapped onto the
 * chosen narrator's three real device rates.
 */
export function germanDeviceRate(requestedRate?: number, narratorId?: string | null): number {
  const narrator = findGermanNarrator(narratorId);
  if (requestedRate === undefined || requestedRate >= 0.85) return narrator.deviceRate;
  if (requestedRate >= 0.7) return narrator.deviceShadowRate;
  return narrator.deviceSlowRate;
}

/** Human-readable one-liner for the voice page and the release notes. */
export function germanNarratorLabel(id?: string | null): string {
  const narrator = findGermanNarrator(id);
  return `${narrator.nameFa} · ${narrator.descriptionFa} · ${toPersianDigits(narrator.wordsPerMinute)} کلمه در دقیقه`;
}
