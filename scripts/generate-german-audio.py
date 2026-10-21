#!/usr/bin/env python3
"""Render the German audio pack with the neural narrator.

Why the engine changed
----------------------
The earlier packs were synthesized with eSpeak NG, a formant synthesizer. It is
tiny and offline, but its German voices are buzzy, and no combination of pitch,
range or speed made them sound like a person: the learner reported the narrator
as "severely broken" and then "still not acceptable". The engine is therefore a
neural VITS voice (`piper`, ONNX Runtime), which produces real human-like speech
and runs fast enough to rebuild the whole course on a laptop or in CI
(~20x realtime on two cores).

The voice itself lives in `config/german-narrator.json`; this script reads it and
nothing else, so changing narrator is a one-file edit plus a rebuild.

What "clean and independent" means here
---------------------------------------
Every sentence and every word is synthesized on its own and surrounded by real
digital silence (0.30 s before, 0.55 s after). The manifest stores the exact
speech window, so the app starts playing 0.25 s before the speech and stops
0.15 s after it. A seek that lands late, an MP3 encoder delay, or a neighbour in
the same file can therefore never be heard: the worst case is a little more
silence, never a piece of another sentence. `assert_isolated` proves it for
every clip before the pack is written.

Post-processing (`warm`)
------------------------
The voice is soft but a raw VITS render is a little thin and sibilant on a phone
speaker. The chain is deliberately gentle: rumble filter, a touch of low-mid
weight, a de-esser for the German "s"/"sch", a slow 2:1 compressor so every
sentence sits at the same loudness, and a peak limiter. Nothing changes the words
or the pace.

Usage
-----
    python3 -m venv .venv-audio
    .venv-audio/bin/pip install piper-tts onnxruntime numpy scipy lameenc
    node scripts/fetch-german-voice-model.cjs
    node scripts/export-german-course.cjs
    .venv-audio/bin/python scripts/generate-german-audio.py
"""
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import lameenc
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from german_voice import (  # noqa: E402  (path set up above)
    BITRATE,
    LEAD_IN,
    SENTENCE_GAP,
    WORD_GAP,
    Narrator,
)

ROOT = Path(__file__).resolve().parent.parent
TEXT_JSON = ROOT / 'node_modules/.cache/german-course-text.json'
PRESET_JSON = ROOT / 'config' / 'german-narrator.json'
OUT_DIR = ROOT / 'public/audio/de'
MANIFEST = OUT_DIR / 'manifest.json'

PRESET = json.loads(PRESET_JSON.read_text(encoding='utf-8'))
MODEL = ROOT / PRESET['model']
MODEL_CONFIG = ROOT / PRESET['modelConfig']


# ---------------------------------------------------------------------------
# synthesis (the voice and its warmth chain live in scripts/german_voice.py)
# ---------------------------------------------------------------------------
if not MODEL.exists():
    sys.exit(f'missing {MODEL.relative_to(ROOT)}; run: node scripts/fetch-german-voice-model.cjs')

NARRATOR = Narrator(
    MODEL,
    MODEL_CONFIG,
    speaker_id=PRESET.get('speakerId'),
    length_scale=PRESET.get('lengthScale', 1.0),
    noise_scale=PRESET.get('noiseScale', 0.667),
    noise_w=PRESET.get('noiseW', 0.8),
)
SR = NARRATOR.sample_rate
print(f'voice {PRESET["voice"]} @ {SR} Hz, length_scale {NARRATOR.config.length_scale}', flush=True)


def synthesize(text: str) -> np.ndarray:
    return NARRATOR.render(text)


def silence(seconds: float) -> np.ndarray:
    return np.zeros(int(SR * seconds), dtype=np.float32)


def encode_mp3(samples: np.ndarray, path: Path) -> int:
    pcm = np.clip(samples, -1.0, 1.0)
    encoder = lameenc.Encoder()
    encoder.set_bit_rate(BITRATE)
    encoder.set_in_sample_rate(SR)
    encoder.set_channels(1)
    encoder.set_quality(4)
    payload = encoder.encode((pcm * 32767).astype(np.int16).tobytes()) + encoder.flush()
    path.write_bytes(payload)
    return len(payload)


