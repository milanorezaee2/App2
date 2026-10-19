import type { GermanSentenceLevelId } from '@/lib/languages/germanSentenceCourse';

/** German identity: emerald forest with restrained gold accents. */
export const GermanPalette = {
  canvas: '#F5FAF7',
  surface: '#FFFFFF',
  surfaceMuted: '#F0F7F3',
  ink: '#123B31',
  text: '#41665B',
  muted: '#78958B',
  border: '#D6E8DF',
  primary: '#16806A',
  primaryDark: '#0F5A4A',
  primarySoft: '#E6F5EF',
  teal: '#0E8B88',
  tealSoft: '#E4F7F5',
  success: '#168451',
  successSoft: '#ECF9F2',
  warning: '#A65C14',
  warningSoft: '#FFF6E8',
  danger: '#B4233B',
  dangerSoft: '#FFF0F2',
  gold: '#DCA72C',
  goldSoft: '#FFF7DF',
  forest: '#126B59',
  forestDeep: '#0D3D32',
} as const;

export const GERMAN_LEVEL_GRADIENTS: Record<GermanSentenceLevelId, [string, string]> = {
  0: ['#2FA884', '#126B59'],
  1: ['#35B7A2', '#0E817A'],
  2: ['#4E9B72', '#236548'],
  3: ['#B88A3B', '#6B4A1E'],
};
