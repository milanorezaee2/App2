#!/usr/bin/env python3
"""Render short German voice/style samples so a speaker can be chosen by ear.

The course voice is eSpeak NG, which exposes twelve German voices (five female
`+f1..f5` and seven male `+m1..m7`) plus four prosody parameters. This script
renders the same two course sentences with every candidate so the learner can
compare them, without touching the shipped audio pack.

    /tmp/v2/bin/python scripts/preview-german-voices.py
"""
from __future__ import annotations

import ctypes
import io
import json
import wave
from pathlib import Path

import lameenc
import numpy as np
from espeakng_loader import get_data_path, get_library_path

SAMPLE_RATE = 22050
BITRATE = 24
OUT = Path(__file__).resolve().parent.parent / 'docs' / 'voice-samples'
LEAD_IN = 0.12
END = 0.30

SENTENCE_GAP = 0.26
COMMA_GAP = 0.12

LIB = ctypes.CDLL(str(get_library_path()))
LIB.espeak_Initialize.restype = ctypes.c_int
LIB.espeak_Initialize(2, 0, str(get_data_path()).encode(), 0)  # AUDIO_OUTPUT_SYNCHRONOUS
LIB.espeak_SetVoiceByName.argtypes = [ctypes.c_char_p]
LIB.espeak_SetVoiceByName.restype = ctypes.c_int
LIB.espeak_SetParameter.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_int]
LIB.espeak_SetParameter.restype = ctypes.c_int
LIB.espeak_Synth.argtypes = [ctypes.c_char_p, ctypes.c_size_t, ctypes.c_uint, ctypes.c_int,
                             ctypes.c_uint, ctypes.c_uint, ctypes.c_void_p, ctypes.c_void_p]
LIB.espeak_Synthesize = getattr(LIB, 'espeak_Synthesize', None)

RATE, VOLUME, PITCH, RANGE = 1, 2, 3, 4

_buffer: list[bytes] = []

CALLBACK = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.POINTER(ctypes.c_short), ctypes.c_int, ctypes.c_void_p)


def _callback(wav: ctypes.POINTER(ctypes.c_short), count: int, events) -> int:  # noqa: ARG001
    if wav and count > 0:
        _buffer.append(ctypes.string_at(wav, count * ctypes.sizeof(ctypes.c_short)))
    return 0


_cb_ref = CALLBACK(_callback)
LIB.espeak_SetSynthCallback(_cb_ref)


def synthesize(text: str, voice: str, rate: int, pitch: int, rng: int) -> np.ndarray:
    LIB.espeak_SetVoiceByName(voice.encode())
    LIB.espeak_SetParameter(RATE, rate, 0)
    LIB.espeak_SetParameter(PITCH, pitch, 0)
    LIB.espeak_SetParameter(RANGE, rng, 0)
    LIB.espeak_SetParameter(VOLUME, 100, 0)
    _buffer.clear()
    raw = text.encode('utf-8')
    LIB.espeak_Synth(raw, len(raw) + 1, 0, 1, 0, 0, None, None)
    LIB.espeak_Synchronize()
    if not _buffer:
        return np.zeros(0, dtype=np.float32)
    return np.frombuffer(b''.join(_buffer), dtype=np.int16).astype(np.float32) / 32768.0


def silence(seconds: float) -> np.ndarray:
    return np.zeros(int(SAMPLE_RATE * seconds), dtype=np.float32)


def speak_text(text: str, voice: str, style: dict) -> np.ndarray:
    """Read `text`, pausing naturally at sentence ends and commas."""
    timeline: list[np.ndarray] = []
    for phrase in split_phrases(text):
        clip = synthesize(phrase['text'], voice, style['rate'], style['pitch'], style['range'])
        if clip.size == 0:
            continue
        timeline.append(clip)
        timeline.append(silence(COMMA_GAP if phrase['comma'] else SENTENCE_GAP))
    return np.concatenate(timeline) if timeline else np.zeros(0, dtype=np.float32)


def split_phrases(text: str) -> list[dict]:
    """Break a sentence at , ; : and at sentence ends so the pauses are real."""
    out: list[dict] = []
    current = ''
    for char in text:
        current += char
        if char in ',;:':
            out.append({'text': current.strip(), 'comma': True})
            current = ''
        elif char in '.!?':
            out.append({'text': current.strip(), 'comma': False})
            current = ''
    if current.strip():
        out.append({'text': current.strip(), 'comma': False})
    return out


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


SPEAKERS = [
    {'id': 'f3', 'voice': 'de+f3', 'fa': 'زن، گرم و متعادل', 'en': 'female, warm', 'note': 'گویندهٔ فعلی درس‌ها'},
    {'id': 'f1', 'voice': 'de+f1', 'fa': 'زن، روشن‌تر و جوان‌تر', 'en': 'female, brighter', 'note': ''},
    {'id': 'f2', 'voice': 'de+f2', 'fa': 'زن، نرم و کمی بم', 'en': 'female, soft', 'note': ''},
    {'id': 'm3', 'voice': 'de+m3', 'fa': 'مرد، معمولی', 'en': 'male, mid', 'note': ''},
    {'id': 'm6', 'voice': 'de+m6', 'fa': 'مرد، بم و آرام', 'en': 'male, deep', 'note': ''},
    {'id': 'm7', 'voice': 'de+m7', 'fa': 'مرد، سبک و پرانرژی', 'en': 'male, light', 'note': ''},
]

STYLES = [
    {'id': 'natural', 'fa': 'طبیعی و روان', 'en': 'natural', 'rate': 150, 'pitch': 50, 'range': 50,
     'note': 'سرعت گفتار روزمره'},
    {'id': 'clear', 'fa': 'شمرده و آموزشی', 'en': 'clear', 'rate': 128, 'pitch': 47, 'range': 44,
     'note': 'آهسته‌تر، مناسب یادگیری'},
    {'id': 'lively', 'fa': 'پرانرژی و سرزنده', 'en': 'lively', 'rate': 166, 'pitch': 58, 'range': 62,
     'note': 'شادتر و کمی تندتر'},
]

TEXTS = [
    'Hallo! Wie geht es dir?',
    'Mir geht es gut, danke. Und dir?',
]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {'speakers': SPEAKERS, 'styles': STYLES, 'texts': TEXTS, 'clips': []}
    for speaker in SPEAKERS:
        for style in STYLES:
            parts: list[np.ndarray] = [silence(LEAD_IN)]
            for text in TEXTS:
                parts.append(speak_text(text, speaker['voice'], style))
            parts.append(silence(END))
            audio = np.concatenate(parts)
            name = f"{speaker['id']}-{style['id']}.mp3"
            size = encode_mp3(audio, OUT / name)
            manifest['clips'].append({
                'file': name, 'speaker': speaker['id'], 'style': style['id'],
                'seconds': round(audio.size / SAMPLE_RATE, 2), 'bytes': size,
            })
            print(f"  {name:18s} {audio.size / SAMPLE_RATE:5.2f}s {size / 1024:6.1f} KB")
    (OUT / 'samples.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=1))
    print(f'\n{len(manifest["clips"])} samples in {OUT}')


if __name__ == '__main__':
    main()
