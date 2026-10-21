#!/usr/bin/env python3
"""Neural German voice: the one place that turns text into warm speech.

Both the pack generator (`generate-german-audio.py`) and the sample renderer
(`preview-german-speed.py`) import this module, so the voice the learner auditions
is bit-for-bit the voice that ships. The chain is described in the generator's
docstring: rumble filter, a little low-mid weight, a de-esser, slow levelling and
a peak ceiling — gentle on purpose, because the goal is a soft, warm, kind
narrator, not a radio advert.
"""
from pathlib import Path

import numpy as np
from scipy.signal import lfilter
from piper import PiperVoice, SynthesisConfig

ROOT = Path(__file__).resolve().parent.parent

LEAD_IN = 0.30
SENTENCE_GAP = 0.55
WORD_GAP = 0.45
FADE_SECONDS = 0.006
BITRATE = 40
EDGE_DBFS = -46.0
TARGET_RMS_DBFS = -20.0
PEAK_CEILING = 0.89


# ---------------------------------------------------------------------------
# filters
# ---------------------------------------------------------------------------
def biquad(kind, freq, sample_rate, gain_db=0.0, q=0.707):
    """RBJ cookbook biquad coefficients; returns (b, a) for `lfilter`."""
    a0w = 2 * np.pi * freq / sample_rate
    cos, sin = np.cos(a0w), np.sin(a0w)
    alpha = sin / (2 * q)
    A = 10 ** (gain_db / 40)
    if kind == 'highpass':
        b = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2]
        a = [1 + alpha, -2 * cos, 1 - alpha]
    elif kind == 'lowshelf':
        sq = 2 * np.sqrt(A) * alpha
        b = [A * ((A + 1) - (A - 1) * cos + sq),
             2 * A * ((A - 1) - (A + 1) * cos),
             A * ((A + 1) - (A - 1) * cos - sq)]
        a = [(A + 1) + (A - 1) * cos + sq,
             -2 * ((A - 1) + (A + 1) * cos),
             (A + 1) + (A - 1) * cos - sq]
    elif kind == 'highshelf':
        sq = 2 * np.sqrt(A) * alpha
        b = [A * ((A + 1) + (A - 1) * cos + sq),
             -2 * A * ((A - 1) + (A + 1) * cos),
             A * ((A + 1) + (A - 1) * cos - sq)]
        a = [(A + 1) - (A - 1) * cos + sq,
             2 * ((A - 1) - (A + 1) * cos),
             (A + 1) - (A - 1) * cos - sq]
    else:  # peaking
        b = [1 + alpha * A, -2 * cos, 1 - alpha * A]
        a = [1 + alpha / A, -2 * cos, 1 - alpha / A]
    b = np.array(b, dtype=np.float64) / a[0]
    a = np.array(a, dtype=np.float64) / a[0]
    return b, a


# The biquads are designed for the sample rate of the clip being processed.
SR = 16000


def apply_biquad(x, kind, freq, gain_db=0.0, q=0.707):
    if gain_db == 0.0 and kind != 'highpass':
        return x
    b, a = biquad(kind, freq, SR, gain_db, q)
    return lfilter(b, a, x).astype(np.float32)


def deess(x, sample_rate, threshold=0.05, max_reduction=0.55):
    """Pull down the 5-8 kHz band only while it is loud (German s / sch / z)."""
    b, a = biquad('highpass', 5200, sample_rate)
    high = lfilter(b, a, x).astype(np.float32)
    b2, a2 = biquad('highpass', 5200, sample_rate, q=0.5)  # unused, keeps API symmetric
    b3, a3 = biquad('highpass', 5200, sample_rate)
    envelope = np.abs(high)
    # 3 ms attack / 90 ms release, computed with a running maximum-ish follower.
    attack = np.exp(-1 / (0.003 * sample_rate))
    release = np.exp(-1 / (0.09 * sample_rate))
    env = np.empty_like(envelope)
    acc = 0.0
    for i, value in enumerate(envelope):
        coef = attack if value > acc else release
        acc = coef * acc + (1 - coef) * value
        env[i] = acc
    gain = np.clip(threshold / np.maximum(env, 1e-6), 1.0 - max_reduction, 1.0)
    return (x - high + high * gain).astype(np.float32)


