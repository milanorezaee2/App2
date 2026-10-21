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
const { readFileSync } = require('node:fs');
const path = require('node:path');

const toPersianDigits = value => String(value).replace(/[0-9]/g, digit => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);

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
 *   ?novoices=1   expose no system voices at all
 *   ?nospeech=1   remove the Web Speech API entirely (Firefox for Android)
 *   ?source=auto  clear any voice choice saved by an older build
 *   ?source=device  plant an old "always the device voice" choice, to prove it is ignored
 *   ?audioblocked=1  the browser cannot decode the bundled MP3s
 */
function browserSetup() {
  const params = new URLSearchParams(location.search);
  window.__audioBlocked = params.get('audioblocked') === '1';
  // ?nospeech=1 removes the Web Speech API entirely (Firefox for Android).
  const noSpeech = params.get('nospeech') === '1';
  // ?source=auto clears an old saved choice; ?source=device plants one so the
  // test can prove the packaged narrator still wins.
  const source = params.get('source');
  if (source) {
    try {
      if (source === 'auto') window.localStorage.removeItem('german_voice_source_v1');
      else window.localStorage.setItem('german_voice_source_v1', source);
    } catch { /* storage disabled */ }
  }
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
  const germanVoice = { name: 'Google Deutsch', lang: 'de-DE', localService: false, default: true, voiceURI: 'Google Deutsch' };
  const englishVoice = { name: 'English United States', lang: 'en-US', localService: true, default: false, voiceURI: 'English United States' };
  if (!noSpeech) Object.defineProperty(window, 'speechSynthesis', {
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
  await page.goto(`${BASE}/learn/de?source=app`, { waitUntil: 'networkidle' });
  await page.getByText('Deutsch Journey', { exact: true }).waitFor();
  await clearAudio();
  await page.getByRole('button', { name: /^پخش تلفظ آلمانی:/ }).first().click();
  await page.waitForTimeout(600);
  const homeClip = await lastPlay();
  check('German home plays the bundled German audio, not the device voice',
    homeClip?.file === greetingSentences.file);
  // The pack keeps 0.25 s of silence before the speech; playback starts inside
  // it so a late seek can never land on the neighbouring sentence.
  check('the home clip starts in the guard silence just before "Hallo!"',
    Math.abs((homeClip?.start ?? -1) - (greetingSentences.clips['hallo!'][0] - 0.25)) < 0.05);
  check('the home sentence never falls back to the device voice',
    (await deviceSpoken()).length === 0);
  check('German home raises no runtime errors', cleanErrors().length === 0);

  // 2. Entering a lesson speaks automatically.
  await page.goto(`${LESSON}&source=app`, { waitUntil: 'networkidle' });
  await page.getByText(/موقعیت · مرحلهٔ ۱ از ۹/).waitFor();
  await page.waitForTimeout(2000);
  const stage0 = await lastPlay();
  check('the situation stage auto-plays the first German sentence', stage0?.file === greetingSentences.file);
  check('the situation stage does not need the device voice', (await deviceSpoken()).length === 0);
  // The situation stage now follows the Russian layout exactly: promise card and
  // the Persian teaching note, instead of the German-only word preview card.
  const stage0Text = await page.locator('body').innerText();
  check('the situation stage shows the lesson promise like Russian',
    stage0Text.includes('در پایان این درس می‌توانید'));
  check('the situation stage keeps its Persian teaching note',
    stage0Text.includes('نکتهٔ آلمانی به فارسی'));

  // 3. A vocabulary word plays from the lesson's word pack (audio-check page).
  await page.goto(`${BASE}/learn/de/audio-check`, { waitUntil: 'networkidle' });
  const wordButton = page.getByRole('button', { name: /^شنیدن یک واژه: / }).first();
  // react-native-web renders this button's label as visible text, not aria-label.
  const wordLabel = (await wordButton.innerText()).trim();
  const word = (wordLabel || '').split(':').pop().trim().toLowerCase();
  await clearAudio();
  await wordButton.click();
  await page.waitForTimeout(500);
  const wordClip = await lastPlay();
  check('tapping a German word plays the word clip from the lesson vocabulary pack',
    wordClip?.file === greetingWords.file && greetingWords.clips[word] !== undefined);
  // The element is cached and may be re-seeked, so accept every play recorded
  // for the word pack and require that the word's own offset appears.
  const tappedWordPlays = await page.evaluate(file =>
    (window.__audio || []).filter(entry => entry.src.endsWith(file)).flatMap(entry => entry.plays || []),
    greetingWords.file);
  check('the word clip starts in the guard silence before that word',
    tappedWordPlays.some(play => Math.abs(play.start - Math.max(0, greetingWords.clips[word][0] - 0.25)) < 0.05));
  check('the tapped word is not read by the device voice', (await deviceSpoken()).length === 0);

  // Back into the lesson for the remaining stages.
  await page.goto(`${LESSON}&source=app`, { waitUntil: 'networkidle' });
  await page.getByText(/موقعیت · مرحلهٔ ۱ از ۹/).waitFor();
  await page.waitForTimeout(1200);

  // 4. Core sentence stage: natural playback, then slow replay.
  await clearAudio();
  await page.getByRole('button', { name: 'ادامه', exact: true }).click();
  await page.getByText(/جمله‌های اصلی · مرحلهٔ ۲ از ۹/).waitFor();
  await page.waitForTimeout(1800);
  const natural = await lastPlay();
  check('the core-sentence stage auto-plays the sentence at natural speed',
    natural?.file === greetingSentences.file && natural?.rate === 1);

  // The sentence must be audible for its full recorded length: a stop timer that
  // starts before playback (or a missing tail) cuts the last word and makes the
  // narrator sound choppy.
  const sentenceTiming = await page.evaluate(theFile => {
    const entry = (window.__audio || []).find(item => item.src.endsWith('/' + theFile));
    if (!entry || !entry.plays || !entry.plays.length) return null;
    const play = entry.plays[entry.plays.length - 1];
    const stop = (entry.stops || []).find(at => at >= play.at);
    return stop ? stop - play.at : null;
  }, greetingSentences.file);
  const spokenClip = Object.values(greetingSentences.clips)
    .find(range => Math.abs((range[0] - 0.25) - (natural?.start ?? -1)) < 0.05);
  check('the sentence is allowed to finish instead of being cut off mid-word',
    typeof sentenceTiming === 'number' && !!spokenClip
      && sentenceTiming >= (spokenClip[1] - spokenClip[0]) * 1000 * 0.9);

  await clearAudio();
  await page.getByRole('button', { name: 'پخش آهستهٔ جمله', exact: true }).click();
  await page.waitForTimeout(500);
  const slow = await lastPlay();
  check('slow replay slows the same clip down instead of changing the voice',
    slow?.file === greetingSentences.file && slow.rate < 1);

  // The speaker icon itself starts slow: the learner asked to hear the sentence
  // read slowly on the first tap and at the normal pace on the second.
  await page.goto(`${LESSON}&seed=1&source=app`, { waitUntil: 'networkidle' });
  await page.getByText(/جمله‌های اصلی · مرحلهٔ ۲ از ۹/).waitFor();
  await page.waitForTimeout(1800);
  const iconLabel = await page.getByRole('button', { name: /^پخش .*جملهٔ آلمانی$/ }).first().getAttribute('aria-label');
  check('the lesson speaker icon offers the slow reading first',
    /^پخش آهستهٔ جملهٔ آلمانی$/.test(iconLabel || ''));
  await clearAudio();
  await page.getByRole('button', { name: 'پخش آهستهٔ جملهٔ آلمانی', exact: true }).click();
  await page.waitForTimeout(500);
  const firstTap = await lastPlay();
  check('the first tap of the speaker icon plays the slow reading',
    firstTap?.file === greetingSentences.file && firstTap.rate < 1);
  await clearAudio();
  await page.getByRole('button', { name: 'پخش معمولی جملهٔ آلمانی', exact: true }).click();
  await page.waitForTimeout(500);
  const secondTap = await lastPlay();
  check('the second tap of the speaker icon plays the normal reading',
    secondTap?.file === greetingSentences.file && secondTap.rate === 1);

  check('the core-sentence stage raises no runtime errors', cleanErrors().length === 0);

  // 5. Vocabulary stage: first word is automatic, play-all walks the words.
  await page.goto(`${LESSON}&seed=5&source=app`, { waitUntil: 'networkidle' });
  await page.getByText(/واژگان از جمله · مرحلهٔ ۶ از ۹/).waitFor();
  await page.waitForTimeout(1600);
  const firstWord = await lastPlay();
  check('the vocabulary stage auto-plays its first word from the word pack',
    firstWord?.file === greetingWords.file);
  check('the vocabulary stage offers a play-all-words control',
    await page.getByRole('button', { name: 'پخش واژه‌های این صفحه' }).count() === 1);
  await clearAudio();
  await page.getByRole('button', { name: 'پخش واژه‌های این صفحه' }).click();
  await page.waitForTimeout(4200);
  const sequence = await played();
  const starts = sequence.flatMap(entry => entry.plays.map(play => play.start));
  check('play-all walks several different German words', new Set(starts).size >= 2);
  const wordPlays = sequence.flatMap(entry => entry.plays).sort((left, right) => left.at - right.at);
  const wordGaps = wordPlays.slice(1).map((play, index) => play.at - wordPlays[index].at);
  // Words glued together read as one rushed, chopped stream; a short breath
  // between them is what makes the list sound spoken instead of clipped.
  check('play-all leaves a short breath between words instead of gluing them together',
    wordGaps.length > 0 && wordGaps.every(gap => gap >= 220));
  check('every play-all clip comes from the vocabulary pack',
    sequence.every(entry => entry.file === greetingWords.file || entry.src.endsWith('.words.mp3')));

  // 6. The audio-check page demonstrates the bundled voice.
  await page.goto(`${BASE}/learn/de/audio-check`, { waitUntil: 'networkidle' });
  await page.getByText('صدای آلمانی', { exact: true }).waitFor();
  await page.waitForTimeout(900);
  const audioCheckText = await page.locator('body').innerText();
  const narratorPreset = JSON.parse(readFileSync(path.join(__dirname, '..', 'config', 'german-narrator.json'), 'utf8'));
  const persianTempo = `${toPersianDigits(narratorPreset.wordsPerMinute)} کلمه در دقیقه`;
  check('audio-check presents the one German narrator', audioCheckText.includes('۱. گویندهٔ آلمانی درس‌ها'));
  check('audio-check names the narrator tempo from the preset', audioCheckText.includes(persianTempo));
  check('audio-check offers no device voice picker',
    !audioCheckText.includes('صدای آلمانی دستگاه') || audioCheckText.includes('حذف شده است'));
  await clearAudio();
  await page.getByRole('button', { name: /^شنیدن یک جمله:/ }).first().click();
  await page.waitForTimeout(600);
  const sample = await lastPlay();
  check('audio-check plays the bundled sample', sample?.file === greetingSentences.file);
  check('audio-check no longer lists the optional device voices',
    await page.getByRole('button', { name: /Google Deutsch/ }).count() === 0);
  await clearAudio();
  await page.getByRole('button', { name: /^شنیدن یک واژه:/ }).first().click();
  await page.waitForTimeout(600);
  const wordSample = await lastPlay();
  check('audio-check plays a bundled word from the same narrator', wordSample?.file === greetingWords.file);
  check('audio-check raises no runtime errors', cleanErrors().length === 0);

  // 7. Review screen renders on its own route.
  await page.goto(`${BASE}/learn/de/review`, { waitUntil: 'networkidle' });
  await page.getByText('مرور آلمانی', { exact: true }).waitFor();
  check('German review screen renders on its own route', true);

  // 8. A browser with no system voices at all (Firefox for Android) still speaks German.
  await page.goto(`${LESSON}&seed=1&novoices=1&source=auto`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2200);
  const noVoices = await lastPlay();
  check('with no system voices the lesson still plays German audio',
    noVoices?.file === greetingSentences.file);
  check('no system voices means no device speech attempts at all', (await deviceSpoken()).length === 0);

  // 9. Fallback A: the clips are missing (pack not deployed). The device voice
  //    takes over with the German language tag - never the English default.
  await context.route(/\/audio\/de\//, route => route.abort());
  await page.goto(`${LESSON}&seed=1&english=1&source=auto`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2600);
  const fallbackCalls = await deviceSpoken();
  check('when the bundled clips are missing the lesson falls back to the device',
    fallbackCalls.length >= 1);
  check('the fallback asks for German and never sends the English voice',
    fallbackCalls.every(item => String(item.lang).toLowerCase().startsWith('de') && !/english/i.test(item.voice || '')));
  check('the lesson stays readable when audio cannot load',
    (await page.locator('body').innerText()).includes('جمله‌های اصلی · مرحلهٔ ۲ از ۹'));
  await context.unroute(/\/audio\/de\//);

  // 9b. A voice choice saved by an older build is deleted, and the lesson keeps
  //     playing the packaged narrator instead of switching to the phone voice.
  await page.evaluate(() => {
    window.localStorage.setItem('german_voice_source_v1', 'device');
    window.localStorage.setItem('german_voice_preference_v1', 'Google Deutsch');
  });
  await page.goto(`${BASE}/learn/de/audio-check`, { waitUntil: 'networkidle' });
  await page.getByText('صدای آلمانی', { exact: true }).waitFor();
  await page.waitForTimeout(800);
  check('opening the voice page deletes a choice saved by an older build',
    await page.evaluate(() => window.localStorage.getItem('german_voice_source_v1') === null
      && window.localStorage.getItem('german_voice_preference_v1') === null));
  check('the voice page offers nothing to switch away from the narrator',
    await page.getByRole('button', { name: /صدای آلمانی دستگاه|صدای داخلی برنامه|گویندهٔ انتخاب‌شده/ }).count() === 0);
  await page.evaluate(() => window.localStorage.setItem('german_voice_source_v1', 'device'));
  await page.goto(LESSON, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2600);
  const staleChoice = await deviceSpoken();
  const stalePlay = await lastPlay();
  check('a stale device choice cannot replace the narrator on a lesson screen',
    stalePlay?.file === greetingSentences.file && !staleChoice.some(item => item.text === 'Hallo!'));
  await page.evaluate(() => window.localStorage.removeItem('german_voice_source_v1'));

  // 10. Fallback B: the files load but this browser cannot decode them.
  await page.goto(`${LESSON}&seed=1&english=1&audioblocked=1&source=auto`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2600);
  const decodeFallback = await deviceSpoken();
  check('when this browser cannot decode the clips the device voice takes over',
    decodeFallback.length >= 1);
  check('the decode fallback still asks for German',
    decodeFallback.every(item => String(item.lang).toLowerCase().startsWith('de')));

  // 11. Automatic mode: the narrator the learner chose plays on every phone,
  //     even when a German system voice is installed (the voice must not change
  //     from device to device).
  await page.goto(`${LESSON}&seed=1&source=auto`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2600);
  const autoDevice = await deviceSpoken();
  const autoPlay = await lastPlay();
  check('automatic mode plays the chosen narrator instead of a different device voice',
    autoPlay?.file === greetingSentences.file && !autoDevice.some(item => item.text === 'Hallo!'));
  check('automatic mode never sends the English voice', autoDevice.every(item => !/english/i.test(item.voice || '')));

  // 12. Firefox for Android: there is no Web Speech API at all. The bundled
  //     German audio must still play and nothing may throw. A single browser
  //     context is reused on purpose (@sparticuz Chromium runs single-process).
  const noSpeechErrors = [];
  const onNoSpeechError = error => noSpeechErrors.push(error.message);
  page.on('pageerror', onNoSpeechError);
  for (const route of [
    '/learn/de?source=auto&nospeech=1',
    '/learn/de/audio-check?nospeech=1',
    '/learn/de/review?nospeech=1',
  ]) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
  }
  await page.goto(`${BASE}${LESSON.replace(BASE, '')}&seed=1&source=auto&nospeech=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2800);
  const silentAudio = await page.evaluate(() => window.__audio || []);
  const silentPlays = silentAudio.reduce((total, entry) => total + entry.plays.length, 0);
  check('without any Web Speech API the lesson still plays the German audio', silentPlays >= 1);
  check('the browser without Web Speech never touches a missing engine', noSpeechErrors.length === 0);
  check('that browser also reports no unhandled speech rejections',
    (await page.evaluate(() => window.__pageErrors || [])).length === 0);
  check('the lesson stays readable without Web Speech',
    (await page.locator('body').innerText()).includes('جمله‌های اصلی · مرحلهٔ ۲ از ۹'));
  page.off('pageerror', onNoSpeechError);

  console.log(`${checks} German runtime audio checks passed (manifest and files, home, situation, core sentences, slow replay, vocabulary, play-all, audio-check, review, automatic voice choice, no-system-voice, Firefox without Web Speech, fallback).`);
  await browser.close();
})().catch(async error => {
  console.error(error);
  process.exit(1);
});
