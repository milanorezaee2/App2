/**
 * The short English greeting on the main screen.
 *
 * It used to be one fixed WAV file, rendered by a thin, buzzy voice that read
 * "Welcome to Milo" with a poor accent and an unpleasant tone — the learner
 * described it as weak and unattractive. The app already has a much better voice
 * available: the phone's own English text-to-speech engine, the very voice the
 * English lessons use.
 *
 * So the greeting now prefers the device voice and keeps a bundled clip only as
 * the fallback for browsers that have no speech engine at all (Firefox for
 * Android). That clip was re-rendered with a neural voice, so even the fallback
 * no longer sounds synthetic.
 */
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { createAudioPlayer } from 'expo-audio';
import { loadAvailableVoices, speechTagFor, type SpeechVoiceInfo } from './speechLanguage';

export const WELCOME_TEXT = 'Welcome to Milo!';
export const WELCOME_LOCALE = 'en-US';

export type WelcomeEngine = 'device' | 'bundled' | 'none';

/** Firefox for Android has no Web Speech API; native always has an engine. */
export function welcomeDeviceSpeechAvailable(): boolean {
  if (Platform.OS !== 'web') return true;
  return typeof window !== 'undefined' && !!(window as unknown as { speechSynthesis?: unknown }).speechSynthesis;
}

function pickEnglishVoice(voices: SpeechVoiceInfo[]): SpeechVoiceInfo | undefined {
  const english = voices.filter(voice => (voice.language || '').toLowerCase().startsWith('en'));
  return english.find(voice => /^en[-_]us/i.test(voice.language || '')) ?? english[0];
}

function playBundledWelcome(): WelcomeEngine {
  try {
    const player = createAudioPlayer(require('../assets/audio/welcome-voice.wav'));
    player.volume = 0.9;
    player.play();
    setTimeout(() => {
      try {
        player.remove();
      } catch {
        /* already released */
      }
    }, 3000);
    return 'bundled';
  } catch {
    return 'none';
  }
}

/**
 * Speak the greeting once. Never throws: a phone that cannot speak simply shows
 * the screen without blocking anything.
 */
export async function playWelcomeVoice(): Promise<WelcomeEngine> {
  if (!welcomeDeviceSpeechAvailable()) return playBundledWelcome();

  let voices: SpeechVoiceInfo[] = [];
  try {
    voices = await loadAvailableVoices();
  } catch {
    voices = [];
  }
  const voice = pickEnglishVoice(voices);

  try {
    Speech.speak(WELCOME_TEXT, {
      language: speechTagFor(WELCOME_LOCALE),
      ...(voice?.identifier ? { voice: voice.identifier } : {}),
      // Natural pace and pitch: the English lessons use the same delivery.
      rate: 1,
      pitch: 1,
    });
    return 'device';
  } catch {
    // No installed engine after all: the bundled neural clip covers it.
    return playBundledWelcome();
  }
}
