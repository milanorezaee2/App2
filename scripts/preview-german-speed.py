#!/usr/bin/env python3
"""Render the faster German narrator options so one can be chosen by ear.

Every clip is produced by the same engine and the same voices that ship inside
the app (`eSpeak NG`, `de+f1..f5` / `de+m1..m7`), so what is heard here is
exactly what will be heard in the lessons after the pack is rebuilt.

Each option is "one step faster" than today's 140 wpm pack; they differ only in
speaker and brightness, which is what "clearer" means for this engine.

Usage:
    python3 -m venv /tmp/v2
    /tmp/v2/bin/pip install espeakng-loader lameenc numpy
    /tmp/v2/bin/python scripts/preview-german-speed.py

Output (committed, served as docs):
    docs/voice-samples/speed/v1-*.mp3 ... v4-*.mp3
    docs/voice-samples/speed/compare-all.mp3   one file, options back to back
    docs/voice-samples/speed/samples.json
    docs/voice-samples/speed/index.html
"""
from __future__ import annotations

import ctypes
import json
from pathlib import Path

import lameenc
import numpy as np
from espeakng_loader import get_data_path, get_library_path

OUT = Path(__file__).resolve().parent.parent / 'docs' / 'voice-samples' / 'speed'
PERSIAN = str.maketrans('0123456789', '۰۱۲۳۴۵۶۷۸۹')


def fa_digit(value: int) -> str:
    return str(value).translate(PERSIAN)


def fa_clock(seconds: float) -> str:
    minutes, rest = divmod(int(seconds), 60)
    return f'{fa_digit(minutes)}:{fa_digit(rest):0>2}'
BITRATE = 24
LEAD_IN = 0.14
END = 0.32
LINE_GAP = 0.30
VARIANT_GAP = 0.85

LIB = ctypes.CDLL(str(get_library_path()))
LIB.espeak_Initialize.restype = ctypes.c_int
LIB.espeak_Initialize.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_char_p, ctypes.c_int]
SAMPLE_RATE = LIB.espeak_Initialize(2, 0, str(get_data_path()).encode(), 0)
if SAMPLE_RATE <= 0:
    raise SystemExit('eSpeak NG failed to initialise')
LIB.espeak_SetVoiceByName.argtypes = [ctypes.c_char_p]
LIB.espeak_SetParameter.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_int]
LIB.espeak_Synth.argtypes = [ctypes.c_char_p, ctypes.c_size_t, ctypes.c_uint, ctypes.c_int,
                             ctypes.c_uint, ctypes.c_uint, ctypes.c_void_p, ctypes.c_void_p]

RATE, VOLUME, PITCH, RANGE, GAP = 1, 2, 3, 4, 5

_buffer: list[bytes] = []
CALLBACK = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.POINTER(ctypes.c_short), ctypes.c_int, ctypes.c_void_p)


def _callback(wav, count, events):  # noqa: ARG001
    if wav and count > 0:
        _buffer.append(ctypes.string_at(wav, count * ctypes.sizeof(ctypes.c_short)))
    return 0


_callback_ref = CALLBACK(_callback)
LIB.espeak_SetSynthCallback(_callback_ref)


def say(text: str, voice: str, rate: int, pitch: int, rng: int, gap: int = 0) -> np.ndarray:
    LIB.espeak_SetVoiceByName(voice.encode())
    LIB.espeak_SetParameter(RATE, rate, 0)
    LIB.espeak_SetParameter(PITCH, pitch, 0)
    LIB.espeak_SetParameter(RANGE, rng, 0)
    LIB.espeak_SetParameter(GAP, gap, 0)
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


def encode(samples: np.ndarray) -> bytes:
    pcm = np.clip(samples, -1.0, 1.0)
    encoder = lameenc.Encoder()
    encoder.set_bit_rate(BITRATE)
    encoder.set_in_sample_rate(SAMPLE_RATE)
    encoder.set_channels(1)
    encoder.set_quality(4)
    return encoder.encode((pcm * 32767).astype(np.int16).tobytes()) + encoder.flush()


# Three real course sentences: a short greeting, a normal statement and a longer
# request. Together they show how the tempo feels in a lesson.
LINES = [
    'Hallo! Wie geht es dir?',
    'Ich heiße Mina. Ich komme aus dem Iran.',
    'Guten Morgen! Ich möchte einen Kaffee, bitte.',
]

OPTIONS = [
    {
        'id': 'v1',
        'file': 'v1-current-voice-faster.mp3',
        'voice': 'de+f3', 'rate': 160, 'pitch': 52, 'range': 50, 'gap': 0,
        'fa': 'همان گویندهٔ فعلی، یک پله سریع‌تر',
        'detail': 'زن، گرم و متعادل · ۱۶۰ کلمه در دقیقه (اکنون ۱۴۰)',
    },
    {
        'id': 'v2',
        'file': 'v2-current-voice-faster-clearer.mp3',
        'voice': 'de+f3', 'rate': 158, 'pitch': 62, 'range': 60, 'gap': 0,
        'fa': 'همان گوینده، یک پله سریع‌تر و روشن‌تر',
        'detail': 'همان صدا با تُن بازتر و واضح‌تر · ۱۵۸ کلمه در دقیقه',
    },
    {
        'id': 'v3',
        'file': 'v3-brighter-female.mp3',
        'voice': 'de+f1', 'rate': 158, 'pitch': 55, 'range': 54, 'gap': 0,
        'fa': 'گویندهٔ زن روشن‌تر و جوان‌تر',
        'detail': 'صدای بازتر و واضح‌تر · ۱۵۸ کلمه در دقیقه',
    },
    {
        'id': 'v4',
        'file': 'v4-current-voice-fastest.mp3',
        'voice': 'de+f3', 'rate': 172, 'pitch': 56, 'range': 54, 'gap': 0,
        'fa': 'همان گوینده، دو پله سریع‌تر',
        'detail': 'برای کسی که تندتر می‌خواهد · ۱۷۲ کلمه در دقیقه',
    },
]

