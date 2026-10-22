#!/usr/bin/env python3
"""Render the neural German narrator candidates so a voice can be chosen by ear.

Everything here goes through `scripts/german_voice.py`, the same module the
shipped pack uses, so what is heard on the page is exactly what the lessons will
play — same model, same warmth chain, same loudness.

All three voices ship inside the app and the learner picks one there; this page
only lets that choice be heard outside the phone. Each voice is rendered with the
same `length_scale` the shipped pack uses, so the sample sounds like the lesson.

Usage
-----
    python3 -m venv .venv-audio
    .venv-audio/bin/pip install piper-tts onnxruntime numpy scipy lameenc
    node scripts/fetch-german-voice-model.cjs      # de_DE-kerstin-low
    .venv-audio/bin/python scripts/preview-german-speed.py

Output (committed, served as docs):
    docs/voice-samples/speed/v6-*.mp3 ... v8-*.mp3
    docs/voice-samples/speed/compare-all.mp3
    docs/voice-samples/speed/samples.json
    docs/voice-samples/speed/index.html
"""
import json
import sys
from pathlib import Path

import lameenc
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from german_voice import LEAD_IN, Narrator  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs' / 'voice-samples' / 'speed'
MODELS = ROOT / 'scripts' / 'voice-models'
PERSIAN = str.maketrans('0123456789', '۰۱۲۳۴۵۶۷۸۹')


def fa_digit(value):
    return str(value).translate(PERSIAN)


def fa_clock(seconds):
    minutes, rest = divmod(int(seconds), 60)
    return fa_digit(f'{minutes}:{rest:02d}')


# Three real course sentences: a greeting, a statement and a polite request.
LINES = [
    'Hallo! Wie geht es dir?',
    'Ich heiße Mina. Ich komme aus dem Iran.',
    'Guten Morgen! Ich möchte einen Kaffee, bitte.',
]
WORDS = 20
TARGET_WPM = 138
GAP = 0.45
END = 0.40

OPTIONS = [
    {
        'id': 'v6',
        'narrator': 'kerstin',
        'file': 'v6-kerstin-warm.mp3',
        'model': 'de_DE-kerstin-low',
        'lengthScale': 1.35,
        'fa': 'کرستین — زن، نرم و گرم و مهربان',
        'detail': 'صدای زنانهٔ آرام و مهربان',
    },
    {
        'id': 'v7',
        'narrator': 'ramona',
        'file': 'v7-ramona-warm.mp3',
        'model': 'de_DE-ramona-low',
        'lengthScale': 1.45,
        'fa': 'رامونا — زن، روشن و شاداب',
        'detail': 'تُن کمی بالاتر و شاداب‌تر',
    },
    {
        'id': 'v8',
        'narrator': 'eva',
        'file': 'v8-eva-bright.mp3',
        'model': 'de_DE-eva_k-x_low',
        'lengthScale': 1.00,
        'fa': 'اِوا — زن جوان و بسیار واضح',
        'detail': 'وضوح بیشتر، کمی خشک‌تر',
    },

]


def model_paths(name):
    base = MODELS / name
    onnx = base.with_suffix('.onnx')
    config = base.with_suffix('.onnx.json')
    if not onnx.exists():
        sys.exit(f'missing {onnx.relative_to(ROOT)}; run: node scripts/fetch-german-voice-model.cjs')
    return onnx, config


def encode(samples, sample_rate=16000, bitrate=48):
    pcm = np.clip(samples, -1.0, 1.0)
    encoder = lameenc.Encoder()
    encoder.set_bit_rate(bitrate)
    encoder.set_in_sample_rate(sample_rate)
    encoder.set_out_sample_rate(44100)
    encoder.set_channels(1)
    encoder.set_quality(4)
    return encoder.encode((pcm * 32767).astype(np.int16).tobytes()) + encoder.flush()


def silence(narrator, seconds):
    return np.zeros(int(narrator.sample_rate * seconds), dtype=np.float32)


def render(narrator):
    parts = [silence(narrator, LEAD_IN)]
    for index, line in enumerate(LINES):
        audio = narrator.render(line)
        parts.append(audio)
        parts.append(silence(narrator, END if index == len(LINES) - 1 else GAP))
    return np.concatenate(parts)


