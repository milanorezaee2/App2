#!/usr/bin/env python3
"""Render the Russian audio pack with the neural narrator.

The Russian course used to be spoken by whatever Russian voice the phone had,
which on many phones is missing, robotic, or male. This script renders every
Russian sentence and every vocabulary word once, with the female narrator chosen
for the course (`config/russian-narrator.json`), so the lessons sound the same on
every device and need neither a system voice nor a network.

Layout (identical in spirit to the German pack):

    public/audio/ru/voices.json
    public/audio/ru/<narrator>/manifest.json
    public/audio/ru/<narrator>/<lesson-id>.mp3          # every sentence
    public/audio/ru/<narrator>/<lesson-id>.words.mp3    # every vocabulary word
    public/audio/ru/<narrator>/<lesson-id>.json         # per-lesson metadata (optional)

Every clip is synthesized separately and placed between real silence: 0.30 s
before the speech and 0.55 s after a sentence (0.45 s after a word). The
manifest stores the exact speech window, so the app starts playing 0.25 s before
the speech and stops 0.15 s after it. A seek that lands late, an MP3 encoder
delay, or a neighbour in the same file can therefore never be heard:
`assert_isolated` proves it for every clip before a pack is written.

Usage
-----
    python3 -m venv .venv-audio
    .venv-audio/bin/pip install piper-tts onnxruntime numpy scipy lameenc
    node scripts/fetch-russian-voice-model.cjs
    node scripts/export-russian-course.cjs
    .venv-audio/bin/python scripts/generate-russian-audio.py
    .venv-audio/bin/python scripts/generate-russian-audio.py --refresh-labels
"""
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import lameenc
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from russian_voice import (  # noqa: E402
    BITRATE,
    LEAD_IN,
    SENTENCE_GAP,
    WORD_GAP,
    Narrator,
    normalize_key,
    word_count,
)

ROOT = Path(__file__).resolve().parent.parent
TEXT_JSON = ROOT / 'node_modules/.cache/russian-course-text.json'
OUT_DIR = ROOT / 'public/audio/ru'
VOICES_JSON = OUT_DIR / 'voices.json'
PRESET_JSON = ROOT / 'config/russian-narrator.json'

PRESET = json.loads(PRESET_JSON.read_text())
NARRATORS = PRESET['narrators']

ACTIVE = None  # type: Narrator | None


def narrator_dir(narrator: dict) -> Path:
    return OUT_DIR / narrator['id']


def silence(seconds: float) -> np.ndarray:
    return np.zeros(int(ACTIVE.sample_rate * seconds), dtype=np.float32)


def encode_mp3(samples: np.ndarray, path: Path) -> int:
    pcm = np.clip(samples, -1.0, 1.0)
    encoder = lameenc.Encoder()
    encoder.set_bit_rate(BITRATE)
    encoder.set_in_sample_rate(ACTIVE.sample_rate)
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
        key = normalize_key(text)
        if key in clips:
            continue
        audio = ACTIVE.render(text)
        if audio.size == 0:
            continue
        duration = audio.size / ACTIVE.sample_rate
        clips[key] = [round(cursor, 3), round(cursor + duration, 3)]
        timeline.append(audio)
        timeline.append(silence(gap))
        cursor += duration + gap
    samples = np.concatenate(timeline)
    assert_isolated(samples, clips, gap, label)
    encode_mp3(samples, path)
    return clips


def assert_isolated(samples: np.ndarray, clips, gap: float, label: str) -> None:
    """Every clip must be surrounded by silence, so nothing can bleed into it."""
    if gap < 0.40:
        sys.exit(f'{label}: the gap between clips is {gap:.2f}s, below the 0.40s the player needs')
    rate = ACTIVE.sample_rate
    for key, (start, end) in clips.items():
        pre = samples[int((start - 0.25) * rate):int((start - 0.01) * rate)]
        post = samples[int((end + 0.01) * rate):int((end + 0.25) * rate)]
        if pre.size and float(np.max(np.abs(pre))) > 1e-6:
            sys.exit(f'{label}: sound 0.25s before {key!r}; it would bleed into the neighbouring clip')
        if post.size and float(np.max(np.abs(post))) > 1e-6:
            sys.exit(f'{label}: sound 0.25s after {key!r}; it would bleed into the neighbouring clip')


