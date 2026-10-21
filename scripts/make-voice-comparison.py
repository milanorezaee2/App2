#!/usr/bin/env python3
"""Render three German speakers side by side for the learner to choose from.

A: the voice that ships in the app today (de+f3).
B: a brighter, younger female voice (de+f1).
C: a calm male voice (de+m3).

Every candidate reads exactly the same four course sentences with the same tempo
and pitch, so the only thing that changes between the clips is the speaker.
Output: docs/voice-samples/compare/<id>.mp3 + index.html
"""
from __future__ import annotations

import ctypes
import json
from pathlib import Path

import lameenc
import numpy as np
from espeakng_loader import get_data_path, get_library_path

SAMPLE_RATE = 22050
BITRATE = 24
SPEED = 140          # the shipped lesson speed
PITCH = 52           # the shipped lesson pitch
LEAD_IN = 0.12
BETWEEN = 0.30
END = 0.35

OUT = Path(__file__).resolve().parent.parent / 'docs' / 'voice-samples' / 'compare'

LIB = ctypes.CDLL(str(get_library_path()))
LIB.espeak_Initialize.restype = ctypes.c_int
LIB.espeak_Initialize(2, 0, str(get_data_path()).encode(), 0)
LIB.espeak_SetVoiceByName.argtypes = [ctypes.c_char_p]
LIB.espeak_SetVoiceByName.restype = ctypes.c_int
LIB.espeak_SetParameter.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_int]
LIB.espeak_Synth.argtypes = [ctypes.c_char_p, ctypes.c_size_t, ctypes.c_uint, ctypes.c_int,
                             ctypes.c_uint, ctypes.c_uint, ctypes.c_void_p, ctypes.c_void_p]

RATE, VOLUME, PITCH_PARAM = 1, 2, 3
_buffer: list[bytes] = []
CALLBACK = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.POINTER(ctypes.c_short), ctypes.c_int, ctypes.c_void_p)


def _callback(wav, count, events):  # noqa: ARG001
    if wav and count > 0:
        _buffer.append(ctypes.string_at(wav, count * ctypes.sizeof(ctypes.c_short)))
    return 0


# The callback must stay referenced: a temporary one is freed by Python
# and espeak then calls into released memory (silent crash after one render).
_callback_ref = CALLBACK(_callback)
LIB.espeak_SetSynthCallback(_callback_ref)


def say(text: str, voice: str) -> np.ndarray:
    LIB.espeak_SetVoiceByName(voice.encode())
    LIB.espeak_SetParameter(RATE, SPEED, 0)
    LIB.espeak_SetParameter(PITCH_PARAM, PITCH, 0)
    LIB.espeak_SetParameter(VOLUME, 100, 0)
    _buffer.clear()
    raw = text.encode('utf-8')
    LIB.espeak_Synth(raw, len(raw) + 1, 0, 1, 0, 0, None, None)
    LIB.espeak_Synchronize()
    if not _buffer:
        return np.zeros(0, dtype=np.float32)
    return np.frombuffer(b''.join(_buffer), dtype=np.int16).astype(np.float32) / 32768.0


def pause(seconds: float) -> np.ndarray:
    return np.zeros(int(SAMPLE_RATE * seconds), dtype=np.float32)


CANDIDATES = [
    {'id': 'a', 'voice': 'de+f3', 'fa': 'گویندهٔ فعلی برنامه', 'detail': 'زن، گرم و متعادل'},
    {'id': 'b', 'voice': 'de+f1', 'fa': 'گزینهٔ دوم', 'detail': 'زن، روشن‌تر و جوان‌تر'},
    {'id': 'c', 'voice': 'de+m3', 'fa': 'گزینهٔ سوم', 'detail': 'مرد، آرام و شمرده'},
]

LINES = [
    'Hallo! Wie geht es dir?',
    'Mir geht es gut, danke. Und dir?',
    'Guten Morgen! Ich möchte einen Kaffee, bitte.',
    'Bis bald! Schönen Tag noch.',
]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {'speed': SPEED, 'pitch': PITCH, 'lines': LINES, 'clips': []}
    for candidate in CANDIDATES:
        parts = [pause(LEAD_IN)]
        for index, line in enumerate(LINES):
            parts.append(say(line, candidate['voice']))
            parts.append(pause(END if index == len(LINES) - 1 else BETWEEN))
        audio = np.concatenate(parts)
        pcm = np.clip(audio, -1.0, 1.0)
        encoder = lameenc.Encoder()
        encoder.set_bit_rate(BITRATE)
        encoder.set_in_sample_rate(SAMPLE_RATE)
        encoder.set_channels(1)
        encoder.set_quality(4)
        payload = encoder.encode((pcm * 32767).astype(np.int16).tobytes()) + encoder.flush()
        name = f"{candidate['id']}.mp3"
        (OUT / name).write_bytes(payload)
        seconds = round(audio.size / SAMPLE_RATE, 2)
        manifest['clips'].append({**candidate, 'file': name, 'seconds': seconds, 'bytes': len(payload)})
        print(f"  {candidate['id']}  {candidate['voice']:7s} {seconds:5.2f}s  {len(payload) / 1024:6.1f} KB")
    (OUT / 'compare.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=1))
    print(f'\n{len(manifest["clips"])} candidates in {OUT}')


if __name__ == '__main__':
    main()
