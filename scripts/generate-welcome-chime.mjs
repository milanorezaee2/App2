#!/usr/bin/env node
/**
 * Synthesizes the startup welcome chime (assets/audio/welcome-chime.wav).
 *
 * Design goals:
 *  - Warm, appealing bell arpeggio (C major add9) instead of a flat beep.
 *  - Stereo width: notes alternate left/right with a soft opposite-side echo.
 *  - Gentle pad underneath so the chime feels full on small phone speakers.
 *  - Clean headroom and a fade-out tail: no clicks, no abrupt cut, so the
 *    player can run to the end without audible interference.
 *
 * Run: node scripts/generate-welcome-chime.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 44100;
const DURATION = 2.2; // keep in sync with STARTUP_CHIME_MS in app/_layout.tsx
const N = Math.floor(RATE * DURATION);

const left = new Float64Array(N);
const right = new Float64Array(N);

/** Bell-style tone: inharmonic partials with exponential decay and a soft attack. */
function bell(freq, start, gain, pan, decay) {
  const offset = Math.floor(start * RATE);
  const partials = [
    { ratio: 1, amp: 1, decay: 1 },
    { ratio: 2.001, amp: 0.42, decay: 0.62 },
    { ratio: 2.98, amp: 0.22, decay: 0.44 },
    { ratio: 4.19, amp: 0.1, decay: 0.3 },
  ];
  const length = Math.min(N - offset, Math.floor(RATE * 1.9));
  const attack = Math.floor(RATE * 0.006);
  for (let i = 0; i < length; i++) {
    const t = i / RATE;
    let sample = 0;
    for (const p of partials) {
      const env = Math.exp((-t / (decay * p.decay)) * 3.2);
      sample += Math.sin(2 * Math.PI * freq * p.ratio * t) * p.amp * env;
    }
    // Slight detuned shimmer for a friendlier, less synthetic timbre.
    sample += Math.sin(2 * Math.PI * freq * 1.003 * t) * 0.18 * Math.exp((-t / decay) * 3.2);
    const env = sample * gain * Math.min(1, i / attack);
    const l = env * Math.cos((pan + 1) * Math.PI * 0.25);
    const r = env * Math.sin((pan + 1) * Math.PI * 0.25);
    left[offset + i] += l;
    right[offset + i] += r;
  }
}

/** Soft sustained pad chord (sine + quiet octave) with slow attack/release. */
function pad(freq, gain, pan) {
  const attack = 0.35;
  const holdUntil = 1.25;
  for (let i = 0; i < N; i++) {
    const t = i / RATE;
    let env;
    if (t < attack) env = t / attack;
    else if (t < holdUntil) env = 1;
    else env = Math.max(0, 1 - (t - holdUntil) / (DURATION - holdUntil));
    env = env * env * (3 - 2 * env); // smoothstep
    const sample = (Math.sin(2 * Math.PI * freq * t) + 0.35 * Math.sin(2 * Math.PI * freq * 2 * t)) * gain * env;
    const l = sample * Math.cos((pan + 1) * Math.PI * 0.25);
    const r = sample * Math.sin((pan + 1) * Math.PI * 0.25);
    left[i] += l;
    right[i] += r;
  }
}

// Sparkling ascending arpeggio: C5 E5 G5 C6, then a confirming G5 echo pair.
bell(523.25, 0.0, 0.30, -0.35, 0.85);
bell(659.25, 0.13, 0.28, 0.3, 0.8);
bell(783.99, 0.26, 0.26, -0.25, 0.75);
bell(1046.5, 0.42, 0.24, 0.35, 0.7);
bell(783.99, 0.66, 0.14, 0.15, 0.9);
bell(1046.5, 0.8, 0.12, -0.15, 0.9);
// Soft spatial echo of the first two notes on the opposite side.
bell(523.25, 0.36, 0.08, 0.5, 0.7);
bell(659.25, 0.49, 0.07, -0.5, 0.65);
// Warm bed: C4 + G4 + E4 + D5 shimmer.
pad(261.63, 0.10, -0.1);
pad(392.0, 0.08, 0.1);
pad(329.63, 0.07, 0);
pad(587.33, 0.03, 0.05);

// Master: soft saturation, peak normalize, tiny fade-in, graceful fade-out.
for (let i = 0; i < N; i++) {
  left[i] = Math.tanh(left[i] * 1.15);
  right[i] = Math.tanh(right[i] * 1.15);
}
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
const target = 0.82;
const scale = peak > 0 ? target / peak : 1;
const fadeIn = Math.floor(RATE * 0.012);
const fadeOut = Math.floor(RATE * 0.3);
for (let i = 0; i < N; i++) {
  let env = 1;
  if (i < fadeIn) env = i / fadeIn;
  if (i > N - fadeOut) env = Math.min(env, (N - i) / fadeOut);
  left[i] *= scale * env;
  right[i] *= scale * env;
}

// Encode 16-bit PCM stereo WAV.
const buffer = Buffer.alloc(44 + N * 4);
buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + N * 4, 4);
buffer.write('WAVE', 8);
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20);
buffer.writeUInt16LE(2, 22);
buffer.writeUInt32LE(RATE, 24);
buffer.writeUInt32LE(RATE * 4, 28);
buffer.writeUInt16LE(4, 32);
buffer.writeUInt16LE(16, 34);
buffer.write('data', 36);
buffer.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i])) * 32767), 44 + i * 4);
  buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i])) * 32767), 44 + i * 4 + 2);
}

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets/audio/welcome-chime.wav');
fs.writeFileSync(out, buffer);
console.log(`welcome-chime.wav written: ${DURATION}s stereo ${RATE}Hz (${buffer.length} bytes)`);
