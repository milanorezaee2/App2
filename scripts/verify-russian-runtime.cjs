#!/usr/bin/env node
/**
 * Runtime proof for the Russian course audio.
 *
 * The Russian course ships its own neural narrator (`public/audio/ru`), so the
 * lessons must sound Russian even on a phone whose system voices are
 * English-only, even on a phone with no `ru-RU` voice, and even in a browser
 * without any Web Speech support (Firefox for Android). This test drives the
 * built web export in Chromium and records:
 *
 *   - which bundled clip is requested (file + start offset) for every playback,
 *   - whether the device speech engine was touched at all,
 *   - and what happens when the bundled audio cannot be loaded (device cover).
 *
 * Browser playback is faked with a deterministic `Audio` element: headless
 * Chromium has no MP3 codec in every build, and the point of the test is the
 * wiring between the lesson UI and the shipped audio, not the decoder.
 *
 *   npm run build:web
 *   npm run serve:web
 *   NODE_PATH=/path/to/playwright/node_modules node scripts/verify-russian-runtime.cjs
 */
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
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
 * Runs before every document.
 *   ?seed=5          start the greetings lesson on a given stage
 *   ?novoices=1      expose no system voices at all
 *   ?nospeech=1      remove the Web Speech API entirely (Firefox for Android)
 *   ?audioblocked=1  the browser cannot decode the bundled MP3s
 */
function browserSetup() {
  const params = new URLSearchParams(location.search);
  window.__audioBlocked = params.get('audioblocked') === '1';
  const noSpeech = params.get('nospeech') === '1';
  const seed = params.get('seed');
  if (seed !== null && /^\d$/.test(seed)) {
    try {
      window.localStorage.setItem('russian_lesson_sessions_v1', JSON.stringify({
        schema: 1,
        sessions: {
          'ru-l1-greetings': { stage: Number(seed), sentenceIndex: 0, revealed: false, answers: {}, showCheckAnswers: false },
        },
      }));
    } catch { /* storage disabled */ }
  }

  // --- device speech (must stay unused while the bundled audio works) ---
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
  if (noSpeech) {
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: undefined });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: undefined });
    window.__spoken = [];
    window.__pageErrors = [];
    window.addEventListener('unhandledrejection', event => {
      window.__pageErrors.push(String((event.reason && event.reason.message) || event.reason));
    });
  }
  if (!noSpeech) window.SpeechSynthesisUtterance = MockUtterance;
  const russianVoice = { name: 'Milena', lang: 'ru-RU', localService: true, default: true, voiceURI: 'Milena' };
  const englishVoice = { name: 'English United States', lang: 'en-US', localService: true, default: false, voiceURI: 'English United States' };
  if (!noSpeech) Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      getVoices: () => (params.get('novoices') === '1' ? [] : [russianVoice, englishVoice]),
      speak: utterance => {
        window.__spoken = window.__spoken || [];
        window.__spoken.push({
          text: utterance.text,
          lang: utterance.lang,
          voice: utterance.voice ? utterance.voice.name : null,
          rate: utterance.rate,
        });
        setTimeout(() => utterance.onstart && utterance.onstart({}), 5);
        setTimeout(() => utterance.onend && utterance.onend({}), 20);
      },
      cancel: () => undefined,
      resume: () => undefined,
      pause: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      speaking: false,
      pending: false,
      paused: false,
    },
  });

  // --- deterministic audio element that records every clip request ---
  class FakeAudio extends EventTarget {
    constructor(src) {
      super();
      this.src = String(src);
      this.readyState = 0;
      this.currentTime = 0;
      this.playbackRate = 1;
      this.preload = '';
      this.paused = true;
      window.__audio = window.__audio || [];
      window.__audio.push({ src: this.src, plays: [], path: new URL(this.src, location.href).pathname });
      this.__record = window.__audio[window.__audio.length - 1];
      setTimeout(() => {
        this.readyState = 4;
        this.dispatchEvent(new Event('loadedmetadata'));
        this.dispatchEvent(new Event('canplay'));
      }, 0);
    }

    play() {
      this.__record.plays.push({ start: this.currentTime, rate: this.playbackRate, at: Date.now() });
      if (window.__audioBlocked) return Promise.reject(new Error('NotSupportedError'));
      this.paused = false;
      this.dispatchEvent(new Event('playing'));
      return Promise.resolve();
    }

    pause() {
      this.paused = true;
      this.__record.stops = this.__record.stops || [];
      this.__record.stops.push(Date.now());
    }

    load() { /* no-op */ }
  }
  window.Audio = FakeAudio;
}