def build_pack(texts, path: Path, gap: float, label: str):
    """Concatenate clips with real silence around each one.

    Returns `{key: [start, end]}` where start/end are the speech window only, so
    the app can start 0.25 s early and still stay inside silence.
    """
    timeline = [silence(LEAD_IN)]
    clips = {}
    cursor = LEAD_IN
    for text in texts:
        key = ' '.join(text.strip().lower().split())
        if key in clips:
            continue
        audio = synthesize(text)
        if audio.size == 0:
            continue
        duration = audio.size / SR
        clips[key] = [round(cursor, 3), round(cursor + duration, 3)]
        timeline.append(audio)
        timeline.append(silence(gap))
        cursor += duration + gap
    samples = np.concatenate(timeline)
    assert_isolated(samples, clips, gap, label)
    encode_mp3(samples, path)
    return clips


def assert_isolated(samples: np.ndarray, clips, gap: float, label: str) -> None:
    """Every clip must be surrounded by silence, so nothing can bleed into it.

    The app starts 0.25 s before the recorded speech and stops 0.15 s after it;
    both windows have to be silent, and the gap to the next clip has to leave
    room for a late seek.
    """
    if gap < 0.40:
        sys.exit(f'{label}: the gap between clips is {gap:.2f}s, below the 0.40s the player needs')
    for key, (start, end) in clips.items():
        pre = samples[int((start - 0.25) * SR):int((start - 0.01) * SR)]
        post = samples[int((end + 0.01) * SR):int((end + 0.25) * SR)]
        if pre.size and float(np.max(np.abs(pre))) > 1e-6:
            sys.exit(f'{label}: sound {0.25}s before {key!r}; it would bleed into the neighbouring clip')
        if post.size and float(np.max(np.abs(post))) > 1e-6:
            sys.exit(f'{label}: sound {0.25}s after {key!r}; it would bleed into the neighbouring clip')


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------
def refresh_metadata(lessons, manifest) -> None:
    """Rewrite only the header of an existing manifest (same audio, new labels).

    The clips stay byte-identical; the tempo and the engine description are
    recomputed from the course text so the numbers cannot drift from the files.
    """
    total_speech = 0.0
    sentence_speech = 0.0
    total_clips = 0
    total_words = 0
    sentence_words = 0
    for lesson in lessons:
        entry = manifest['lessons'][lesson['id']]
        for text in (sentence['text'] for sentence in lesson['sentences']):
            total_words += len(text.split())
            sentence_words += len(text.split())
        for pack in (entry['sentences']['clips'], entry['words']['clips']):
            total_speech += sum(end - start for start, end in pack.values())
            total_clips += len(pack)
        sentence_speech += sum(end - start for start, end in entry['sentences']['clips'].values())
        # Each entry of the words pack is one vocabulary item (sometimes a short
        # phrase), and it is spoken on its own, so it counts once.
        total_words += sum(len(key.split()) for key in entry['words']['clips'])
    manifest.update({
        'version': 2,
        'engine': f'Piper neural {PRESET["voice"]} @ {PRESET["wordsPerMinute"]} wpm',
        'voice': PRESET['voice'],
        'wordsPerMinute': PRESET['wordsPerMinute'],
        'lengthScale': NARRATOR.config.length_scale,
        'selection': PRESET.get('selection', ''),
        'sampleRate': SR,
        'bitrate': BITRATE,
        'leadInSeconds': LEAD_IN,
        'sentenceGapSeconds': SENTENCE_GAP,
        'wordGapSeconds': WORD_GAP,
        'measuredWordsPerMinute': round(sentence_words / (sentence_speech / 60)) if sentence_speech else 0,
        'measuredWordsPerMinuteAllPacks': round(total_words / (total_speech / 60)) if total_speech else 0,
        'totalWords': total_words,
        'totalSpeechSeconds': round(total_speech, 1),
        'totalClips': total_clips,
        'averageClipSeconds': round(total_speech / max(total_clips, 1), 2),
    })
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, separators=(',', ':')))
    print(f'refreshed manifest: {manifest["engine"]}, measured {manifest["measuredWordsPerMinute"]} wpm, '
          f'{total_clips} clips, {total_speech:.0f}s')


