#!/usr/bin/env node
// Integration diagnostic: run on the build runner, separately from fixture tests.
// Uses only the public configuration shipped in the APK; never prints tokens.
import { readFileSync } from 'node:fs';
const saved = JSON.parse(readFileSync(new URL('../config/supabase.public.json', import.meta.url), 'utf8'));
const project = process.env.EXPO_PUBLIC_SUPABASE_URL || saved.EXPO_PUBLIC_SUPABASE_URL;
const endpoint = process.env.EXPO_PUBLIC_NARRATOR_CLOUD_URL || (project && `${project}/functions/v1/narration-tts`);
const persona = readFileSync(new URL('../lib/narrator/voiceCast.ts', import.meta.url), 'utf8').match(/NARRATOR_PERSONA_TAG = '([^']+)'/)?.[1];
const samples = [['en', 'Hello.'], ['de', 'Guten Tag.'], ['tr', 'Merhaba.']];
const results = [];
if (!endpoint) results.push('public endpoint missing');
else {
  for (const [lang, text] of samples) {
    const url = new URL(endpoint);
    url.searchParams.set('lang', lang);
    url.searchParams.set('text', text);
    url.searchParams.set('speed', 'normal');
    url.searchParams.set('persona', persona || '');
    if (process.env.EXPO_PUBLIC_NARRATION_TTS_TOKEN) url.searchParams.set('token', process.env.EXPO_PUBLIC_NARRATION_TTS_TOKEN);
    const started = Date.now();
    try {
      const response = await fetch(url, { headers: { Accept: 'audio/*' }, signal: AbortSignal.timeout(15000) });
      const bytes = new Uint8Array(await response.arrayBuffer());
      const type = response.headers.get('content-type') || '';
      const audio = response.ok && type.startsWith('audio/') && bytes.length > 100;
      let code = '';
      if (!audio && /json/.test(type)) {
        try { code = JSON.parse(new TextDecoder().decode(bytes)).code || ''; } catch { /* report HTTP status only */ }
      }
      results.push(`${lang}: ${audio ? 'audio OK' : 'UNAVAILABLE'} HTTP ${response.status}, ${bytes.length} bytes, ${Date.now() - started}ms${/^[A-Z_0-9-]{1,60}$/.test(code) ? ` (${code})` : ''}`);
    } catch (error) {
      results.push(`${lang}: UNAVAILABLE ${error.name === 'TimeoutError' ? 'timeout' : 'connection failed'}`);
    }
  }
}
const summary = results.join(' | ');
console.log(summary);
if (process.env.GITHUB_ACTIONS === 'true') console.log(`::notice title=Live narrator integration::${summary}`);
// Diagnostic only: a provider incident must not suppress unrelated APK repairs.
