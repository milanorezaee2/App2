#!/usr/bin/env node
/**
 * Runtime proof for the German lesson audio.
 *
 * The German course ships its own voice (`public/audio/de`), so the lessons must
 * sound German even on a phone whose system voices are English-only, and even in
 * a browser without any Web Speech support (Firefox for Android). This test
 * drives the built web export in Chromium and records:
 *
 *   - which bundled clip is requested (file + start offset) for every playback,
 *   - whether the device speech engine was touched at all,
 *   - and what happens when the bundled audio cannot be loaded (fallback).
 *
 * Browser playback is faked with a deterministic `Audio` element: headless
 * Chromium has no MP3 codec in every build, and the point of the test is the
 * wiring between the lesson UI and the shipped audio, not the decoder.
 *
 *   npm run build:web
 *   npm run serve:web
 *   NODE_PATH=/path/to/playwright/node_modules node scripts/verify-german-runtime.cjs
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
 * Runs before every document.
 *   ?seed=5       start the greetings lesson on a given stage
 *   ?english=1    expose only an English system voice
 *   ?novoices=1   expose no system voices at all (like Firefox for Android)
 */
function browserSetup() {
  const params = new URLSearchParams(location.search);
  window.__audioBlocked = params.get('audioblocked') === '1';
  const seed = params.get('seed');
  if (seed !== null && /^\d$/.test(seed)) {
    try {
      window.localStorage.setItem('german_lesson_study_v1', JSON.stringify({
        schema: 1,
        sessions: {
          'de-v2-greetings': { stage: Number(seed), sentenceIndex: 0, answers: {}, showCheckAnswers: false },
        },
      }));
    } catch { /* storage disabled */ }
  }

  // --- device speech (should stay unused while the bundled audio works) ---
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
  const germanVoice = { name: 'Google Deutsch', lang: 'de-DE', localService: false, default: true, voiceURI: 'Google Deutsch' };
  const englishVoice = { name: 'English United States', lang: 'en-US', localService: true, default: false, voiceURI: 'English United States' };
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      getVoices: () => (params.get('novoices') === '1' ? [] : params.get('english') === '1' ? [englishVoice] : [germanVoice, englishVoice]),
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
      this.__record.plays.push({ start: this.currentTime, rate: this.playbackRate });
      if (window.__audioBlocked) return Promise.reject(new Error('NotSupportedError'));
      this.paused = false;
      this.dispatchEvent(new Event('playing'));
      return Promise.resolve();
    }

    pause() {
      this.paused = true;
    }

    load() { /* no-op */ }
  }
  window.Audio = FakeAudio;
}

const BASE = process.env.BROWSER_BASE_URL || 'http://127.0.0.1:8081';
const LESSON = `${BASE}/learn/de/lesson?id=de-v2-greetings`;

