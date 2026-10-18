import * as Speech from 'expo-speech';

type SpeechLocale = 'en-US' | 'de-DE' | 'ru-RU';

const warmedLocales = new Set<SpeechLocale>();
const playCounts = new Map<string, number>();
let active = false;
let requestId = 0;

/**
 * Starts the platform TTS engine silently while the lesson is loading. Native
 * engines often need one cold-start request before their first audible phrase.
 */
export function warmSpeech(locale: SpeechLocale) {
  // Intentionally silent. The previous warm-up spoke "ready" and "bereit" aloud at startup.
  if (warmedLocales.has(locale)) return;
  warmedLocales.add(locale);
}

/** First press uses natural 1× speed; the second press of the same phrase uses 0.5×. */
function alternatingRate(locale: SpeechLocale, text: string) {
  const key = `${locale}:${text}`;
  const count = playCounts.get(key) ?? 0;
  playCounts.set(key, count + 1);
  return count % 2 === 0 ? 1 : 0.5;
}

export function playResponsiveSpeech({
  text,
  locale,
  rate,
  onDone,
  onError,
}: {
  text: string;
  locale: SpeechLocale;
  rate?: number;
  onDone?: () => void;
  onError?: () => void;
}) {
  const currentRequest = ++requestId;
  const selectedRate = rate ?? alternatingRate(locale, text);
  const start = () => {
    if (currentRequest !== requestId) return;
    active = true;
    Speech.speak(text, {
      language: locale,
      rate: selectedRate,
      onDone: () => {
        if (currentRequest === requestId) active = false;
        onDone?.();
      },
      onStopped: () => {
        if (currentRequest === requestId) active = false;
      },
      onError: () => {
        if (currentRequest === requestId) active = false;
        onError?.();
      },
    });
  };

  if (active) {
    void Speech.stop().catch(() => undefined).finally(start);
  } else {
    start();
  }

  return selectedRate;
}

export function stopResponsiveSpeech() {
  requestId += 1;
  active = false;
  return Speech.stop();
}
