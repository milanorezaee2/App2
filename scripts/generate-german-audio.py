#!/usr/bin/env python3
"""Generate the in-app German audio pack for the whole sentence course.

Why this exists
---------------
Reading German with `speechSynthesis` depends on a German voice being installed
on the device. Phones often have English (or the system language) only, so German
sentences end up read with a foreign accent, and Firefox for Android has no Web
Speech synthesis at all. The app therefore ships its own German voice: every
sentence and every vocabulary word is rendered once, stored as compact MP3 next to
the other static assets, and played by `lib/germanAudio.ts`. No network call, no
device voice, no third-party service at runtime.

Engine
------
eSpeak NG (German voice `de+f3`) through the `espeakng-loader` wheel, encoded with
LAME via `lameenc`. It is the only speech engine installable from the Python
package index that ships German data, which keeps the generation reproducible
without downloading a model from a third-party host.

Usage
-----
    python3 -m venv .venv-audio
    .venv-audio/bin/pip install espeakng-loader lameenc numpy
    node scripts/export-german-course.cjs            # writes text JSON
    .venv-audio/bin/python scripts/generate-german-audio.py

Output (committed, served as static assets):
    public/audio/de/<lesson>.mp3
    public/audio/de/<lesson>.words.mp3
    public/audio/de/manifest.json
"""
import ctypes
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import lameenc
import numpy as np
import espeakng_loader as loader

ROOT = Path(__file__).resolve().parent.parent
TEXT_JSON = ROOT / 'node_modules/.cache/german-course-text.json'
PRESET_JSON = ROOT / 'config' / 'german-narrator.json'
OUT_DIR = ROOT / 'public/audio/de'
MANIFEST = OUT_DIR / 'manifest.json'

# The narrator is chosen by the learner; `config/german-narrator.json` is the
# single source of truth shared by the app, these clips and the device path.
PRESET = json.loads(PRESET_JSON.read_text(encoding='utf-8'))
VOICE = PRESET['voice']
SPEED = int(PRESET['wordsPerMinute'])
PITCH = int(PRESET['pitch'])
PITCH_RANGE = int(PRESET['range'])
WORD_GAP_PARAM = int(PRESET.get('wordGap', 0))
# 48 kbps keeps the full 22.05 kHz band. At 24 kbps LAME silently resamples the
# stream down to 16 kHz (verified from the frame headers of the old pack), which
# made every sentence sound muffled and made the eSpeak voice harsh on a phone
# speaker. `assert_encoded_rate` below refuses to ship that again.
BITRATE = 48
LEAD_IN = 0.12
SENTENCE_GAP = 0.35
WORD_GAP = 0.22

# --- eSpeak NG through ctypes -------------------------------------------------
lib = ctypes.CDLL(loader.get_library_path())
DATA_PATH = loader.get_data_path()
AUDIO_OUTPUT_SYNCHRONOUS = 2
SAMPLE_RATE = lib.espeak_Initialize(AUDIO_OUTPUT_SYNCHRONOUS, 0, DATA_PATH.encode(), 0)
if SAMPLE_RATE <= 0:
    sys.exit('eSpeak NG failed to initialise')

if lib.espeak_SetVoiceByName(VOICE.encode()) != 0:
    sys.exit(f'eSpeak NG has no voice {VOICE}')

# eSpeak NG speak_lib.h: 1 = rate (words per minute), 3 = pitch,
# 4 = pitch range, 7 = word gap (5 is punctuation, not the gap).
lib.espeak_SetParameter(1, SPEED, 0)
lib.espeak_SetParameter(3, PITCH, 0)
lib.espeak_SetParameter(4, PITCH_RANGE, 0)
lib.espeak_SetParameter(7, WORD_GAP_PARAM, 0)

_CALLBACK = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.POINTER(ctypes.c_short), ctypes.c_int, ctypes.c_void_p)
_buffer = bytearray()


def _collect(wav, count, events):
    if count > 0:
        _buffer.extend(ctypes.string_at(wav, count * 2))
    return 0


_callback = _CALLBACK(_collect)
lib.espeak_SetSynthCallback(_callback)
lib.espeak_Synth.argtypes = [
    ctypes.c_char_p, ctypes.c_size_t, ctypes.c_uint, ctypes.c_int,
    ctypes.c_uint, ctypes.c_uint, ctypes.POINTER(ctypes.c_uint), ctypes.c_void_p,
]


def synthesize(text: str) -> np.ndarray:
    _buffer.clear()
    raw = text.encode('utf-8')
    lib.espeak_Synth(raw, len(raw), 0, 1, 0, 0, None, None)
    lib.espeak_Synchronize()
    if not _buffer:
        return np.zeros(0, dtype=np.float32)
    return np.frombuffer(bytes(_buffer), dtype=np.int16).astype(np.float32) / 32768.0


def silence(seconds: float) -> np.ndarray:
    return np.zeros(int(SAMPLE_RATE * seconds), dtype=np.float32)