def render_narrator(narrator: dict, lessons) -> dict:
    """Render one full pack and return its summary (for voices.json)."""
    global ACTIVE
    model = ROOT / narrator['model']
    model_config = ROOT / narrator['modelConfig']
    if not model.exists() or not model_config.exists():
        sys.exit(f'missing {model.relative_to(ROOT)}; run: node scripts/fetch-russian-voice-model.cjs')
    ACTIVE = Narrator(
        model,
        model_config,
        speaker_id=narrator.get('speakerId'),
        length_scale=narrator.get('lengthScale', 1.0),
        noise_scale=narrator.get('noiseScale', 0.667),
        noise_w=narrator.get('noiseW', 0.8),
    )
    target = narrator_dir(narrator)
    target.mkdir(parents=True, exist_ok=True)
    print(f'\n== {narrator["id"]}: {narrator["voice"]} @ {ACTIVE.sample_rate} Hz, '
          f'length_scale {ACTIVE.config.length_scale}', flush=True)

    started = time.time()
    manifest = {
        'version': 2,
        'narrator': narrator['id'],
        'engine': f'Piper neural {narrator["voice"]} @ {narrator["wordsPerMinute"]} wpm',
        'voice': narrator['voice'],
        'wordsPerMinute': narrator['wordsPerMinute'],
        'lengthScale': ACTIVE.config.length_scale,
        'sampleRate': ACTIVE.sample_rate,
        'bitrate': BITRATE,
        'leadInSeconds': LEAD_IN,
        'sentenceGapSeconds': SENTENCE_GAP,
        'wordGapSeconds': WORD_GAP,
        'generatedAt': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'lessons': {},
    }

    total_bytes = 0
    total_clips = 0
    total_speech = 0.0
    sentence_words = 0
    sentence_speech = 0.0

    for lesson in lessons:
        lesson_id = lesson['id']
        sentence_texts = [sentence['text'] for sentence in lesson['sentences']]
        word_texts = [word for sentence in lesson['sentences'] for word in sentence['words']]

        sentence_file = f'{lesson_id}.mp3'
        word_file = f'{lesson_id}.words.mp3'
        sentences = build_pack(sentence_texts, target / sentence_file, SENTENCE_GAP, f'{narrator["id"]}/{lesson_id}')
        words = build_pack(word_texts, target / word_file, WORD_GAP, f'{narrator["id"]}/{lesson_id}.words')

        for pack in (sentences, words):
            total_clips += len(pack)
            total_speech += sum(end - start for start, end in pack.values())
        for file in (sentence_file, word_file):
            total_bytes += (target / file).stat().st_size

        # Only clips that were really rendered count: duplicate sentences share
        # one clip, so counting every text twice would overstate the tempo.
        unique_sentences = list({normalize_key(text): text for text in sentence_texts}.values())
        sentence_words += word_count(unique_sentences)
        sentence_speech += sum(end - start for start, end in sentences.values())

        manifest['lessons'][lesson_id] = {
            'sentences': {'file': sentence_file, 'clips': sentences},
            'words': {'file': word_file, 'clips': words},
        }
        print(f'{lesson_id}: {len(sentences)} sentences, {len(words)} words', flush=True)

    measured = round(sentence_words / (sentence_speech / 60)) if sentence_speech else 0
    manifest['measuredWordsPerMinute'] = measured
    manifest['totalSpeechSeconds'] = round(total_speech, 1)
    manifest['totalClips'] = total_clips
    manifest['averageClipSeconds'] = round(total_speech / max(total_clips, 1), 2)
    (target / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, separators=(',', ':')))

    elapsed = time.time() - started
    print(f'{narrator["id"]}: {len(lessons)} lessons, {total_bytes / 1024 / 1024:.1f} MB, '
          f'{total_clips} clips, measured {measured} wpm, {elapsed:.1f}s', flush=True)

    return {
        'id': narrator['id'],
        'nameFa': narrator['nameFa'],
        'descriptionFa': narrator['descriptionFa'],
        'engine': 'piper',
        'measuredWordsPerMinute': measured,
        'labelWordsPerMinute': narrator['wordsPerMinute'],
        'clips': total_clips,
        'megabytes': round(total_bytes / 1024 / 1024, 1),
    }


