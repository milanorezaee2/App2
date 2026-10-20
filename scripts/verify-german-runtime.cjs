#!/usr/bin/env node
/**
 * Runtime proof for the German lesson audio.
 *
 * Optional browser test, like the other `verify-*.cjs` browser scripts here.
 * It needs a built web export, a running preview server and Playwright:
 *
 *   npm run build:web
 *   npm run serve:web
 *   NODE_PATH=/path/to/playwright/node_modules node scripts/verify-german-runtime.cjs
 *
 * The test injects a deterministic German voice before the app loads. That is
 * deliberate: headless Chromium has no speech voices, and the point is to
 * prove that the UI really asks the speech engine to read German with a German
 * voice, at the right speed, on the right stages. It also proves the opposite:
 * with only English voices available, the lesson refuses to speak English and
 * shows a Persian installation hint instead.
 */
const assert = require('node:assert/strict');
const path = require('node:path');

function loadPlaywright() {
  for (const name of ['playwright', 'playwright-core']) {
    try { return require(name); } catch { /* try the next package */ }
  }
  throw new Error('Playwright is required: install playwright or set NODE_PATH to its node_modules directory.');
}

async function launchBrowser(chromium) {
  try {
    const mod = require.resolve('@sparticuz/chromium');
    const pack = await import(require('node:url').pathToFileURL(mod).href);
    await pack.inflate(path.resolve(path.dirname(mod), '../bin/al2023.tar.br'));
    pack.setupLambdaEnvironment(path.join(require('node:os').tmpdir(), 'al2023/lib'));
    return chromium.launch({
      headless: true,
      args: pack.default.args,
      executablePath: await pack.default.executablePath(),
    });
  } catch {
    return chromium.launch({ headless: true });
  }
}

/**
 * Runs before every document. Besides installing the fake voices it understands
 * two query flags used only by this test:
 *   ?seed=5       start the greetings lesson directly on a given stage
 *   ?english=1    report only the English system voice
 *   ?latevoices=1 expose the German voices only after 900 ms, like a cold Chrome
 */
function browserSetup() {
  const params = new URLSearchParams(location.search);
  if (params.get('english') === '1') window.__forceEnglish = true;
  if (params.get('latevoices') === '1') {
    window.__voicesReadyAt = Date.now() + 900;
    window.__voicesChangeListeners = [];
  }
  const seed = params.get('seed');
  if (seed !== null && /^\d$/.test(seed)) {
    try {
      window.localStorage.setItem('german_lesson_study_v1', JSON.stringify({
        schema: 1,
        sessions: {
          'de-v2-greetings': {
            stage: Number(seed),
            sentenceIndex: 0,
            answers: {},
            showCheckAnswers: false,
          },
        },
      }));
    } catch { /* storage disabled */ }
  }

  class MockUtterance {
    constructor(text) {
      this.text = text;
      this.voice = null;
      this.lang = '';
      this.rate = 1;
      this.pitch = 1;
      this.volume = 1;
    }
  }
  window.SpeechSynthesisUtterance = MockUtterance;
  const allVoices = [
    { name: 'Google Deutsch', lang: 'de-DE', localService: false, default: true, voiceURI: 'Google Deutsch' },
    { name: 'Microsoft Hedda', lang: 'de-DE', localService: true, default: false, voiceURI: 'Microsoft Hedda' },
    { name: 'English United States', lang: 'en-US', localService: true, default: false, voiceURI: 'English United States' },
  ];
  window.__voiceCalls = 0;
  window.__spoken = [];
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      getVoices: () => {
        if (window.__forceEnglish) return allVoices.filter(voice => voice.lang === 'en-US');
        if (window.__voicesReadyAt && Date.now() < window.__voicesReadyAt) return [];
        if (window.__voicesReadyAt && !window.__voicesAnnounced) {
          window.__voicesAnnounced = true;
          (window.__voicesChangeListeners || []).forEach(listener => listener());
        }
        return allVoices;
      },
      speak: utterance => {
        window.__voiceCalls += 1;
        window.__spoken.push({
          text: utterance.text,
          lang: utterance.lang,
          voice: utterance.voice ? utterance.voice.name : null,
          rate: utterance.rate,
        });
        setTimeout(() => utterance.onstart && utterance.onstart({}), 10);
        setTimeout(() => {
          if (utterance.onboundary) utterance.onboundary({ charIndex: 0 });
          if (utterance.onend) utterance.onend({});
        }, 55);
      },
      cancel: () => undefined,
      resume: () => undefined,
      pause: () => undefined,
      addEventListener: (name, listener) => {
        if (name === 'voiceschanged') (window.__voicesChangeListeners || []).push(listener);
      },
      removeEventListener: (name, listener) => {
        if (name !== 'voiceschanged') return;
        window.__voicesChangeListeners = (window.__voicesChangeListeners || []).filter(item => item !== listener);
      },
      speaking: false,
      pending: false,
      paused: false,
    },
  });
}

