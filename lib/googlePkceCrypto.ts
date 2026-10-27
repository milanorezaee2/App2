import { Platform } from 'react-native';
import * as ExpoCrypto from 'expo-crypto';

/** Supply only the WebCrypto operations used by Supabase PKCE on Hermes.
 * Without them auth-js falls back to Math.random/plain challenges on native.
 * Browser WebCrypto is never replaced; native uses the existing Expo CSPRNG
 * and native SHA-256 module, not a JavaScript random-number substitute.
 */
export function ensureGooglePkceCrypto(): void {
  if (Platform.OS !== 'web') {
    const crypto = globalThis.crypto || ({} as Crypto);
    if (!crypto.getRandomValues) {
      crypto.getRandomValues = ExpoCrypto.getRandomValues as Crypto['getRandomValues'];
    }
    if (!crypto.subtle) {
      Object.defineProperty(crypto, 'subtle', { value: {
        digest(algorithm: AlgorithmIdentifier, data: BufferSource) {
          const name = typeof algorithm === 'string' ? algorithm : algorithm.name;
          if (name !== 'SHA-256') return Promise.reject(new Error('Unsupported PKCE digest'));
          return ExpoCrypto.digest(ExpoCrypto.CryptoDigestAlgorithm.SHA256, data);
        },
      } as SubtleCrypto, configurable: true });
    }
    if (!globalThis.crypto) {
      Object.defineProperty(globalThis, 'crypto', { value: crypto, configurable: true });
    }
  }
  if (!globalThis.crypto?.getRandomValues || !globalThis.crypto?.subtle?.digest || typeof TextEncoder === 'undefined') {
    throw new Error('GOOGLE_SECURE_CONTEXT_REQUIRED');
  }
}
