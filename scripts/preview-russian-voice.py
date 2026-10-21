#!/usr/bin/env python3
"""Render short samples of the shipped Russian narrator for the docs page.

The samples go through `scripts/russian_voice.py`, the same module the lesson
pack uses, so what is heard here is exactly what the lessons play — same model,
same warmth chain, same loudness, same tempo.

Usage
-----
    python3 -m venv .venv-audio
    .venv-audio/bin/pip install piper-tts onnxruntime numpy scipy lameenc
    node scripts/fetch-russian-voice-model.cjs
    .venv-audio/bin/python scripts/preview-russian-voice.py

Output (committed, served as docs):
    docs/voice-samples/russian/irina-sentences.mp3
    docs/voice-samples/russian/irina-words.mp3
    docs/voice-samples/russian/index.html
"""
import json
import sys
from pathlib import Path

import lameenc
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from russian_voice import BITRATE, LEAD_IN, Narrator, word_count  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs' / 'voice-samples' / 'russian'
PRESET = json.loads((ROOT / 'config/russian-narrator.json').read_text())
NARRATOR = PRESET['narrators'][0]

PERSIAN = str.maketrans('0123456789', '۰۱۲۳۴۵۶۷۸۹')

# Real lines from the first lesson and its vocabulary: a greeting, a question
# and thanks, then the words the lesson teaches.
SENTENCES = ['Приве́т!', 'Здра́вствуйте!', 'До́брое у́тро!', 'Как дела́?', 'Спаси́бо, хорошо́.']
WORDS = ['привет', 'здравствуйте', 'утро', 'спасибо', 'пожалуйста', 'до свидания']
GAP = 0.70
LEAD_OUT = 0.40


def fa(value):
    return str(value).translate(PERSIAN)


def encode(samples, sample_rate):
    pcm = np.clip(samples, -1.0, 1.0)
    encoder = lameenc.Encoder()
    encoder.set_bit_rate(BITRATE)
    encoder.set_in_sample_rate(sample_rate)
    encoder.set_channels(1)
    encoder.set_quality(4)
    return encoder.encode((pcm * 32767).astype(np.int16).tobytes()) + encoder.flush()


def render(narrator, lines):
    parts = [np.zeros(int(narrator.sample_rate * LEAD_IN), dtype=np.float32)]
    for index, line in enumerate(lines):
        parts.append(narrator.render(line))
        parts.append(np.zeros(int(narrator.sample_rate * (LEAD_OUT if index == len(lines) - 1 else GAP)), dtype=np.float32))
    return np.concatenate(parts)