def preset_config():
    try:
        return json.loads((ROOT / 'config/german-narrator.json').read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return {}


def default_id():
    return preset_config().get('default', '')


def pack_wpm(option):
    """The tempo written next to the narrator in the config the app reads."""
    for narrator in preset_config().get('narrators', []):
        if narrator.get('id') == option.get('narrator'):
            return narrator.get('wordsPerMinute')
    return None


def write_page(manifest):
    chosen = default_id()
    cards = '\n'.join(
        f"""    <section class="card{' chosen' if item.get('narrator') == chosen else ''}">
      <div class="head"><span class="num">{index}</span><span class="name">{item['fa']}</span>{'<span class="badge">پیش‌فرض برنامه</span>' if item.get('narrator') == chosen else ''}</div>
      <p class="hint">{item['detail']} · در برنامه {fa_digit(item.get('packWordsPerMinute') or item['wordsPerMinute'])} کلمه در دقیقه · در فایل «همه با هم» از {fa_clock(item['at'])}</p>
      <button class="play" type="button" data-src="{item['file']}">▶ پخش نمونهٔ {fa_digit(index)}</button>
    </section>"""
        for index, item in enumerate(manifest['options'], start=1)
    )
    (OUT / 'index.html').write_text(f"""<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>انتخاب صدای آلمانی</title>
<style>
  :root {{ --primary:#0f6b57; --line:#e3e8e6; --muted:#6b7672; --bg:#f7faf9; }}
  * {{ box-sizing:border-box; }}
  body {{ margin:0; padding:18px 14px 60px; background:var(--bg); color:#12211d;
         font-family:'Vazirmatn','Segoe UI',Tahoma,sans-serif; }}
  header, section {{ max-width:680px; margin:0 auto 12px; }}
  h1 {{ font-size:19px; margin:0 0 8px; }}
  .lead {{ font-size:13px; line-height:1.9; color:var(--muted); margin:0; }}
  .de {{ direction:ltr; unicode-bidi:isolate; font-weight:600; color:#0b3d32; }}
  section {{ background:#fff; border:1px solid var(--line); border-radius:16px; padding:13px 14px; }}
  .head {{ display:flex; align-items:center; gap:8px; }}
  .num {{ width:24px; height:24px; border-radius:999px; background:#e8f3ef; color:var(--primary);
          font-size:12px; display:inline-flex; align-items:center; justify-content:center; }}
  .name {{ font-size:14.5px; font-weight:700; }}
  .hint {{ margin:6px 0 10px; font-size:11.5px; color:var(--muted); }}
  .play {{ width:100%; border:0; border-radius:12px; background:var(--primary); color:#fff;
          font-family:inherit; font-size:14px; font-weight:700; padding:13px 10px; cursor:pointer; }}
  .play:active {{ opacity:.85; }}
  .play.playing {{ background:#0b4f41; }}
  .all {{ background:#12211d; }}
  .card.chosen {{ border-color:#0f6b57; box-shadow:0 0 0 2px #cfe8df inset; }}
  .badge {{ margin-inline-start:auto; font-size:10.5px; color:#0f6b57; background:#e8f3ef;
            border-radius:999px; padding:3px 9px; }}
  footer {{ max-width:680px; margin:18px auto 0; font-size:11.5px; color:var(--muted); line-height:2; }}
</style>
</head>
<body>
<header>
  <h1>صدای آلمانی — سه گویندهٔ عصبی</h1>
  <p class="lead">
    <b>هر سه گوینده داخل برنامه هستند</b> و انتخاب در صفحهٔ «صدای آلمانی» انجام می‌شود؛
    هر درس کامل با همان گویندهٔ انتخابی پخش می‌شود، بدون اینترنت و بدون نصب زبان آلمانی.
    این نمونه‌ها با همان موتور و همان پردازش صدایی ساخته شده‌اند که داخل برنامه پخش می‌شود.
    جمله‌های واقعی درس:
    <span class="de">Hallo! Wie geht es dir?</span> ·
    <span class="de">Ich heiße Mina. Ich komme aus dem Iran.</span> ·
    <span class="de">Guten Morgen! Ich möchte einen Kaffee, bitte.</span>
  </p>
</header>
{cards}
<section class="card">
  <div class="head"><span class="name">همه پشت سر هم</span></div>
  <p class="hint">نام هر نمونه هم خوانده می‌شود؛ یک‌بار از اول تا آخر گوش کنید.</p>
  <button class="play all" type="button" data-src="compare-all.mp3">▶ پخش همهٔ نمونه‌ها</button>
</section>
<section class="card">
  <div class="head"><span class="name">گویندهٔ قبلی برای مقایسه</span></div>
  <p class="hint">همان صدای مصنوعی قبلی (eSpeak) — نمونه نیست، فقط مرجع.</p>
  <button class="play" type="button" data-src="v0-current-140.mp3" style="background:#8a9691">▶ پخش صدای قبلی</button>
</section>
<footer>
  هر سه بسته با هم در برنامه نصب می‌شوند (هر کدام ۱۹۰ کلیپ، همهٔ ۹۵ درس و واژه‌ها).
  انتخاب کاربر ذخیره می‌شود و از دفعهٔ بعد هم همان گوینده می‌خواند.
  تغییر «پیش‌فرض» یا سرعت فقط یک خط در <code>config/german-narrator.json</code> است.
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
    if '--page-only' in sys.argv:
        manifest = json.loads((OUT / 'samples.json').read_text(encoding='utf-8'))
        write_page(manifest)
        print(f'page rebuilt from samples.json (default: {default_id() or "none"})')
        return

    manifest = {'lines': LINES, 'targetWordsPerMinute': TARGET_WPM,
                'selection': 'three-narrators', 'options': []}
    # compare-all.mp3 is one continuous file, so every voice must share a rate.
    rates = set()
    parts = [np.zeros(int(16000 * 0.14), dtype=np.float32)]
    cursor = 0.14
    for option in OPTIONS:
        onnx, config = model_paths(option['model'])
        narrator = Narrator(onnx, config, speaker_id=option.get('speakerId'),
                            length_scale=option['lengthScale'])
        rates.add(narrator.sample_rate)
        if len(rates) > 1:
            sys.exit(f'the three models use different sample rates {sorted(rates)}; compare-all.mp3 needs one rate')
        audio = render(narrator)
        seconds = audio.size / narrator.sample_rate
        # VITS sampling makes each render a little different; take the median of
        # three passes so the published tempo is stable.
        runs = sorted(sum(len(narrator.render(line)) / narrator.sample_rate for line in LINES)
                      for _ in range(3))
        speech = runs[1]
        (OUT / option['file']).write_bytes(encode(audio, narrator.sample_rate))
        wpm = round(WORDS / (speech / 60))
        manifest['options'].append({
            'id': option['id'],
            'file': option['file'],
            'model': option['model'],
            'narrator': option['narrator'],
            'lengthScale': option['lengthScale'],
            'wordsPerMinute': wpm,
            'packWordsPerMinute': pack_wpm(option),
            'fa': option['fa'],
            'detail': option['detail'],
            'seconds': round(seconds, 2),
            'bytes': (OUT / option['file']).stat().st_size,
        })
        intro = narrator.render(f'Variante {option["id"][1]}.')
        parts.append(intro)
        parts.append(np.zeros(int(narrator.sample_rate * 0.35), dtype=np.float32))
        cursor += (intro.size + int(narrator.sample_rate * 0.35)) / narrator.sample_rate
        manifest['options'][-1]['at'] = round(cursor, 1)
        parts.append(audio)
        parts.append(np.zeros(int(narrator.sample_rate * 0.7), dtype=np.float32))
        cursor += seconds + 0.7
        print(f"  {option['id']}  {option['model']:22s} ls={option['lengthScale']:4.2f} "
              f'{seconds:5.2f}s  {wpm} wpm  {manifest["options"][-1]["bytes"] / 1024:5.1f} KB')

    combined = np.concatenate(parts)
    (OUT / 'compare-all.mp3').write_bytes(encode(combined, 16000))
    manifest['compare'] = {'file': 'compare-all.mp3', 'seconds': round(combined.size / 16000, 2)}
    (OUT / 'samples.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + '\n')
    write_page(manifest)
    print(f'\ncompare-all.mp3: {combined.size / 16000:.1f}s, {len(manifest["options"])} options in {OUT}')


if __name__ == '__main__':
    main()
