import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

// v1 wrote HTTP error bodies straight into the final .mp3; never reuse those.
const CACHE_DIR = `${FileSystem.cacheDirectory || ''}lesson-audio-v2/`;
const inflight = new Map<string, Promise<string>>();
const TIMEOUT_MS = 8000;
function hash(value: string): string {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
}
const uriFor = (url: string, key: string) => `${CACHE_DIR}${key.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)}-${hash(url)}.mp3`;
export const audioCacheEnabled = () => Platform.OS !== 'web' && Boolean(FileSystem.cacheDirectory);

export async function cachedAudioFile(url: string, key: string): Promise<string | null> {
  if (!audioCacheEnabled()) return null;
  const uri = uriFor(url, key);
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists && info.size > 0 ? uri : null;
}
export async function invalidateCachedAudio(url: string, key: string): Promise<void> {
  if (audioCacheEnabled()) await FileSystem.deleteAsync(uriFor(url, key), { idempotent: true });
}
export async function cacheAudioFile(url: string, key: string): Promise<string> {
  if (!audioCacheEnabled()) return url;
  const finalUri = uriFor(url, key);
  const existing = inflight.get(finalUri);
  if (existing) return existing;
  const task = (async () => {
    const cached = await cachedAudioFile(url, key);
    if (cached) return cached; // Offline playback does not need a health request.
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    const temporary = `${finalUri}.part`;
    const download = FileSystem.createDownloadResumable(url, temporary, { headers: { Accept: 'audio/*' } });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        download.downloadAsync(),
        new Promise<never>((_, reject) => { timer = setTimeout(() => {
          void download.cancelAsync().catch(() => undefined);
          reject(Error('Audio download timed out'));
        }, TIMEOUT_MS); }),
      ]);
      const type = result?.headers?.['Content-Type'] ?? result?.headers?.['content-type'] ?? '';
      if (!result || result.status < 200 || result.status >= 300 || /json|text\/|html/i.test(type)) throw Error('Audio response is not playable');
      const info = await FileSystem.getInfoAsync(temporary);
      if (!info.exists || info.size === 0) throw Error('Audio file is empty');
      await FileSystem.moveAsync({ from: temporary, to: finalUri });
      return finalUri;
    } catch (error) {
      await download.cancelAsync().catch(() => undefined);
      await FileSystem.deleteAsync(temporary, { idempotent: true }).catch(() => undefined);
      throw error;
    } finally { if (timer) clearTimeout(timer); }
  })();
  inflight.set(finalUri, task);
  try { return await task; } finally { inflight.delete(finalUri); }
}
export async function clearNarratorCache(): Promise<void> {
  if (audioCacheEnabled()) await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
}