const BASE = process.env.BROWSER_BASE_URL || 'http://127.0.0.1:8081';
const LESSON = `${BASE}/learn/de/lesson?id=de-v2-greetings`;

(async () => {
  const { chromium } = loadPlaywright();
  const browser = await launchBrowser(chromium);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route(/supabase\.(co|in)/, route => route.abort());
  await context.addInitScript(browserSetup);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const cleanErrors = () => errors.filter(message =>
    !message.includes('cdn.jsdelivr.net/npm/jsqr@1.2.0/dist/jsQR.min.js'));
  const spoken = () => page.evaluate(() => window.__spoken || []);
  const body = () => page.locator('body').innerText();
  let checks = 0;
  const check = (label, value) => { assert.ok(value, label); checks += 1; };

  // 1. Home: the key German sentence plays with a German voice.
  await page.goto(`${BASE}/learn/de`, { waitUntil: 'networkidle' });
  await page.getByText('Deutsch Journey', { exact: true }).waitFor();
  await page.getByRole('button', { name: /^پخش تلفظ آلمانی:/ }).first().click();
  await page.waitForTimeout(400);
  const homeHeard = await spoken();
  check('German home speaks its key sentence in German',
    homeHeard.length > 0 && homeHeard[homeHeard.length - 1].text === 'Hallo!');
  check('home speech uses German, not the English default',
    homeHeard.every(item => item.lang.toLowerCase().startsWith('de') && !/english/i.test(item.voice || '')));
  check('German home raises no runtime errors', cleanErrors().length === 0);

  // 2. Stage 0 and stage 1: entering a lesson is audible, words are tappable.
  await page.goto(LESSON, { waitUntil: 'networkidle' });
  await page.getByText(/موقعیت · مرحلهٔ ۱ از ۹/).waitFor();
  await page.waitForTimeout(2400);
  const stage0 = await spoken();
  check('situation stage auto-speaks the first German sentence',
    stage0.length > 0 && stage0[stage0.length - 1].text === 'Hallo!');
  check('situation stage exposes tappable key words',
    await page.getByRole('button', { name: /^پخش واژهٔ آلمانی:/ }).count() > 0);

  const wordButton = page.getByRole('button', { name: /^پخش واژهٔ آلمانی:/ }).first();
  const wordLabel = await wordButton.getAttribute('aria-label');
  const word = (wordLabel || '').split(':').pop().trim();
  await wordButton.click();
  await page.waitForTimeout(250);
  const afterWord = await spoken();
  check('tapping a German word speaks exactly that word', afterWord[afterWord.length - 1].text === word);

  await page.getByRole('button', { name: 'ادامه', exact: true }).click();
  await page.getByText(/جمله‌های اصلی · مرحلهٔ ۲ از ۹/).waitFor();
  await page.waitForTimeout(1600);
  const stage1 = await spoken();
  check('core-sentence stage auto-speaks the new sentence', stage1[stage1.length - 1].text === 'Hallo!');
  check('natural German sentence uses rate 0.9', Math.abs(stage1[stage1.length - 1].rate - 0.9) < 0.001);
  check('a German, not English, voice is used', !/english/i.test(stage1[stage1.length - 1].voice || ''));

  await page.getByRole('button', { name: 'پخش آهستهٔ جمله' }).click();
  await page.waitForTimeout(250);
  const slow = await spoken();
  check('slow replay speaks the sentence at rate 0.55',
    Math.abs(slow[slow.length - 1].rate - 0.55) < 0.001 && slow[slow.length - 1].text === 'Hallo!');
  check('the core-sentence stage raises no runtime errors', cleanErrors().length === 0);

  // 3. Every remaining stage is reachable and labelled like the Russian flow.
  const stages = [
    [2, 'شنیدن · مرحلهٔ ۳ از ۹'],
    [3, 'سایه‌خوانی · مرحلهٔ ۴ از ۹'],
    [4, 'ساخت جمله · مرحلهٔ ۵ از ۹'],
    [5, 'واژگان از جمله · مرحلهٔ ۶ از ۹'],
    [6, 'دستور در کاربرد · مرحلهٔ ۷ از ۹'],
    [7, 'مکالمه · مرحلهٔ ۸ از ۹'],
    [8, 'مرور هوشمند · مرحلهٔ ۹ از ۹'],
  ];
  for (const [stage, header] of stages) {
    await page.goto(`${LESSON}&seed=${stage}`, { waitUntil: 'networkidle' });
    await page.getByText(new RegExp(header.replace(' ', '\\s+'))).waitFor();
    check(`stage ${stage + 1} renders ${header}`, true);
    if (stage === 5) {
      await page.waitForTimeout(1400);
      const words = await spoken();
      check('vocabulary stage auto-speaks its first German word',
        words.length > 0 && !/english/i.test(words[words.length - 1].voice || ''));
      check('vocabulary stage offers a play-all-words control',
        await page.getByRole('button', { name: 'پخش واژه‌های این صفحه' }).count() === 1);
      await page.getByRole('button', { name: 'پخش واژه‌های این صفحه' }).click();
      await page.waitForTimeout(1500);
      const sequence = await spoken();
      check('play-all speaks several German words one after another',
        new Set(sequence.slice(-4).map(item => item.text)).size >= 2);
    }
    if (stage === 8) {
      await page.getByRole('button', { name: 'نمایش توضیح همهٔ پاسخ‌ها' }).waitFor();
      check('review stage keeps the lesson self-check', true);
    }
  }

  // 4. Voice picker: choosing Google Deutsch is honoured by the next playback.
  await page.goto(`${BASE}/learn/de/audio-check`, { waitUntil: 'networkidle' });
  await page.getByText('بررسی و انتخاب صدای آلمانی', { exact: true }).waitFor();
  check('German audio-check page is reachable instead of redirecting', true);
  await page.waitForTimeout(1000);
  check('audio-check lists the German voices',
    await page.getByRole('button', { name: /Google Deutsch/ }).count() >= 1);
  await page.getByRole('button', { name: /Google Deutsch/ }).first().click();
  await page.getByRole('button', { name: 'پخش: هجی', exact: true }).click();
  await page.waitForTimeout(400);
  const picked = await spoken();
  check('the chosen Google German voice is used for the sample',
    picked[picked.length - 1].voice === 'Google Deutsch');
  check('the sample is spoken in German', picked[picked.length - 1].lang === 'de-DE');
  check('audio-check raises no runtime errors', cleanErrors().length === 0);

  // 5. Review screen is mounted for /learn/de/review.
  await page.goto(`${BASE}/learn/de/review`, { waitUntil: 'networkidle' });
  await page.getByText('مرور آلمانی', { exact: true }).waitFor();
  check('German review screen renders on its own route', true);

  // 6. Cold browser: the voice list is empty for the first ~0.9 s, like Chrome.
  await page.goto(`${LESSON}&seed=1&latevoices=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3200);
  const coldStart = await spoken();
  check('a cold voice list still auto-speaks German once the voices arrive',
    coldStart.some(item => item.text === 'Hallo!' && item.lang === 'de-DE'));
  check('the cold-start sentence never used the English default',
    coldStart.every(item => !/english/i.test(item.voice || '')));

  // 7. No German voice: refuse to read German with English and explain why.
  await page.goto(`${LESSON}&seed=0&english=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(4200);
  const englishCalls = await page.evaluate(() => window.__voiceCalls || 0);
  check('German is not read with the English default when no German voice exists', englishCalls === 0);
  check('the lesson explains the missing German voice in Persian',
    (await body()).includes('پخش صدای آلمانی در دسترس نیست'));
  check('the lesson stays readable without a German voice',
    (await body()).includes('موقعیت · مرحلهٔ ۱ از ۹'));

  console.log(`${checks} German runtime speech checks passed (home, situation, core sentences, slow replay, all nine stages, vocabulary, voice picker, review, cold-start voices, no-English fallback).`);
  await browser.close();
})().catch(async error => {
  console.error(error);
  process.exit(1);
});
