/**
 * The Russian narrator.
 *
 * The Russian course used to be read by whatever `ru-RU` voice the phone had.
 * On many phones that voice is missing (or male, or robotic), and Firefox for
 * Android has no speech synthesis at all. One neural female narrator is now
 * rendered into the app itself (`public/audio/ru/<id>/`), exactly like the
 * German course, so every lesson sounds the same everywhere and works offline.
 *
 * `config/russian-narrator.json` is the single source of truth: the pack
 * generator (Python), the bundled clip player and the device fallback all read
 * this file, so the voice that was rendered cannot silently become another one.
 * Adding a second narrator later is a config entry plus a re-render; the app
 * already reads a list.
 *
 * `verify-russian-narrator.cjs` pins the shipped pack to this file.
 */
import preset from '../../config/russian-narrator.json';
import { toPersianDigits } from '../format';

export type RussianNarrator = {
  /** Stable id, also the folder name of the audio pack: `public/audio/ru/<id>/`. */
  id: string;
  /** Speech engine behind the voice (`piper` = neural, generated offline). */
  engine: string;
  /** Voice that built the bundled pack, e.g. `ru_RU-irina-medium`. */
  voice: string;
  /** Short name shown in the app, e.g. «ایرینا». */
  nameFa: string;
  /** One-line description, e.g. «زن، آرام، مهربان و شیوا». */
  descriptionFa: string;
  /** Pack tempo in words per minute, measured from the shipped clips. */
  wordsPerMinute: number;
  /** Neural speed setting used to render the pack. */
  lengthScale: number;
};

export const RUSSIAN_NARRATORS = preset.narrators as RussianNarrator[];
export const RUSSIAN_DEFAULT_NARRATOR_ID: string = preset.default;

export function isRussianNarratorId(value: unknown): value is string {
  return typeof value === 'string' && RUSSIAN_NARRATORS.some(narrator => narrator.id === value);
}

/** The narrator with this id, or the default one when it is unknown/missing. */
export function findRussianNarrator(id?: string | null): RussianNarrator {
  return RUSSIAN_NARRATORS.find(narrator => narrator.id === id)
    ?? RUSSIAN_NARRATORS.find(narrator => narrator.id === RUSSIAN_DEFAULT_NARRATOR_ID)
    ?? RUSSIAN_NARRATORS[0];
}

/** Human-readable one-liner for the release notes and the voice page. */
export function russianNarratorLabel(id?: string | null): string {
  const narrator = findRussianNarrator(id);
  return `${narrator.nameFa} · ${narrator.descriptionFa} · ${toPersianDigits(narrator.wordsPerMinute)} کلمه در دقیقه`;
}
