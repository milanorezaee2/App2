// Professional lesson narrator — human-sounding female neural voice.
//
// The app asks this function for one sentence before reading it. When the
// function answers, the learner hears the approved cloud/CDN narrator in
// English, German and Russian on every device and browser. The client never
// falls back to a device speech engine; a missing asset is reported clearly.
//
// Providers (first one that has a key wins, or set NARRATION_PROVIDER):
//   openai      OPENAI_API_KEY              gpt-4o-mini-tts, warm female voice
//   elevenlabs  ELEVENLABS_API_KEY          eleven_multilingual_v2, warm female
//
// Deploy:  npx supabase functions deploy narration-tts --no-verify-jwt
// Secret:  npx supabase secrets set OPENAI_API_KEY=sk-...
//          (or ELEVENLABS_API_KEY=... for the most human voice)
// Optional: NARRATION_TTS_TOKEN (shared token), OPENAI_TTS_MODEL,
//           OPENAI_TTS_VOICE_EN / _DE / _RU,
//           ELEVENLABS_VOICE_EN / _DE / _RU, ELEVENLABS_MODEL.
//
// Privacy: only the lesson sentence is sent to the provider. No learner
// identity, no audio, no transcripts and no free-form chat reach this function.

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

const DEFAULT_OPENAI_VOICE: Record<LanguageCode, string> = {
  en: 'nova',
  de: 'coral',
  ru: 'coral',
};

// ElevenLabs voices are multilingual; Sarah is a warm, calm female voice.
const ELEVEN_VOICE_ENV: Record<LanguageCode, string> = {
  en: 'ELEVENLABS_VOICE_EN',
  de: 'ELEVENLABS_VOICE_DE',
  ru: 'ELEVENLABS_VOICE_RU',
};

const DEFAULT_ELEVEN_VOICE = 'EXAVITQu4vr4xnSDxMaL';

const ELEVEN_VOICE_SETTINGS: Record<LanguageCode, {
  stability: number;
  similarity_boost: number;
  style: number;
}> = {
  en: { stability: 0.50, similarity_boost: 0.85, style: 0.20 },
  de: { stability: 0.42, similarity_boost: 0.80, style: 0.28 },
  ru: { stability: 0.42, similarity_boost: 0.80, style: 0.28 },
};

const LANGUAGE_NAME: Record<LanguageCode, string> = {
  en: 'American English',
  de: 'Standard German (Hochdeutsch)',
  ru: 'Standard Russian',
};

// One persona, three languages. The wording is about delivery only: a real
// person reading one short sentence to a learner, never a robot or a newsreader.
const PERSONA = (lang: LanguageCode) =>
  `You are a warm, friendly female ${LANGUAGE_NAME[lang]} teacher speaking one-to-one with an adult learner. ` +
  'Say the sentence exactly once, like a real human in a relaxed lesson: natural connected speech, ' +
  'gentle and expressive intonation, soft warmth and a calm smile in the voice, with tiny natural pauses at punctuation. ' +
  'Never sound robotic, never read word by word, never slow down unnaturally. ' +
  'Read only the sentence you are given, exactly as written. Do not add, greet, explain, translate, emphasise or repeat.';

const MAX_TEXT = 320;
const CACHE_LIMIT = 160;
const cache = new Map<string, Uint8Array>();

type Provider = 'openai' | 'elevenlabs';

function resolveProvider(): Provider | null {
  const configured = (Deno.env.get('NARRATION_PROVIDER') || '').toLowerCase();
  const hasOpenAI = Boolean(Deno.env.get('OPENAI_API_KEY'));
  const hasEleven = Boolean(Deno.env.get('ELEVENLABS_API_KEY'));
  if (configured === 'elevenlabs') return hasEleven ? 'elevenlabs' : null;
  if (configured === 'openai') return hasOpenAI ? 'openai' : null;
  if (hasEleven) return 'elevenlabs';
  if (hasOpenAI) return 'openai';
  return null;
}

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

function voiceFor(provider: Provider, lang: LanguageCode): string {
  if (provider === 'elevenlabs') {
    return Deno.env.get(ELEVEN_VOICE_ENV[lang]) || DEFAULT_ELEVEN_VOICE;
  }
  return Deno.env.get(VOICE_ENV[lang]) || DEFAULT_OPENAI_VOICE[lang];
}