def compress(x, sample_rate, threshold_db=-18.0, ratio=2.0, attack_ms=8.0, release_ms=140.0):
    """Slow, gentle levelling: the narrator stays calm instead of pumping."""
    threshold = 10 ** (threshold_db / 20)
    attack = np.exp(-1 / (attack_ms / 1000 * sample_rate))
    release = np.exp(-1 / (release_ms / 1000 * sample_rate))
    env = np.empty_like(x)
    acc = 0.0
    for i, value in enumerate(np.abs(x)):
        coef = attack if value > acc else release
        acc = coef * acc + (1 - coef) * value
        env[i] = acc
    over = env > threshold
    gain = np.ones_like(x)
    gain[over] = (threshold + (env[over] - threshold) / ratio) / env[over]
    return (x * gain).astype(np.float32)


def trim(x, sample_rate):
    """Cut the silence the model leaves around a sentence, keeping 20 ms margin."""
    window = max(1, int(0.01 * sample_rate))
    frames = len(x) // window
    if frames == 0:
        return x
    rms = np.sqrt((x[:frames * window].reshape(frames, window) ** 2).mean(axis=1))
    audible = np.where(rms > 10 ** (EDGE_DBFS / 20))[0]
    if not len(audible):
        return x
    margin = int(0.02 * sample_rate)
    start = max(0, audible[0] * window - margin)
    end = min(len(x), (audible[-1] + 1) * window + margin)
    return x[start:end]


def fade(x, sample_rate):
    n = min(int(FADE_SECONDS * sample_rate), len(x) // 2)
    if n <= 0:
        return x
    ramp = np.linspace(0.0, 1.0, n, dtype=np.float32)
    x = x.copy()
    x[:n] *= ramp
    x[-n:] *= ramp[::-1]
    return x


def warm(x, sample_rate):
    """The "soft, warm, kind" pass. Static, deterministic, word-for-word intact."""
    global SR
    SR = sample_rate
    y = apply_biquad(x, 'highpass', 70)
    y = apply_biquad(y, 'lowshelf', 240, gain_db=2.0, q=0.8)     # weight and warmth
    y = apply_biquad(y, 'peaking', 3000, gain_db=-1.5, q=0.9)    # take the edge off
    y = deess(y, sample_rate)
    y = compress(y, sample_rate)
    # loudness: every clip lands on the same RMS, then a hard ceiling
    voiced = y[np.abs(y) > 1e-4]
    rms = float(np.sqrt((voiced ** 2).mean())) if voiced.size else 0.0
    if rms > 0:
        y = y * (10 ** (TARGET_RMS_DBFS / 20) / rms)
    peak = float(np.max(np.abs(y))) if y.size else 0.0
    if peak > PEAK_CEILING:
        y = y * (PEAK_CEILING / peak)
    return fade(y.astype(np.float32), sample_rate)




class Narrator:
    """A loaded Piper voice plus the warmth chain."""

    def __init__(self, model_path, config_path, speaker_id=None, length_scale=1.0,
                 noise_scale=0.667, noise_w=0.8):
        self.voice = PiperVoice.load(str(model_path), config_path=str(config_path))
        self.sample_rate = self.voice.config.sample_rate
        self.config = SynthesisConfig(
            speaker_id=speaker_id,
            length_scale=float(length_scale),
            noise_scale=float(noise_scale),
            noise_w_scale=float(noise_w),
        )

    def render(self, text: str) -> np.ndarray:
        """One sentence or word, trimmed to its speech window and warmed."""
        chunks = list(self.voice.synthesize(text, syn_config=self.config))
        if not chunks:
            return np.zeros(0, dtype=np.float32)
        audio = np.concatenate([chunk.audio_float_array for chunk in chunks]).astype(np.float32)
        if audio.ndim > 1:
            audio = audio.mean(axis=1)
        return warm(trim(audio, self.sample_rate), self.sample_rate)
