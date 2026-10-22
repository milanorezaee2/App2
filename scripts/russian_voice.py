#!/usr/bin/env python3
"""Neural Russian narrator: the one place that turns Russian text into speech.

The Russian pack is built by `generate-russian-audio.py` with the very same
engine and the very same warmth chain as the German narrator the learner already
approved (soft, kind, slightly slow), so the two courses do not sound like two
different apps:

    rumble filter -> a little low-mid weight -> a gentle de-esser
    -> slow levelling -> -20 dBFS RMS -> peak ceiling -> short fades

What is Russian-specific lives in the text layer, not in the DSP: the course
writes the stress mark as a combining acute (`Приве́т`), which the neural voice
must not see, so callers pass `spoken()` text to the model and keep the original
text as the clip key.
"""
import re
import unicodedata

from german_voice import (  # shared, already-verified DSP and pack constants
    BITRATE,
    LEAD_IN,
    SENTENCE_GAP,
    WORD_GAP,
    Narrator as _Narrator,
)

#: Characters the course uses to show stress. They are for the reader's eye only.
STRESS_MARKS = ('\u0301', '\u00b4', '\u02b9', '\u2032')

_CYRILLIC_OR_LATIN = re.compile(r'[0-9A-Za-z\u0400-\u04FF]')


def normalize_key(text: str) -> str:
    """The key a clip is stored under: no stress marks, lower case, one spacing."""
    cleaned = unicodedata.normalize('NFC', text)
    for mark in STRESS_MARKS:
        cleaned = cleaned.replace(mark, '')
    return ' '.join(cleaned.strip().lower().split())


def spoken(text: str) -> str:
    """The text handed to the neural model: the same sentence without the marks.

    Punctuation stays, because the model uses it for intonation; only the
    combining stress marks (which are not part of Russian orthography) go away.
    """
    cleaned = unicodedata.normalize('NFC', text)
    for mark in STRESS_MARKS:
        cleaned = cleaned.replace(mark, '')
    # A double space would make the model pause oddly; one space is enough.
    return re.sub(r'\s+', ' ', cleaned).strip()


def word_count(texts) -> int:
    """Words that will actually be spoken (punctuation-only tokens do not count)."""
    total = 0
    for text in texts:
        total += sum(1 for token in spoken(text).split() if _CYRILLIC_OR_LATIN.search(token))
    return total


class Narrator(_Narrator):
    """A loaded Piper Russian voice plus the shared warmth chain."""

    def render(self, text: str):
        return super().render(spoken(text))