def encode_mp3(samples: np.ndarray, path: Path) -> int:
    pcm = np.clip(samples, -1.0, 1.0)
    encoder = lameenc.Encoder()
    encoder.set_bit_rate(BITRATE)
    encoder.set_in_sample_rate(SAMPLE_RATE)
    encoder.set_channels(1)
    encoder.set_quality(4)
    payload = encoder.encode((pcm * 32767).astype(np.int16).tobytes()) + encoder.flush()
    path.write_bytes(payload)
    return len(payload)


MPEG_RATES = {3: (44100, 48000, 32000), 2: (22050, 24000, 16000), 0: (11025, 12000, 8000)}


def encoded_sample_rate(path: Path) -> int:
    """Sample rate from the first MP3 frame header, or 0 when none is found."""
    data = path.read_bytes()
    for i in range(len(data) - 4):
        if data[i] != 0xFF or (data[i + 1] & 0xE0) != 0xE0:
            continue
        version = (data[i + 1] >> 3) & 3
        layer = (data[i + 1] >> 1) & 3
        bitrate_index = (data[i + 2] >> 4) & 0xF
        rate_index = (data[i + 2] >> 2) & 3
        if version == 1 or layer != 1 or bitrate_index in (0, 15) or rate_index == 3:
            continue
        return MPEG_RATES[version][rate_index]
    return 0


def assert_encoded_rate(path: Path) -> None:
    rate = encoded_sample_rate(path)
    if rate != SAMPLE_RATE:
        sys.exit(f'{path.name}: encoder wrote {rate} Hz but eSpeak speaks at {SAMPLE_RATE} Hz; '
                 f'raise BITRATE instead of letting LAME downsample the voice')


def build_pack(texts: list[str], path: Path, gap: float) -> dict:
    """Concatenate the clips of `texts` and return {key: [start, end]} in seconds."""
    timeline = [silence(LEAD_IN)]
    clips: dict[str, list[float]] = {}
    cursor = LEAD_IN
    for text in texts:
        key = ' '.join(text.strip().lower().split())
        if key in clips:
            continue
        audio = synthesize(text)
        if audio.size == 0:
            continue
        duration = audio.size / SAMPLE_RATE
        clips[key] = [round(cursor, 3), round(cursor + duration, 3)]
        timeline.append(audio)
        timeline.append(silence(gap))
        cursor += duration + gap
    encode_mp3(np.concatenate(timeline), path)
    return clips


def main() -> None:
    if not TEXT_JSON.exists():
        sys.exit(f'missing {TEXT_JSON}; run: node scripts/export-german-course.cjs')
    lessons = json.loads(TEXT_JSON.read_text())
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    manifest = {
        'version': 1,
        'engine': f'eSpeak NG {VOICE} @ {SPEED} wpm',
        'voice': VOICE,
        'wordsPerMinute': SPEED,
        'pitch': PITCH,
        'range': PITCH_RANGE,
        'selection': PRESET.get('selection', ''),
        'sampleRate': SAMPLE_RATE,
        'bitrate': BITRATE,
        'leadInSeconds': LEAD_IN,
        'generatedAt': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'lessons': {},
    }

    started = time.time()
    total_bytes = 0
    for lesson in lessons:
        lesson_id = lesson['id']
        sentence_texts = [sentence['text'] for sentence in lesson['sentences']]
        word_texts: list[str] = []
        for sentence in lesson['sentences']:
            for word in sentence['words']:
                if word not in word_texts:
                    word_texts.append(word)

        sentence_file = f'{lesson_id}.mp3'
        word_file = f'{lesson_id}.words.mp3'
        sentences = build_pack(sentence_texts, OUT_DIR / sentence_file, SENTENCE_GAP)
        words = build_pack(word_texts, OUT_DIR / word_file, WORD_GAP)
        assert_encoded_rate(OUT_DIR / sentence_file)
        assert_encoded_rate(OUT_DIR / word_file)
        total_bytes += (OUT_DIR / sentence_file).stat().st_size + (OUT_DIR / word_file).stat().st_size
        manifest['lessons'][lesson_id] = {
            'sentences': {'file': sentence_file, 'clips': sentences},
            'words': {'file': word_file, 'clips': words},
        }
        print(f'{lesson_id}: {len(sentences)} sentences, {len(words)} words, {(OUT_DIR / sentence_file).stat().st_size // 1024} KB + {(OUT_DIR / word_file).stat().st_size // 1024} KB', flush=True)

    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, separators=(',', ':')))
    elapsed = time.time() - started
    print(f'\n{len(lessons)} lessons, {total_bytes / 1024 / 1024:.1f} MB of audio, manifest {MANIFEST.stat().st_size // 1024} KB, {elapsed:.1f}s')

    missing_sentences = 0
    missing_words = 0
    for lesson in lessons:
        entry = manifest['lessons'][lesson['id']]
        for sentence in lesson['sentences']:
            if ' '.join(sentence['text'].strip().lower().split()) not in entry['sentences']['clips']:
                missing_sentences += 1
        for sentence in lesson['sentences']:
            for word in sentence['words']:
                if ' '.join(word.strip().lower().split()) not in entry['words']['clips']:
                    missing_words += 1
    print(f'missing: {missing_sentences} sentences, {missing_words} words')
    if missing_sentences or missing_words:
        sys.exit(1)


if __name__ == '__main__':
    main()