def write_page(sentence_seconds, word_seconds):
    (OUT / 'index.html').write_text(f"""<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>صدای روسی</title>
<style>
  :root {{ --primary:#5b4bb7; --line:#e3e3ee; --muted:#6b6b80; --bg:#f7f7fb; }}
  * {{ box-sizing:border-box; }}
  body {{ margin:0; padding:18px 14px 60px; background:var(--bg); color:#16162a;
         font-family:'Vazirmatn','Segoe UI',Tahoma,sans-serif; }}
  header, section {{ max-width:680px; margin:0 auto 12px; }}
  h1 {{ font-size:19px; margin:0 0 8px; }}
  .lead {{ font-size:13px; line-height:1.9; color:var(--muted); margin:0; }}
  .ru {{ direction:ltr; unicode-bidi:isolate; font-weight:600; color:#2c2360; }}
  section {{ background:#fff; border:1px solid var(--line); border-radius:16px; padding:13px 14px; }}
  .name {{ font-size:14.5px; font-weight:700; }}
  .hint {{ margin:6px 0 10px; font-size:11.5px; color:var(--muted); line-height:1.9; }}
  .play {{ width:100%; border:0; border-radius:12px; background:var(--primary); color:#fff;
          font-family:inherit; font-size:14px; font-weight:700; padding:13px 10px; cursor:pointer; }}
  .play:active {{ opacity:.85; }}
  .play.playing {{ background:#3f3387; }}
  footer {{ max-width:680px; margin:18px auto 0; font-size:11.5px; color:var(--muted); line-height:2; }}
  ul {{ margin:6px 0 0; padding-inline-start:18px; font-size:12px; line-height:2; }}
</style>
</head>
<body>
<header>
  <h1>صدای روسی — گویندهٔ زن عصبی</h1>
  <p class="lead">
    این همان گوینده‌ای است که <b>داخل خود برنامه</b> هست؛ هر ۶۹ درس و همهٔ واژه‌ها با همین
    صدا خوانده می‌شوند، بدون اینترنت و بدون نصب زبان روسی روی گوشی.
    صدا با همان موتور و همان پردازش درس‌ها ساخته شده و با سرعت
    <b>{fa(NARRATOR['wordsPerMinute'])} کلمه در دقیقه</b> خوانده می‌شود.
  </p>
</header>

<section>
  <div class="name">جمله‌های درس اول</div>
  <p class="hint">
    <span class="ru">Приве́т!</span> · <span class="ru">Здра́вствуйте!</span> ·
    <span class="ru">До́брое у́тро!</span> · <span class="ru">Как дела́?</span> ·
    <span class="ru">Спаси́бо, хорошо́.</span>
    <br>مدت: {fa(sentence_seconds)} ثانیه
  </p>
  <button class="play" type="button" data-src="irina-sentences.mp3">▶ پخش جمله‌ها</button>
</section>

<section>
  <div class="name">واژه‌های همان درس</div>
  <p class="hint">
    <span class="ru">привет</span> · <span class="ru">здравствуйте</span> ·
    <span class="ru">утро</span> · <span class="ru">спасибо</span> ·
    <span class="ru">пожалуйста</span> · <span class="ru">до свидания</span>
    <br>مدت: {fa(word_seconds)} ثانیه
  </p>
  <button class="play" type="button" data-src="irina-words.mp3">▶ پخش واژه‌ها</button>
</section>

<footer>
  هر جمله و هر واژه جداگانه ضبط شده و قبل و بعدش سکوت کامل دارد؛ بنابراین هیچ واژه‌ای
  روی جملهٔ قبلی یا بعدی نمی‌افتد. در درس، «آهسته» همان ضبط را کندتر پخش می‌کند، نه با
  صدایی دیگر.
</footer>
<audio id="player" preload="none"></audio>
<script>
  const player = document.getElementById('player');
  const buttons = [...document.querySelectorAll('.play')];
  buttons.forEach(button => button.addEventListener('click', () => {{
    const playing = button.classList.contains('playing');
    buttons.forEach(other => {{ other.classList.remove('playing'); other.textContent = other.textContent.replace('⏸', '▶'); }});
    if (playing) {{ player.pause(); return; }}
    player.src = button.dataset.src;
    player.play();
    button.classList.add('playing');
    button.textContent = button.textContent.replace('▶', '⏸');
  }}));
  player.addEventListener('ended', () => buttons.forEach(other => {{
    other.classList.remove('playing');
    other.textContent = other.textContent.replace('⏸', '▶');
  }}));
</script>
</body>
</html>
""")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    model = ROOT / NARRATOR['model']
    config = ROOT / NARRATOR['modelConfig']
    if not model.exists():
        sys.exit(f'missing {model.relative_to(ROOT)}; run: node scripts/fetch-russian-voice-model.cjs')
    narrator = Narrator(model, config, speaker_id=NARRATOR.get('speakerId'),
                        length_scale=NARRATOR.get('lengthScale', 1.0),
                        noise_scale=NARRATOR.get('noiseScale', 0.667),
                        noise_w=NARRATOR.get('noiseW', 0.8))

    sentences = render(narrator, SENTENCES)
    words = render(narrator, WORDS)
    (OUT / 'irina-sentences.mp3').write_bytes(encode(sentences, narrator.sample_rate))
    (OUT / 'irina-words.mp3').write_bytes(encode(words, narrator.sample_rate))
    sentence_seconds = sentences.size / narrator.sample_rate
    word_seconds = words.size / narrator.sample_rate
    write_page(round(sentence_seconds, 1), round(word_seconds, 1))
    print(f'{NARRATOR["id"]}: {len(SENTENCES)} sentences in {sentence_seconds:.1f}s '
          f'({word_count(SENTENCES)} words), {len(WORDS)} words in {word_seconds:.1f}s '
          f'({word_count(WORDS)} words) -> {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
