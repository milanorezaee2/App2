// Professional lesson narrator — human-sounding female neural voice.
//
// The app calls this function before a sentence is read. When it answers, the
// learner hears one consistent warm female narrator in English, German and
// Russian on every device and browser. When it is not deployed, the app
// silently falls back to the best neural voice installed on the device, so the
// three learning tracks always have sound.
//
// Deploy:  npx supabase functions deploy narration-tts --no-verify-jwt
// Secret:  npx supabase secrets set OPENAI_API_KEY=sk-...
// Optional: NARRATION_TTS_TOKEN (shared token), OPENAI_TTS_MODEL,
//           OPENAI_TTS_VOICE_EN / _DE / _RU.
//
// Privacy: only the lesson sentence is sent. No learner identity, no audio, no
// transcripts and no free-form chat ever reach this function.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

type LanguageCode = 'en' | 'de' | 'ru';

const VOICE_ENV: Record<LanguageCode, string> = {
  en: 'OPENAI_TTS_VOICE_EN',
  de: 'OPENAI_TTS_VOICE_DE',
  ru: 'OPENAI_TTS_VOICE_RU',
};

const DEFAULT_VOICE: Record<LanguageCode, string> = {
  en: 'nova',
  de: 'coral',
  ru: 'coral',
};

// One persona, three languages. The wording is deliberately about delivery,
// not content: the narrator must read the sentence and nothing else.
const PERSONA: Record<LanguageCode, string> = {
  en: 'You are a warm, calm, professional female English teacher narrating one short sentence for an adult learner. Speak in a natural American English accent at a relaxed, friendly pace. Pronounce every word clearly and connect the sentence smoothly, with gentle warmth and a soft smile in the voice. Read only the sentence you are given, exactly as written. Never add, explain, translate, greet or repeat.',
  de: 'You are a warm, calm, professional female German teacher narrating one short sentence for an adult learner. Speak in natural Standard German (Hochdeutsch) at a relaxed, friendly pace. Pronounce every word clearly and connect the sentence smoothly, with gentle warmth and a soft smile in the voice. Read only the sentence you are given, exactly as written. Never add, explain, translate, greet or repeat.',
  ru: 'You are a warm, calm, professional female Russian teacher narrating one short sentence for an adult learner. Speak in natural Standard Russian at a relaxed, friendly pace, with correct stress and soft consonants. Pronounce every word clearly, with gentle warmth and a soft smile in the voice. Read only the sentence you are given, exactly as written. Never add, explain, translate, greet or repeat.',
};

const MAX_TEXT = 320;
const CACHE_LIMIT = 160;
const cache = new Map<string, Uint8Array>();

function cacheGet(key: string): Uint8Array | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

function cacheSet(key: string, value: Uint8Array): void {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, value);
}

function normalizeText(raw: string | null): string {
  return (raw ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TEXT + 1);
}

function parseSpeed(raw: string | null): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) return 1;
  return Math.min(1.2, Math.max(0.6, Number(value.toFixed(2))));
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'GET') return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  const url = new URL(request.url);

  if (url.searchParams.get('health') === '1') {
    if (!apiKey) {
      return json({ ok: false, code: 'NARRATION_NOT_CONFIGURED' }, 503);
    }
    return json({
      ok: true,
      provider: 'openai',
      model: Deno.env.get('OPENAI_TTS_MODEL') || 'gpt-4o-mini-tts',
      persona: 'warm-female-teacher-v1',
      languages: ['en', 'de', 'ru'],
    });
  }

  const expectedToken = Deno.env.get('NARRATION_TTS_TOKEN');
  if (expectedToken && url.searchParams.get('token') !== expectedToken) {
    return json({ error: 'Narrator token is invalid', code: 'NARRATION_TOKEN_INVALID' }, 401);
  }
  if (!apiKey) return json({ error: 'Narrator is not configured', code: 'NARRATION_NOT_CONFIGURED' }, 503);

  const langRaw = (url.searchParams.get('lang') || 'en').toLowerCase();
  const lang: LanguageCode = langRaw === 'de' ? 'de' : langRaw === 'ru' ? 'ru' : 'en';
  const text = normalizeText(url.searchParams.get('text'));
  if (!text) return json({ error: 'text is required', code: 'TEXT_REQUIRED' }, 400);
  if (text.length > MAX_TEXT) return json({ error: 'Sentence is too long', code: 'TEXT_TOO_LONG' }, 413);

  const speed = parseSpeed(url.searchParams.get('speed'));
  const model = Deno.env.get('OPENAI_TTS_MODEL') || 'gpt-4o-mini-tts';
  const voice = Deno.env.get(VOICE_ENV[lang]) || DEFAULT_VOICE[lang];
  const key = `${model}|${voice}|${lang}|${speed}|${text}`;

  const cached = cacheGet(key);
  if (cached) {
    return new Response(cached, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=604800, immutable',
        'X-Narrator-Cache': 'hit',
        'X-Narrator-Voice': voice,
      },
    });
  }

  const supportsInstructions = /gpt-4o/i.test(model);
  const payload: Record<string, unknown> = {
    model,
    voice,
    input: text,
    response_format: 'mp3',
    speed,
  };
  if (supportsInstructions) payload.instructions = PERSONA[lang];

  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('Narrator synthesis failed', response.status, (await response.text()).slice(0, 400));
      return json({ error: 'Narrator could not synthesize this sentence', code: 'TTS_FAILED' }, 502);
    }

    const audio = new Uint8Array(await response.arrayBuffer());
    if (!audio.byteLength) return json({ error: 'Empty narrator audio', code: 'TTS_EMPTY' }, 502);
    cacheSet(key, audio);

    return new Response(audio, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=604800, immutable',
        'X-Narrator-Cache': 'miss',
        'X-Narrator-Voice': voice,
      },
    });
  } catch (error) {
    console.error('Narrator request failed', error);
    return json({ error: 'Narrator request failed', code: 'TTS_NETWORK' }, 502);
  }
});