LABELS = ['Variante eins.', 'Variante zwei.', 'Variante drei.', 'Variante vier.']


def variant_audio(option: dict) -> np.ndarray:
    parts = [silence(LEAD_IN)]
    for index, line in enumerate(LINES):
        parts.append(say(line, option['voice'], option['rate'], option['pitch'], option['range'], option.get('gap', 0)))
        parts.append(silence(END if index == len(LINES) - 1 else LINE_GAP))
    return np.concatenate(parts)


REFERENCE = {'file': 'v0-current-140.mp3', 'voice': 'de+f3', 'rate': 140, 'pitch': 52, 'range': 50,
             'fa': 'وضعیت فعلی (۱۴۰ کلمه در دقیقه) — فقط برای مقایسه'}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {'lines': LINES, 'options': []}
    reference_audio = variant_audio(REFERENCE)
    (OUT / REFERENCE['file']).write_bytes(encode(reference_audio))
    manifest['reference'] = {**REFERENCE, 'seconds': round(reference_audio.size / SAMPLE_RATE, 2)}
    combined = [silence(LEAD_IN)]
    cursor = LEAD_IN
    for option, label in zip(OPTIONS, LABELS):
        audio = variant_audio(option)
        payload = encode(audio)
        (OUT / option['file']).write_bytes(payload)
        manifest['options'].append({
            **{key: option[key] for key in ('id', 'file', 'voice', 'rate', 'pitch', 'range', 'gap', 'fa', 'detail')},
            'seconds': round(audio.size / SAMPLE_RATE, 2),
            'bytes': len(payload),
        })
        intro = say(label, option['voice'], option['rate'], option['pitch'], option['range'], option['gap'])
        combined.append(intro)
        combined.append(silence(0.45))
        cursor += (intro.size + int(SAMPLE_RATE * 0.45)) / SAMPLE_RATE
        manifest['options'][-1]['at'] = round(cursor, 1)
        combined.append(audio)
        cursor += (audio.size + int(SAMPLE_RATE * VARIANT_GAP)) / SAMPLE_RATE
        combined.append(silence(VARIANT_GAP))
        print(f"  {option['id']}  {option['voice']:7s} {option['rate']} wpm  "
              f'{audio.size / SAMPLE_RATE:5.2f}s  {len(payload) / 1024:5.1f} KB')

    all_audio = np.concatenate(combined)
    (OUT / 'compare-all.mp3').write_bytes(encode(all_audio))
    manifest['compare'] = {'file': 'compare-all.mp3', 'seconds': round(all_audio.size / SAMPLE_RATE, 2)}
    (OUT / 'samples.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + '\n')
    write_page(manifest)
    print(f'\ncompare-all.mp3: {all_audio.size / SAMPLE_RATE:.1f}s, {len(manifest["options"])} options in {OUT}')


def write_page(manifest: dict) -> None:
    cards = '\n'.join(
        f"""    <section class="card">
      <div class="head"><span class="num">{index}</span><span class="name">{item['fa']}</span></div>
      <p class="hint">{item['detail']} · در فایل «همه با هم» از {fa_clock(item['at'])}</p>
      <button class="play" type="button" data-src="{item['file']}">▶ پخش نمونهٔ {fa_digit(index)}</button>
    </section>"""
        for index, item in enumerate(manifest['options'], start=1)
    )
    (OUT / 'index.html').write_text(f"""<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>انتخاب صدای سریع‌تر آلمانی</title>
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
  footer {{ max-width:680px; margin:18px auto 0; font-size:11.5px; color:var(--muted); line-height:2; }}
</style>
</head>
<body>
<header>
  <h1>صدای آلمانی، یک پله سریع‌تر — چهار نمونه</h1>
  <p class="lead">
    هر چهار نمونه با همان موتور صدای داخل برنامه ساخته شده‌اند، پس بعد از انتخاب،
    دقیقاً همین صدا در درس‌ها پخش می‌شود. جمله‌های واقعی درس:
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
  <div class="head"><span class="name">وضعیت فعلی برای مقایسه</span></div>
  <p class="hint">همان گوینده با سرعت امروز (۱۴۰) — نمونه نیست، فقط مرجع.</p>
  <button class="play" type="button" data-src="v0-current-140.mp3" style="background:#8a9691">▶ پخش صدای فعلی</button>
</section>
<footer>
  هر نمونه سه جملهٔ واقعی درس را می‌خواند. بعد از انتخاب، کل ۹۵ درس و واژه‌ها با همین صدا بازسازی می‌شوند.
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


if __name__ == '__main__':
    main()