async function synthesizeOpenAI(apiKey: string, lang: LanguageCode, text: string, voice: string): Promise<Uint8Array> {
  const model = Deno.env.get('OPENAI_TTS_MODEL') || 'gpt-4o-mini-tts';
  const payload: Record<string, unknown> = {
    model,
    voice,
    input: text,
    response_format: 'mp3',
    speed: 1,
  };
  // `instructions` and the expressive models produce human-sounding prosody.
  if (/gpt-4o/i.test(model)) payload.instructions = PERSONA(lang);

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    console.error('OpenAI narrator failed', response.status, (await response.text()).slice(0, 400));
    throw new Error('TTS_FAILED');
  }
  return new Uint8Array(await response.arrayBuffer());
}

async function synthesizeElevenLabs(apiKey: string, lang: LanguageCode, text: string, voice: string): Promise<Uint8Array> {
  const model = Deno.env.get('ELEVENLABS_MODEL') || 'eleven_multilingual_v2';
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({
        text,
        model_id: model,
        voice_settings: { ...ELEVEN_VOICE_SETTINGS[lang], use_speaker_boost: true },
      }),
    },
  );
  if (!response.ok) {
    console.error('ElevenLabs narrator failed', response.status, (await response.text()).slice(0, 400));
    throw new Error('TTS_FAILED');
  }
  return new Uint8Array(await response.arrayBuffer());
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'GET') return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);

  const url = new URL(request.url);
  const provider = resolveProvider();

  if (url.searchParams.get('health') === '1') {
    if (!provider) return json({ ok: false, code: 'NARRATION_NOT_CONFIGURED' }, 503);
    return json({
      ok: true,
      provider,
      model: provider === 'elevenlabs'
        ? Deno.env.get('ELEVENLABS_MODEL') || 'eleven_multilingual_v2'
        : Deno.env.get('OPENAI_TTS_MODEL') || 'gpt-4o-mini-tts',
      persona: 'warm-female-teacher-v2',
      languages: ['en', 'de', 'ru'],
    });
  }

  const expectedToken = Deno.env.get('NARRATION_TTS_TOKEN');
  if (expectedToken && url.searchParams.get('token') !== expectedToken) {
    return json({ error: 'Narrator token is invalid', code: 'NARRATION_TOKEN_INVALID' }, 401);
  }
  if (!provider) return json({ error: 'Narrator is not configured', code: 'NARRATION_NOT_CONFIGURED' }, 503);

  const langRaw = (url.searchParams.get('lang') || 'en').toLowerCase();
  if (!['en', 'de', 'ru'].includes(langRaw)) {
    return json({ error: 'Unsupported narration language', code: 'UNSUPPORTED_LANGUAGE' }, 400);
  }
  const lang = langRaw as LanguageCode;
  const text = normalizeText(url.searchParams.get('text'));
  if (!text) return json({ error: 'text is required', code: 'TEXT_REQUIRED' }, 400);
  if (text.length > MAX_TEXT) return json({ error: 'Sentence is too long', code: 'TEXT_TOO_LONG' }, 413);

  const voice = voiceFor(provider, lang);
  const key = `${provider}|${voice}|${lang}|${text}`;

  const cached = cacheGet(key);
  if (cached) {
    return new Response(cached, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=604800, immutable',
        'X-Narrator-Cache': 'hit',
        'X-Narrator-Voice': voice,
        'X-Narrator-Provider': provider,
      },
    });
  }

  try {
    const audio = provider === 'elevenlabs'
      ? await synthesizeElevenLabs(Deno.env.get('ELEVENLABS_API_KEY') || '', lang, text, voice)
      : await synthesizeOpenAI(Deno.env.get('OPENAI_API_KEY') || '', lang, text, voice);

    if (!audio.byteLength) return json({ error: 'Empty narrator audio', code: 'TTS_EMPTY' }, 502);
    cacheSet(key, audio);

    return new Response(audio, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=604800, immutable',
        'X-Narrator-Cache': 'miss',
        'X-Narrator-Voice': voice,
        'X-Narrator-Provider': provider,
      },
    });
  } catch (error) {
    console.error('Narrator request failed', error);
    return json({ error: 'Narrator could not synthesize this sentence', code: 'TTS_FAILED' }, 502);
  }
});
