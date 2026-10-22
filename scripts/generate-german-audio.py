#!/usr/bin/env python3
"""Render the German audio packs with the neural narrators.

Three narrators ship together
-----------------------------
The learner picks one in the app (`صدای آلمانی`), so the same course text is
rendered once per voice into `public/audio/de/<id>/`. The app never mixes them:
whichever narrator is chosen, every sentence and every word comes from that one
folder, so a lesson cannot switch voice halfway through.

The engine
----------
Piper (VITS, ONNX Runtime), fully offline. The model files are not committed;
fetch them with `node scripts/fetch-german-voice-model.cjs`. The app itself never
loads a model: it only ships the rendered MP3s.

What "clean and independent" means here
---------------------------------------
Every sentence and every word is synthesized on its own and surrounded by real
digital silence (0.30 s before, 0.55 s after; 0.45 s for the word pack). The
manifest stores the exact speech window, so the app starts playing 0.25 s before
the speech and stops 0.15 s after it. A seek that lands late, an MP3 encoder
delay, or a neighbour in the same file can therefore never be heard:
`assert_isolated` proves it for every clip before a pack is written.

Usage
-----
    python3 -m venv .venv-audio
    .venv-audio/bin/pip install piper-tts onnxruntime numpy scipy lameenc
    node scripts/fetch-german-voice-model.cjs
    node scripts/export-german-course.cjs
    .venv-audio/bin/python scripts/generate-german-audio.py               # every narrator
    .venv-audio/bin/python scripts/generate-german-audio.py --narrator eva
    .venv-audio/bin/python scripts/generate-german-audio.py --refresh-labels
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
VOICES_JSON = OUT_DIR / 'voices.json'

PRESET = json.loads(PRESET_JSON.read_text(encoding='utf-8'))
NARRATORS = PRESET['narrators']


def narrator_dir(narrator: dict) -> Path:
    return OUT_DIR / narrator['id']


def synthesize(text: str) -> np.ndarray:
    return ACTIVE.render(text)


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
        key = ' '.join(text.strip().lower().split())
        if key in clips:
            continue
        audio = synthesize(text)
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
    if not model.exists():
        sys.exit(f'missing {model.relative_to(ROOT)}; run: node scripts/fetch-german-voice-model.cjs')
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

    started = time.time()
    total_bytes = 0
    total_speech = 0.0
    sentence_speech = 0.0
    total_clips = 0
    sentence_words = 0
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
        sentences = build_pack(sentence_texts, target / sentence_file, SENTENCE_GAP, f'{narrator["id"]}/{lesson_id}')
        words = build_pack(word_texts, target / word_file, WORD_GAP, f'{narrator["id"]}/{lesson_id}.words')
        total_bytes += (target / sentence_file).stat().st_size + (target / word_file).stat().st_size
        sentence_words += sum(len(text.split()) for text in sentence_texts)
        for pack in (sentences, words):
            total_speech += sum(end - start for start, end in pack.values())
            total_clips += len(pack)
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

    missing = 0
    for lesson in lessons:
        entry = manifest['lessons'][lesson['id']]
        for sentence in lesson['sentences']:
            if ' '.join(sentence['text'].strip().lower().split()) not in entry['sentences']['clips']:
                missing += 1
        for sentence in lesson['sentences']:
            for word in sentence['words']:
                if ' '.join(word.strip().lower().split()) not in entry['words']['clips']:
                    missing += 1
    if missing:
        sys.exit(f'{narrator["id"]}: {missing} clips missing')

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
    """The list the app reads to build its narrator picker."""
    by_id = {item['id']: item for item in summaries}
    for narrator in NARRATORS:
        if narrator['id'] not in by_id:
            manifest_path = narrator_dir(narrator) / 'manifest.json'
            if manifest_path.exists():
                existing = json.loads(manifest_path.read_text())
                by_id[narrator['id']] = {
                    'id': narrator['id'],
                    'nameFa': narrator['nameFa'],
                    'descriptionFa': narrator['descriptionFa'],
                    'engine': 'piper',
                    'measuredWordsPerMinute': existing.get('measuredWordsPerMinute', narrator['wordsPerMinute']),
                    'labelWordsPerMinute': narrator['wordsPerMinute'],
                    'clips': existing.get('totalClips', 0),
                    'megabytes': round(
                        sum(file.stat().st_size for file in narrator_dir(narrator).glob('*.mp3')) / 1024 / 1024, 1),
                }
    voices = {
        'version': 1,
        'default': PRESET.get('default', NARRATORS[0]['id']),
        'narrators': [by_id[narrator['id']] for narrator in NARRATORS if narrator['id'] in by_id],
    }
    VOICES_JSON.write_text(json.dumps(voices, ensure_ascii=False, separators=(',', ':')))
    print(f'\n{VOICES_JSON.relative_to(ROOT)}: {len(voices["narrators"])} narrators')


ACTIVE = None


def refresh_labels() -> None:
    """Rewrite the tempo written next to an already rendered pack.

    The label is the tempo measured from the clips, so tuning it after a render
    must not mean rendering 190 MP3s again: only the manifest text changes and
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
        sys.exit(f'missing {TEXT_JSON}; run: node scripts/export-german-course.cjs')
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