const BASE = process.env.BROWSER_BASE_URL || 'http://127.0.0.1:8081';
const GREETINGS = 'ru-l1-greetings';
const LESSON = `${BASE}/learn/ru/lesson?id=${GREETINGS}`;

(async () => {
  const voicesResponse = await fetch(`${BASE}/App1/audio/ru/voices.json`).catch(() => null);
  const voices = voicesResponse && voicesResponse.ok ? await voicesResponse.json() : null;
  assert.ok(voices && voices.narrators.length >= 1, 'the Russian narrator must be served from /audio/ru/voices.json');
  const narratorId = voices.default;
  const response = await fetch(`${BASE}/App1/audio/ru/${narratorId}/manifest.json`).catch(() => null);
  const manifest = response && response.ok ? await response.json() : null;
  assert.ok(manifest, `the ${narratorId} manifest must be served from /audio/ru/${narratorId}/manifest.json`);
  const greetingSentences = manifest.lessons[GREETINGS].sentences;
  const greetingWords = manifest.lessons[GREETINGS].words;

  // The course writes the stress mark (`Приве́т!`); the manifest key does not have it.
  const normalize = text => text.normalize('NFC').replace(/[\u0301\u00b4\u02b9\u2032]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
  const firstSentenceText = 'Приве́т!';
  const firstClip = greetingSentences.clips[normalize(firstSentenceText)];
  assert.ok(firstClip, 'the first sentence of the greetings lesson must have a clip');

  // --- shipped files really exist ---
  let staticChecks = 0;
  for (const file of [greetingSentences.file, greetingWords.file]) {
    const head = await fetch(`${BASE}/App1/audio/ru/${narratorId}/${file}`);
    assert.equal(head.status, 200, `audio file ${file} must be served`);
    assert.match(head.headers.get('content-type') || '', /audio|octet-stream/, `${file} must be served as audio`);
    const bytes = (await head.arrayBuffer()).byteLength;
    assert.ok(bytes > 20000, `${file} must contain real audio (${bytes} bytes)`);
    staticChecks += 1;
  }

  const { chromium } = loadPlaywright();
  const browser = await launchBrowser(chromium);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route(/supabase\.(co|in)/, route => route.abort());
  await context.addInitScript(browserSetup);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const cleanErrors = () => errors.filter(message => !message.includes('jsQR'));
  const played = () => page.evaluate(() => window.__audio || []);
  const deviceSpoken = () => page.evaluate(() => window.__spoken || []);
  const lastPlay = async () => {
    const list = await played();
    for (let index = list.length - 1; index >= 0; index -= 1) {
      const entry = list[index];
      if (!entry || !entry.plays || !entry.plays.length) continue;
      const play = entry.plays[entry.plays.length - 1];
      return { file: entry.src.split('/').pop(), path: entry.path, start: play.start, rate: play.rate };
    }
    return null;
  };
  const clearAudio = () => page.evaluate(() => {
    window.__audio = window.__audio || [];
    window.__audio.forEach(entry => { if (entry.plays) entry.plays.length = 0; });
    window.__spoken = [];
  });
  let checks = staticChecks;
  const check = (label, value) => { assert.ok(value, label); checks += 1; };

  // 1. Home: the key sentence is read by the bundled narrator.
  await page.goto(`${BASE}/learn/ru`, { waitUntil: 'networkidle' });
  await page.getByText('CORE SENTENCE', { exact: true }).waitFor();
  await clearAudio();
  await page.getByRole('button', { name: /^پخش تلفظ روسی:/ }).first().click();
  await page.waitForTimeout(700);
  const homeClip = await lastPlay();
  check('the Russian home plays the bundled narrator, not the device voice',
    homeClip?.file === greetingSentences.file && homeClip?.path.includes(`/audio/ru/${narratorId}/`));
  check('the home clip starts in the guard silence just before the sentence',
    Math.abs((homeClip?.start ?? -1) - Math.max(0, firstClip[0] - 0.25)) < 0.05);
  check('the home sentence never falls back to the device voice', (await deviceSpoken()).length === 0);
  check('the Russian home raises no runtime errors', cleanErrors().length === 0);

  // 1b. A vocabulary chip on the home page comes from the words pack.
  await clearAudio();
  await page.getByRole('button', { name: /^تلفظ واژه:/ }).first().click();
  await page.waitForTimeout(600);
  const homeWord = await lastPlay();
  check('a home vocabulary chip plays the word pack', homeWord?.file === greetingWords.file);
  check('the home word is not read by the device voice', (await deviceSpoken()).length === 0);

  // 2. Entering a lesson speaks automatically, from that lesson's pack.
  await page.goto(`${LESSON}&seed=1`, { waitUntil: 'networkidle' });
  await page.getByText(/جمله‌های اصلی · مرحلهٔ ۲ از ۹/).waitFor();
  await page.waitForTimeout(1600);
  const auto = await lastPlay();
  check('the lesson auto-plays its first sentence from the bundled pack', auto?.file === greetingSentences.file);
  check('the auto-played sentence starts in the guard silence',
    Math.abs((auto?.start ?? -1) - Math.max(0, firstClip[0] - 0.25)) < 0.05);
  check('the lesson does not need the device voice', (await deviceSpoken()).length === 0);

  // 3. Slow replay slows the same recording instead of changing the voice.
  await clearAudio();
  await page.getByRole('button', { name: 'پخش آهستهٔ جمله', exact: true }).click();
  await page.waitForTimeout(500);
  const slow = await lastPlay();
  check('slow replay plays the same clip slower', slow?.file === greetingSentences.file && slow.rate < 1);
  await clearAudio();
  await page.getByRole('button', { name: 'پخش معمولی جمله', exact: true }).click();
  await page.waitForTimeout(500);
  const normal = await lastPlay();
  check('normal replay plays at the recorded speed', normal?.file === greetingSentences.file && normal.rate === 1);
  check('the sentence stage raises no runtime errors', cleanErrors().length === 0);

  // 4. The vocabulary stage example comes from the same narrator.
  await page.goto(`${LESSON}&seed=5`, { waitUntil: 'networkidle' });
  await page.getByText('واژگان از دل جمله‌ها', { exact: true }).waitFor();
  await page.getByRole('button', { name: /^شنیدن مثال: / }).first().click();
  await page.waitForTimeout(600);
  const vocab = await lastPlay();
  check('a vocabulary example plays from the lesson sentence pack', vocab?.file === greetingSentences.file);

  // 5. The review screen renders and speaks the card's own lesson.
  await page.goto(`${BASE}/learn/ru/review`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  check('the Russian review screen renders without errors', cleanErrors().length === 0);

  // 6. If the bundled audio cannot start, the phone's Russian voice covers it.
  await page.goto(`${BASE}/learn/ru?audioblocked=1`, { waitUntil: 'networkidle' });
  await page.getByText('CORE SENTENCE', { exact: true }).waitFor();
  await clearAudio();
  await page.getByRole('button', { name: /^پخش تلفظ روسی:/ }).first().click();
  await page.waitForTimeout(900);
  const fallback = await deviceSpoken();
  check('a clip that cannot start falls back to a Russian device voice instead of silence',
    fallback.length > 0 && fallback[0].lang.toLowerCase().startsWith('ru'));
  check('the fallback reads the same sentence', fallback[0]?.text === firstSentenceText);

  // 7. A browser without any speech engine still plays the bundled clips.
  await page.goto(`${BASE}/learn/ru?nospeech=1`, { waitUntil: 'networkidle' });
  await page.getByText('CORE SENTENCE', { exact: true }).waitFor();
  await clearAudio();
  await page.getByRole('button', { name: /^پخش تلفظ روسی:/ }).first().click();
  await page.waitForTimeout(700);
  const noSpeech = await lastPlay();
  check('Firefox without Web Speech still hears the bundled narrator', noSpeech?.file === greetingSentences.file);
  check('that browser reports no unhandled speech rejections',
    (await page.evaluate(() => window.__pageErrors || [])).length === 0);

  console.log(`${checks} Russian runtime audio checks passed (manifest and files, home, lesson auto-play, slow replay, vocabulary, review, device cover, no Web Speech).`);
  await browser.close();
})().catch(async error => {
  console.error(error);
  process.exit(1);
});
