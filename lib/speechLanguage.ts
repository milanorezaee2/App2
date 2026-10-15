import { Platform } from 'react-native';

/**
 * Language tag to pass to expo-speech.
 *
 * On Android, expo-speech builds `new Locale(tag)` without splitting region
 * tags, so "ru-RU" becomes the unknown language "ru-ru". The engine then reports
 * the language as unsupported and falls back to the device language, which makes
 * Russian sound wrong and slow to start. Android therefore receives the bare
 * language code ("ru"), which the engine accepts. iOS keeps the full locale.
 */
export function speechTagFor(speechLocale: string): string {
  return Platform.OS === 'android' ? speechLocale.split('-')[0] : speechLocale;
}
