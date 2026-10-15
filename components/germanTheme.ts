import type { GermanSentenceLevelId } from '@/lib/languages/germanSentenceCourse';

/** Shared bright blue system keeps English and German visually consistent. */
export const GermanPalette = {
  canvas: '#F6FAFF',
  surface: '#FFFFFF',
  surfaceMuted: '#F2F7FD',
  ink: '#102A56',
  text: '#425E80',
  muted: '#7086A2',
  border: '#DCE8F7',
  primary: '#1769D2',
  primaryDark: '#104A94',
  primarySoft: '#EAF3FF',
  teal: '#128DA8',
  tealSoft: '#E9F9FC',
  success: '#168451',
  successSoft: '#ECF9F2',
  warning: '#A65C14',
  warningSoft: '#FFF6E8',
  danger: '#B4233B',
  dangerSoft: '#FFF0F2',
  gold: '#DCA72C',
  goldSoft: '#FFF7DF',
  forest: '#1259B5',
  forestDeep: '#102A56',
} as const;

export const GERMAN_LEVEL_GRADIENTS: Record<GermanSentenceLevelId, [string, string]> = {
  0: ['#4D9AF2', '#1769D2'],
  1: ['#2EB7CF', '#128DA8'],
  2: ['#557FE0', '#3155B4'],
  3: ['#3A6FB7', '#193F73'],
};