def write_voices(summaries) -> None:
    """The list the app reads to know which Russian narrator is active."""
    by_id = {summary['id']: summary for summary in summaries}
    for narrator in NARRATORS:
        if narrator['id'] not in by_id:
            manifest_path = narrator_dir(narrator) / 'manifest.json'
            if not manifest_path.exists():
                continue
            existing = json.loads(manifest_path.read_text())
            by_id[narrator['id']] = {
                'id': narrator['id'],
                'nameFa': narrator['nameFa'],
                'descriptionFa': narrator['descriptionFa'],
                'engine': 'piper',
                'measuredWordsPerMinute': existing.get('measuredWordsPerMinute', narrator['wordsPerMinute']),
                'labelWordsPerMinute': narrator['wordsPerMinute'],
                'clips': existing.get('totalClips', 0),
                'megabytes': round(sum(file.stat().st_size for file in narrator_dir(narrator).glob('*.mp3')) / 1024 / 1024, 1),
            }
    voices = {
        'version': 1,
        'default': PRESET['default'],
        'narrators': [by_id[narrator['id']] for narrator in NARRATORS if narrator['id'] in by_id],
    }
    VOICES_JSON.write_text(json.dumps(voices, ensure_ascii=False, separators=(',', ':')))
    print(f'\n{VOICES_JSON.relative_to(ROOT)}: {len(voices["narrators"])} narrators')


def refresh_labels() -> None:
    """Rewrite the tempo written next to an already rendered pack.

    The label is the tempo measured from the clips, so tuning it after a render
    must not mean rendering 138 MP3s again: only the manifest text changes and
    the audio stays byte-identical.
    """
    for narrator in NARRATORS:
        path = narrator_dir(narrator) / 'manifest.json'
        if not path.exists():
            sys.exit(f'missing {path.relative_to(ROOT)}; render the pack first')
        manifest = json.loads(path.read_text())
        manifest['engine'] = f'Piper neural {narrator["voice"]} @ {narrator["wordsPerMinute"]} wpm'
        manifest['wordsPerMinute'] = narrator['wordsPerMinute']
        manifest['labelWordsPerMinute'] = narrator['wordsPerMinute']
        path.write_text(json.dumps(manifest, ensure_ascii=False, separators=(',', ':')))
        measured = manifest.get('measuredWordsPerMinute')
        delta = '' if measured is None else f' (measured {measured})'
        print(f'{narrator["id"]}: label {narrator["wordsPerMinute"]} wpm{delta}', flush=True)


def main() -> None:
    if not TEXT_JSON.exists():
        sys.exit(f'missing {TEXT_JSON}; run: node scripts/export-russian-course.cjs')
    lessons = json.loads(TEXT_JSON.read_text())
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    wanted = []
    args = sys.argv[1:]
    if '--refresh-labels' in args:
        refresh_labels()
        write_voices([])
        return
    if '--narrator' in args:
        wanted = [args[args.index('--narrator') + 1]]
    selected = [narrator for narrator in NARRATORS if not wanted or narrator['id'] in wanted]
    if wanted and not selected:
        sys.exit(f'unknown narrator {wanted[0]}; choose one of {[n["id"] for n in NARRATORS]}')

    summaries = [render_narrator(narrator, lessons) for narrator in selected]
    write_voices(summaries)


if __name__ == '__main__':
    main()
