#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const input = process.env.NARRATION_INPUT || 'audio-manifest.json';
const outputDir = process.env.NARRATION_OUT || 'generated-audio';
const provider = (process.env.NARRATION_PROVIDER || 'elevenlabs').toLowerCase();
const concurrency = Math.max(1, Math.min(6, Number(process.env.NARRATION_CONCURRENCY || 3)));
const retries = 4;
const openAiKey = process.env.OPENAI_API_KEY;
const elevenKey = process.env.ELEVENLABS_API_KEY;
if (provider === 'openai' && !openAiKey) throw new Error('OPENAI_API_KEY is missing');
if (provider === 'elevenlabs' && !elevenKey) throw new Error('ELEVENLABS_API_KEY is missing');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function retry(task, label) {
  let error;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try { return await task(); } catch (caught) {
      error = caught;
      if (attempt === retries - 1) break;
      await sleep(Math.min(30_000, 800 * 2 ** attempt));
      console.warn(`${label}: retry ${attempt + 1}/${retries - 1}`);
    }
  }
  throw error;
}

async function openAiAudio(sentence) {
  const voice = process.env[`OPENAI_TTS_VOICE_${sentence.language.toUpperCase()}`] || 'coral';
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts', voice, input: sentence.text,
      response_format: 'mp3', speed: 1,
      instructions: `Read only this ${sentence.locale} language-learning sentence. Use clear natural connected speech, correct pronunciation, gentle warmth, and natural pauses. Never translate, explain, repeat, or add words.`,
    }),
  });
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return Buffer.from(await response.arrayBuffer());
}

async function elevenLabsAudio(sentence) {
  const voice = process.env[`ELEVENLABS_VOICE_${sentence.language.toUpperCase()}`];
  if (!voice) throw new Error(`ELEVENLABS_VOICE_${sentence.language.toUpperCase()} is missing`);
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': elevenKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text: sentence.text,
      model_id: process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2',
      voice_settings: { stability: 0.42, similarity_boost: 0.8, style: 0.28, use_speaker_boost: true },
      pronunciation_dictionary_locators: sentence.pronunciationDictionaryLocators || [],
    }),
  });
  if (!response.ok) throw new Error(`ElevenLabs ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return Buffer.from(await response.arrayBuffer());
}

async function generate(sentence) {
  const target = path.join(outputDir, sentence.language, `${sentence.id}.mp3`);
  await mkdir(path.dirname(target), { recursive: true });
  try { await readFile(target); return { ...sentence, status: 'generated', localFile: target }; } catch {}
  const audio = await retry(() => provider === 'elevenlabs' ? elevenLabsAudio(sentence) : openAiAudio(sentence), sentence.id);
  if (!audio.length) throw new Error(`${sentence.id}: provider returned empty audio`);
  await writeFile(target, audio);
  console.log(`generated ${sentence.id}`);
  return { ...sentence, status: 'generated', localFile: target };
}

const manifest = JSON.parse(await readFile(input, 'utf8'));
const pending = manifest.sentences.filter(sentence => sentence.status !== 'published');
const results = [];
let cursor = 0;
async function worker() {
  while (cursor < pending.length) {
    const index = cursor++;
    results[index] = await generate(pending[index]);
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, worker));
await writeFile(`${input}.generated.json`, JSON.stringify({ ...manifest, sentences: results }, null, 2) + '\n');
console.log(`Done: ${results.length} files in ${outputDir}`);
