import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { useIsFocused } from '@react-navigation/native';
import {
  getNarratorSnapshot,
  narrate,
  pauseNarration,
  chooseDeviceNarration,
  chooseOriginalNarration,
  resumeNarration,
  setNarratorAuto,
  setNarratorSpeed,
  stopNarration,
  subscribeNarrator,
  unlockAndReplay,
  type NarratorSnapshot,
} from './engine';
import type { NarratorLocale, NarratorSpeed } from './voiceCast';

/**
 * Bind one lesson screen to the shared narrator.
 *
 * `text` is the sentence the learner is looking at. While automatic narration
 * is on, entering a lesson or moving to another sentence reads it once, in the
 * warm female narrator voice of that language.
 */
export interface LessonNarratorControls extends NarratorSnapshot {
  replay: () => void;
  useDeviceVoice: () => void;
  useOriginalVoice: () => void;
  stop: () => void;
  togglePause: () => void;
  setAuto: (auto: boolean) => void;
  setSpeed: (speed: NarratorSpeed) => void;
  toggleSpeed: () => void;
  isAutomatic: boolean;
}

export function useLessonNarrator(params: {
  text: string;
  locale: NarratorLocale;
  enabled?: boolean;
}): LessonNarratorControls {
  const { text, locale, enabled = true } = params;
  const focused = useIsFocused();
  const snapshot = useSyncExternalStore(subscribeNarrator, getNarratorSnapshot, getNarratorSnapshot);
  const lastRead = useRef<string>('');
  const cleanText = text.replace(/\s+/g, ' ').trim();
  const readKey = `${locale}|${cleanText}`;

  useEffect(() => {
    if (!enabled || !focused || !cleanText) return;
    if (!snapshot.settingsReady || !snapshot.auto) return;
    if (lastRead.current === readKey) return;

    const timer = setTimeout(() => {
      lastRead.current = readKey;
      void narrate(cleanText, locale).catch(() => undefined);
    }, 10);
    return () => clearTimeout(timer);
  }, [readKey, cleanText, enabled, focused, locale, snapshot.auto, snapshot.settingsReady]);

  // Leaving the lesson always silences the narrator.
  useEffect(() => {
    if (!focused) { lastRead.current = ''; stopNarration(); }
    return () => { lastRead.current = ''; stopNarration(); };
  }, [focused]);

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
    const next = snapshot.speed === 'slow'
      ? 'normal'
      : snapshot.speed === 'normal'
        ? 'fast'
        : 'slow';
    setNarratorSpeed(next);
  }, [snapshot.speed]);

  const setSpeed = useCallback((speed: NarratorSpeed) => {
    setNarratorSpeed(speed);
  }, []);

  return {
    ...snapshot,
    replay,
    useDeviceVoice: () => { void chooseDeviceNarration(cleanText, locale).catch(() => undefined); },
    useOriginalVoice: () => { void chooseOriginalNarration(cleanText, locale).catch(() => undefined); },
    stop,
    togglePause,
    setAuto,
    setSpeed,
    toggleSpeed,
    isAutomatic: snapshot.auto && enabled,
  };
}
