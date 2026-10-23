import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import * as Speech from '@/lib/narration';
import { isCloudNarratorActive } from './cloudNarrator';
import {
  getNarratorSnapshot,
  narrate,
  pauseNarration,
  primeNarrator,
  resumeNarration,
  setNarratorAuto,
  setNarratorSpeed,
  stopNarration,
  subscribeNarrator,
  unlockAndReplay,
  type NarratorSnapshot,
} from './engine';
import type { NarratorLocale } from './voiceCast';

/**
 * Bind one lesson screen to the shared narrator.
 *
 * `text` is the sentence the learner is looking at. While automatic narration
 * is on, entering a lesson or moving to another sentence reads it once, in the
 * warm female narrator voice of that language.
 */
export interface LessonNarratorControls extends NarratorSnapshot {
  replay: () => void;
  stop: () => void;
  togglePause: () => void;
  setAuto: (auto: boolean) => void;
  toggleSpeed: () => void;
  isAutomatic: boolean;
}

export function useLessonNarrator(params: {
  text: string;
  locale: NarratorLocale;
  enabled?: boolean;
}): LessonNarratorControls {
  const { text, locale, enabled = true } = params;
  const snapshot = useSyncExternalStore(subscribeNarrator, getNarratorSnapshot, getNarratorSnapshot);
  const lastRead = useRef<string>('');
  const cleanText = text.replace(/\s+/g, ' ').trim();
  const readKey = `${locale}|${cleanText}`;

  useEffect(() => {
    void primeNarrator(locale).catch(() => undefined);
  }, [locale]);

  useEffect(() => {
    if (!enabled || !cleanText) return;
    if (!snapshot.settingsReady || !snapshot.auto) return;
    if (lastRead.current === readKey) return;

    const timer = setTimeout(() => {
      // A manual speaker button on the same screen may already be talking;
      // never let the automatic narrator speak over the learner's own tap.
      void Speech.isSpeakingAsync()
        .catch(() => false)
        .then(speaking => {
          if (speaking || isCloudNarratorActive()) return;
          lastRead.current = readKey;
          void narrate(cleanText, locale).catch(() => undefined);
        });
    }, 320);
    return () => clearTimeout(timer);
  }, [readKey, cleanText, enabled, locale, snapshot.auto, snapshot.settingsReady]);

  // Leaving the lesson always silences the narrator.
  useEffect(() => () => stopNarration(), []);

  const replay = useCallback(() => {
    if (!cleanText) return;
    lastRead.current = readKey;
    if (snapshot.status === 'blocked') void unlockAndReplay();
    else void narrate(cleanText, locale);
  }, [cleanText, locale, readKey, snapshot.status]);

  const stop = useCallback(() => {
    stopNarration();
  }, []);

  const togglePause = useCallback(() => {
    if (snapshot.status === 'speaking' || snapshot.status === 'loading') {
      void pauseNarration();
      return;
    }
    if (snapshot.status === 'paused') {
      void resumeNarration();
      return;
    }
    replay();
  }, [replay, snapshot.status]);

  const setAuto = useCallback((auto: boolean) => {
    lastRead.current = '';
    setNarratorAuto(auto);
  }, []);

  const toggleSpeed = useCallback(() => {
    setNarratorSpeed(snapshot.speed === 'slow' ? 'normal' : 'slow');
  }, [snapshot.speed]);

  return {
    ...snapshot,
    replay,
    stop,
    togglePause,
    setAuto,
    toggleSpeed,
    isAutomatic: snapshot.auto && enabled,
  };
}