(async () => {
  const response = await fetch(`${BASE}/App1/audio/de/manifest.json`).catch(() => null);
  const manifest = response && response.ok ? await response.json() : null;
  assert.ok(manifest, 'the German audio manifest must be served from /audio/de/manifest.json');
  const greetingSentences = manifest.lessons['de-v2-greetings'].sentences;
  const greetingWords = manifest.lessons['de-v2-greetings'].words;

  // --- shipped files really exist ---
  const sampleFiles = [greetingSentences.file, greetingWords.file, ...Object.keys(manifest.lessons).map(id => manifest.lessons[id].sentences.file).slice(0, 3)];
  let staticChecks = 0;
  for (const file of sampleFiles) {
    const head = await fetch(`${BASE}/App1/audio/de/${file}`);
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
  // Audio elements are cached by the app, so clearing the array would lose the
  // mapping between an element and its later plays. Mark a boundary instead.
  const clearAudio = () => page.evaluate(() => {
    window.__audio = window.__audio || [];
    window.__audio.forEach(entry => { if (entry.plays) entry.plays.length = 0; });
    window.__spoken = [];
  });
  let checks = staticChecks;
  const check = (label, value) => { assert.ok(value, label); checks += 1; };

  // 0. The shipped MP3s must really decode in this browser, not just exist.
  await page.goto(`${BASE}/learn/de/audio-check`, { waitUntil: 'networkidle' });
  await page.evaluate(() => { window.__audio = []; window.__spoken = []; });
  const decode = await page.evaluate(async file => {
    const el = document.createElement('audio');
    el.src = `/App1/audio/de/${file}`;
    el.preload = 'auto';
    const loaded = await new Promise(resolve => {
      el.addEventListener('loadedmetadata', () => resolve(el.duration), { once: true });
      el.addEventListener('error', () => resolve(-1), { once: true });
      setTimeout(() => resolve(-2), 8000);
    });
    return loaded;
  }, greetingSentences.file);
  check('the bundled German MP3 decodes in the browser', typeof decode === 'number' && decode > 1);
  const playResult = await page.evaluate(async file => {
    const el = document.createElement('audio');
    el.src = `/App1/audio/de/${file}`;
    el.currentTime = 0.12;
    try {
      await el.play();
      await new Promise(resolve => setTimeout(resolve, 600));
      const advanced = el.currentTime;
      el.pause();
      return advanced;
    } catch (error) {
      return -1;
    }
  }, greetingSentences.file);
  check('the bundled German MP3 really advances during playback', typeof playResult === 'number' && playResult > 0.12);

  // 1. Home: the key sentence is played from the bundled German pack.
  await page.goto(`${BASE}/learn/de`, { waitUntil: 'networkidle' });
  await page.getByText('Deutsch Journey', { exact: true }).waitFor();
  await clearAudio();
  await page.getByRole('button', { name: /^پخش تلفظ آلمانی:/ }).first().click();
  await page.waitForTimeout(600);
  const homeClip = await lastPlay();
  check('German home plays the bundled German audio, not the device voice',
    homeClip?.file === greetingSentences.file);
  check('the home clip starts at the recorded offset for "Hallo!"',
    Math.abs((homeClip?.start ?? -1) - greetingSentences.clips['hallo!'][0]) < 0.05);
  check('the home sentence never falls back to the device voice',
    (await deviceSpoken()).length === 0);
  check('German home raises no runtime errors', cleanErrors().length === 0);

  // 2. Entering a lesson speaks automatically.
  await page.goto(LESSON, { waitUntil: 'networkidle' });
  await page.getByText(/موقعیت · مرحلهٔ ۱ از ۹/).waitFor();
  await page.waitForTimeout(2000);
  const stage0 = await lastPlay();
  check('the situation stage auto-plays the first German sentence', stage0?.file === greetingSentences.file);
  check('the situation stage does not need the device voice', (await deviceSpoken()).length === 0);
  check('the situation stage exposes tappable key words',
    await page.getByRole('button', { name: /^پخش واژهٔ آلمانی:/ }).count() > 0);

  // 3. Tapping a word plays that word from the vocabulary pack.
  const wordButton = page.getByRole('button', { name: /^پخش واژهٔ آلمانی:/ }).first();
  const wordLabel = await wordButton.getAttribute('aria-label');
  const word = (wordLabel || '').split(':').pop().trim().toLowerCase();
  await clearAudio();
  await wordButton.click();
  await page.waitForTimeout(500);
  const wordClip = await lastPlay();
  check('tapping a German word plays the word clip from the lesson vocabulary pack',
    wordClip?.file === greetingWords.file && greetingWords.clips[word] !== undefined);
  check('the word clip uses the recorded start of that word',
    Math.abs((wordClip?.start ?? -1) - greetingWords.clips[word][0]) < 0.05);
  check('the tapped word is not read by the device voice', (await deviceSpoken()).length === 0);

  // 4. Core sentence stage: natural playback, then slow replay.
  await clearAudio();
  await page.getByRole('button', { name: 'ادامه', exact: true }).click();
  await page.getByText(/جمله‌های اصلی · مرحلهٔ ۲ از ۹/).waitFor();
  await page.waitForTimeout(1800);
  const natural = await lastPlay();
  check('the core-sentence stage auto-plays the sentence at natural speed',
    natural?.file === greetingSentences.file && natural?.rate === 1);

  await clearAudio();
  await page.getByRole('button', { name: 'پخش آهستهٔ جمله' }).click();
  await page.waitForTimeout(500);
  const slow = await lastPlay();
  check('slow replay slows the same clip down instead of changing the voice',
    slow?.file === greetingSentences.file && slow.rate < 1);
  check('the core-sentence stage raises no runtime errors', cleanErrors().length === 0);

  // 5. Vocabulary stage: first word is automatic, play-all walks the words.
  await page.goto(`${LESSON}&seed=5`, { waitUntil: 'networkidle' });
  await page.getByText(/واژگان از جمله · مرحلهٔ ۶ از ۹/).waitFor();
  await page.waitForTimeout(1600);
  const firstWord = await lastPlay();
  check('the vocabulary stage auto-plays its first word from the word pack',
    firstWord?.file === greetingWords.file);
  check('the vocabulary stage offers a play-all-words control',
    await page.getByRole('button', { name: 'پخش واژه‌های این صفحه' }).count() === 1);
  await clearAudio();
  await page.getByRole('button', { name: 'پخش واژه‌های این صفحه' }).click();
  await page.waitForTimeout(2500);
  const sequence = await played();
  const starts = sequence.flatMap(entry => entry.plays.map(play => play.start));
  check('play-all walks several different German words', new Set(starts).size >= 2);
  check('every play-all clip comes from the vocabulary pack',
    sequence.every(entry => entry.file === greetingWords.file || entry.src.endsWith('.words.mp3')));

  // 6. The audio-check page demonstrates the bundled voice.
  await page.goto(`${BASE}/learn/de/audio-check`, { waitUntil: 'networkidle' });
  await page.getByText('بررسی و انتخاب صدای آلمانی', { exact: true }).waitFor();
  await page.waitForTimeout(900);
  check('audio-check presents the in-app German voice', (await page.locator('body').innerText()).includes('صدای آلمانی داخلی برنامه'));
  await clearAudio();
  await page.getByRole('button', { name: /^شنیدن نمونه:/ }).first().click();
  await page.waitForTimeout(600);
  const sample = await lastPlay();
  check('audio-check plays the bundled sample', sample?.file === greetingSentences.file);
  check('audio-check still lists the optional device voices',
    await page.getByRole('button', { name: /Google Deutsch/ }).count() >= 1);
  check('audio-check raises no runtime errors', cleanErrors().length === 0);

  // 7. Review screen renders on its own route.
  await page.goto(`${BASE}/learn/de/review`, { waitUntil: 'networkidle' });
  await page.getByText('مرور آلمانی', { exact: true }).waitFor();
  check('German review screen renders on its own route', true);

  // 8. A browser with no system voices at all (Firefox for Android) still speaks German.
  await page.goto(`${LESSON}&seed=1&novoices=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2200);
  const noVoices = await lastPlay();
  check('with no system voices the lesson still plays German audio',
    noVoices?.file === greetingSentences.file);
  check('no system voices means no device speech attempts at all', (await deviceSpoken()).length === 0);

  // 9. Fallback A: the clips are missing (pack not deployed). The device voice
  //    takes over with the German language tag - never the English default.
  await context.route(/\/audio\/de\//, route => route.abort());
  await page.goto(`${LESSON}&seed=1&english=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2600);
  const fallbackCalls = await deviceSpoken();
  check('when the bundled clips are missing the lesson falls back to the device',
    fallbackCalls.length >= 1);
  check('the fallback asks for German and never sends the English voice',
    fallbackCalls.every(item => String(item.lang).toLowerCase().startsWith('de') && !/english/i.test(item.voice || '')));
  check('the lesson stays readable when audio cannot load',
    (await page.locator('body').innerText()).includes('جمله‌های اصلی · مرحلهٔ ۲ از ۹'));
  await context.unroute(/\/audio\/de\//);

  // 9b. The learner can switch to the device voice from the audio-check page.
  await page.goto(`${BASE}/learn/de/audio-check`, { waitUntil: 'networkidle' });
  await page.getByText('بررسی و انتخاب صدای آلمانی', { exact: true }).waitFor();
  await page.waitForTimeout(800);
  check('audio-check offers the in-app voice as the default choice',
    await page.getByRole('button', { name: /صدای داخلی برنامه/ }).count() >= 1);
  await page.getByRole('button', { name: /صدای آلمانی دستگاه/ }).first().click();
  await page.waitForTimeout(200);
  await page.goto(LESSON, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2400);
  const deviceMode = await deviceSpoken();
  check('after choosing the device voice the lesson asks the device engine for German',
    deviceMode.length >= 1 && deviceMode.every(item => String(item.lang).toLowerCase().startsWith('de')));
  await page.evaluate(() => window.localStorage.removeItem('german_voice_source_v1'));

  // 10. Fallback B: the files load but this browser cannot decode them.
  await page.goto(`${LESSON}&seed=1&english=1&audioblocked=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2600);
  const decodeFallback = await deviceSpoken();
  check('when this browser cannot decode the clips the device voice takes over',
    decodeFallback.length >= 1);
  check('the decode fallback still asks for German',
    decodeFallback.every(item => String(item.lang).toLowerCase().startsWith('de')));

  console.log(`${checks} German runtime audio checks passed (manifest and files, home, situation, core sentences, slow replay, vocabulary, play-all, audio-check, review, no-system-voice, fallback).`);
  await browser.close();
})().catch(async error => {
  console.error(error);
  process.exit(1);
});
