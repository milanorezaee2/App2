# راهنمای فعال‌سازی نرياتر صدای انسانی (انگلیسی • آلمانی • روسی)

این فایل فقط برای شما است. نه برای گیت، نه برای کاربران نهایی.

## چه کار شده است؟ (کد)

تمام کار کد انجام شده است:

- سه زبان: انگلیسی (en-US)، آلمانی (de-DE)، روسی (ru-RU) — هر کدام صدای زن، مهربان و طبیعی دارند.
- پخش خودکار: وقتی کاربر هر درس را باز می‌کند، جمله درس بصورت خودکار خوانده می‌شود. کاربر نیازی به زدن دکمهٔ پخش ندارد (اگر narrator auto روشن باشد).
- بدون صدای دستگاه: هرگز از Text-to-Speech داخلی اپلیکیشن استفاده نمی‌شود. صدای از سمت ابری (Supabase Edge Function) می‌آید.
- صدای طبیعی: صدای زن، آرام و) — نه ماشینی، نه خشک.

## چه کاری باید شما انجام دهید؟ (۲ دقیقه)

نرياتر کد کامل است، اما صداها نیاز به یک کلید API دارند تا ابری تولید شوند.

### گزینه ۱: ElevenLabs (پیشنهادی — صدای بیشترین طبیعی)

1. به elevenlabs.io بروید و یک حساب بسازید.
2. از منوی پروفایل، یک API Key بسازید و کپی کنید.
3. در ترمینال، این دو دستور را بزنید:

```bash
npx supabase secrets set ELEVENLABS_API_KEY=کلید_شما
npx supabase secrets set NARRATION_PROVIDER=elevenlabs
```

4. فایل .env را باز کنید و your-project.supabase.co را به آدرس پروژه Supabase خود تغییر دهید.
5. Edge Function را استقرار دهید:

```bash
npx supabase functions deploy narration-tts --no-verify-jwt
```

### گزینه ۲: OpenAI (صدای خوب، کم‌تر طبیعی از ElevenLabs)

1. به platform.openai.com بروید و کلید API بسازید.
2. در ترمینال:

```bash
npx supabase secrets set OPENAI_API_KEY=کلید_شما
npx supabase secrets set NARRATION_PROVIDER=openai
```

3. فایل .env را باز کنید و your-project.supabase.co را به آدرس پروژه Supabase خود تغییر دهید.
4. Edge Function را استقرار دهید:

```bash
npx supabase functions deploy narration-tts --no-verify-jwt
```

## چگونه صداها تولید و آپلود شوند؟

مانیفست ۱۲,۰۶۲ جمله (انگلیسی، آلمانی، روسی) در فایل audio-manifest.json آماده است.

```bash
# تولید فایل‌های mp3 با ElevenLabs (نیاز به کلید API)
NARRATION_PROVIDER=elevenlabs ELEVENLABS_API_KEY=کلید_شما npm run narration:generate

# آپلود به Supabase Storage (CDN)
npm run narration:publish
```

اگر فایل‌های صوتی روی CDN یا Supabase Storage قرار گیرند، نرياتر آن‌ها را می‌خواند و کاربر صدا را مشنواید.

## چگونه تست کنید؟

```bash
npm run validate:narrator   # ۲۲ تست نرياتر — همه باید PASSED باشند
npm run typecheck           # تایپاسکریپت باید بدون خطا compiled شود
```

## خلاصه برای کاربر نهایی

کاربر فقط اپ را باز می‌کند، یک درس انتخاب می‌کند و جمله به صدای زنده، طبیعی، مشخص خوانده می‌شود. نه دکمهٔ اضافی، نه تنظیم دستگاه، نه صدای ماشینی.

---
این فایل را بعد از خواندن می‌توانید حذف کنید — فقط برای راهنمای شما است.