def main() -> None:
    if not TEXT_JSON.exists():
        sys.exit(f'missing {TEXT_JSON}; run: node scripts/export-german-course.cjs')
    lessons = json.loads(TEXT_JSON.read_text())
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    if '--refresh-metadata' in sys.argv and MANIFEST.exists():
        refresh_metadata(lessons, json.loads(MANIFEST.read_text()))
        return

    manifest = {
        'version': 2,
        'engine': f'Piper neural {PRESET["voice"]} @ {PRESET["wordsPerMinute"]} wpm',
        'voice': PRESET['voice'],
        'wordsPerMinute': PRESET['wordsPerMinute'],
        'lengthScale': SYN.length_scale,
        'selection': PRESET.get('selection', ''),
        'sampleRate': SR,
        'bitrate': BITRATE,
        'leadInSeconds': LEAD_IN,
        'sentenceGapSeconds': SENTENCE_GAP,
        'wordGapSeconds': WORD_GAP,
        'generatedAt': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'lessons': {},
    }

    started = time.time()
    total_bytes = 0
    total_speech = 0.0
    sentence_speech = 0.0
    sentence_words = 0
    total_clips = 0
    total_words = 0
    for lesson in lessons:
        lesson_id = lesson['id']
        sentence_texts = [sentence['text'] for sentence in lesson['sentences']]
        word_texts = []
        for sentence in lesson['sentences']:
            for word in sentence['words']:
                if word not in word_texts:
                    word_texts.append(word)

        sentence_file = f'{lesson_id}.mp3'
        word_file = f'{lesson_id}.words.mp3'
        sentences = build_pack(sentence_texts, OUT_DIR / sentence_file, SENTENCE_GAP, lesson_id)
        words = build_pack(word_texts, OUT_DIR / word_file, WORD_GAP, f'{lesson_id}.words')
        total_bytes += (OUT_DIR / sentence_file).stat().st_size + (OUT_DIR / word_file).stat().st_size
        for text in sentence_texts:
            total_words += len(text.split())
            sentence_words += len(text.split())
        total_words += sum(len(' '.join(word.strip().lower().split()).split()) for word in word_texts)
        for pack in (sentences, words):
            total_speech += sum(end - start for start, end in pack.values())
            total_clips += len(pack)
        sentence_speech += sum(end - start for start, end in sentences.values())
        manifest['lessons'][lesson_id] = {
            'sentences': {'file': sentence_file, 'clips': sentences},
            'words': {'file': word_file, 'clips': words},
        }
        print(f'{lesson_id}: {len(sentences)} sentences, {len(words)} words, '
              f'{(OUT_DIR / sentence_file).stat().st_size // 1024} KB + '
              f'{(OUT_DIR / word_file).stat().st_size // 1024} KB', flush=True)

    manifest['measuredWordsPerMinute'] = round(sentence_words / (sentence_speech / 60)) if sentence_speech else 0
    manifest['measuredWordsPerMinuteAllPacks'] = round(total_words / (total_speech / 60)) if total_speech else 0
    manifest['totalWords'] = total_words
    manifest['totalSpeechSeconds'] = round(total_speech, 1)
    manifest['totalClips'] = total_clips
    manifest['averageClipSeconds'] = round(total_speech / max(total_clips, 1), 2)
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, separators=(',', ':')))
    elapsed = time.time() - started
    print(f'measured tempo: {manifest["measuredWordsPerMinute"]} wpm over {total_words} words')
    print(f'\n{len(lessons)} lessons, {total_bytes / 1024 / 1024:.1f} MB of audio, '
          f'{total_clips} clips, {total_speech:.0f}s of speech '
          f'(mean {manifest["averageClipSeconds"]}s), manifest {MANIFEST.stat().st_size // 1024} KB, '
          f'{elapsed:.1f}s')

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
