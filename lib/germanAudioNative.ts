/**
 * Web build of the native audio bridge: the browser uses an `Audio` element
 * (see `lib/germanAudio.ts`), so every function here is a no-op.
 */
export type NativeManifest = {
  version: number;
  lessons: Record<string, {
    sentences: { file: string; clips: Record<string, [number, number]> };
    words: { file: string; clips: Record<string, [number, number]> };
  }>;
};

export const GERMAN_AUDIO_MANIFEST = { version: 0, lessons: {} } as NativeManifest;

/** The browser keeps the narrator in memory; nothing to load here. */
export function setNativeGermanVoice(_voiceId: string): void {
  /* no-op on web */
}

export function bundledGermanClip(
  _lessonId: string | null | undefined,
  _kind: 'sentence' | 'word',
  _text: string,
): { file: string; start: number; end: number } | null {
  return null;
}

export function hasBundledGermanLesson(_lessonId: string | null | undefined): boolean {
  return false;
}

export async function playNativeGermanClip(_options: {
  text: string;
  kind?: 'sentence' | 'word';
  lessonId?: string | null;
  rate?: number;
  onStart?: () => void;
  onDone?: () => void;
}): Promise<boolean> {
  return false;
}

export function stopNativeGermanClip(): void {
  /* web uses the Audio element */
}
