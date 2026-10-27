#!/usr/bin/env node
// Optional isolated browser integration test. Real onboarding/report components,
// fake auth/access boundary only: never signs into a real account or backend.
// Install playwright and @sparticuz/chromium outside app dependencies and set
// JOURNEY_BROWSER_DEPS to that installation (defaults to the ignored cache).
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import os from 'node:os';

const root = fileURLToPath(new URL('../', import.meta.url));
const cache = path.join(root, 'node_modules/.cache/journey-browser');
mkdirSync(cache, { recursive: true });
const deps = process.env.JOURNEY_BROWSER_DEPS || path.join(cache, 'deps');
const require = createRequire(path.join(deps, 'package.json'));
const { chromium } = require('playwright');
const chromiumPath = require.resolve('@sparticuz/chromium');
const pack = await import(pathToFileURL(chromiumPath));
await pack.inflate(path.resolve(path.dirname(chromiumPath), '../bin/al2023.tar.br'));
pack.setupLambdaEnvironment(path.join(os.tmpdir(), 'al2023/lib'));
const bundle = await build({
  stdin: { resolveDir: root, loader: 'tsx', contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {LearnerJourneyGate} from './components/LearnerJourneyGate';
    import {SENTENCE_LESSONS} from './lib/courseContent';window.__lessonIds=SENTENCE_LESSONS.slice(0,2).map(x=>x.id);
    import Journey from './app/journey'; import {TestAccess} from '@/components/LearnerLanguageAccess';
    createRoot(document.getElementById('root')).render(<TestAccess><LearnerJourneyGate><Journey/></LearnerJourneyGate></TestAccess>);
  ` },
  bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', logLevel: 'silent',
  define: { 'process.env.NODE_ENV': '"production"' }, alias: { 'react-native': 'react-native-web' },
  plugins: [{ name: 'isolated-auth-and-access', setup(b) {
    const stubs = {
      features: `export const MANAGEMENT_BUILD=false; export const FEATURES={learnerLogin:true,englishCourse:true,germanCourse:true,turkishCourse:true,russianCourse:false};`,
      access: `import React,{useState,useContext,createContext} from 'react';
        const C=createContext(null); const languages=[{id:'en',name:'انگلیسی',nativeName:'English',home:'/lang',lessonsCount:174},{id:'de',name:'آلمانی',nativeName:'Deutsch',home:'/learn/de',lessonsCount:95},{id:'tr',name:'ترکی استانبولی',nativeName:'Türkçe',home:'/learn/tr',lessonsCount:66}];
        export function TestAccess({children}){const [ids,setIds]=useState(['en','de','tr']);window.__allow=setIds;return <C.Provider value={{allowedLanguages:languages.filter(x=>ids.includes(x.id)),isLanguageAllowed:id=>ids.includes(id),loadingAccess:false,allDisabledByAdmin:!ids.length,disabledMessage:'همهٔ زبان‌ها غیرفعال‌اند',refreshAccess:async()=>{}}}>{children}</C.Provider>}
        export const useLearnerLanguageAccess=()=>useContext(C);`,
      router: `import {useEffect} from 'react';const router={push(value){(window.__routes??=[]).push(value)},replace(value){(window.__routes??=[]).push(value)}}; export const useRouter=()=>router; export const useFocusEffect=cb=>useEffect(cb,[cb]);export const Redirect=()=>null;`,
      supabase: `const listeners=new Set();let session={user:{id:'A',email:'test@example.invalid',is_anonymous:false}};window.__account=id=>{session=id?{user:{id,email:'test@example.invalid',is_anonymous:false}}:null;for(const fn of listeners)fn('SIGNED_IN',session)};
        export const supabase={auth:{async getSession(){return {data:{session},error:null}},onAuthStateChange(fn){listeners.add(fn);return {data:{subscription:{unsubscribe(){listeners.delete(fn)}}}}},async signOut(){window.__account(null)}}};`,
      storage: `export default {getItem:async k=>localStorage.getItem(k),setItem:async(k,v)=>localStorage.setItem(k,v)};`,
      gradient: `import React from 'react';import {View} from 'react-native';export function LinearGradient({colors,start,end,...props}){return <View {...props} style={[props.style,{backgroundColor:colors[0]}]}/>}`,
      constants: `export default {expoConfig:{extra:{}}};`,
    };
    b.onResolve({ filter: /(?:^|\/)(features|supabase|LearnerLanguageAccess)$|^(expo-router|expo-linear-gradient|expo-constants|@react-native-async-storage\/async-storage)$/ }, args => {
      const key = args.path.endsWith('features') ? 'features' : args.path.endsWith('supabase') ? 'supabase' : args.path.endsWith('LearnerLanguageAccess') ? 'access' : ({'expo-router':'router','expo-linear-gradient':'gradient','expo-constants':'constants','@react-native-async-storage/async-storage':'storage'})[args.path];
      return { path: key, namespace: 'fixture' };
    });
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: stubs[args.path], loader: 'tsx', resolveDir: root }));
  } }],
});
writeFileSync(path.join(cache, 'app.js'), bundle.outputFiles[0].text);
const font = path.join(root, 'node_modules/@expo-google-fonts/vazirmatn/400Regular/Vazirmatn_400Regular.ttf');
const html = `<!doctype html><html><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
@font-face{font-family:Vazir;src:url('/font.ttf')}@font-face{font-family:Vazir-Bold;src:url('/font.ttf')}@font-face{font-family:Vazir-Black;src:url('/font.ttf')}html,body,#root{height:100%;margin:0}</style><div id="root"></div><script src="/app.js"></script></html>`;
const server = createServer((req, res) => {
  if (req.url === '/app.js') { res.setHeader('Content-Type', 'application/javascript'); res.end(bundle.outputFiles[0].text); }
  else if (req.url === '/font.ttf') { res.setHeader('Content-Type', 'font/ttf'); res.end(readFileSync(font)); }
  else { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); }
});
await new Promise(resolve => server.listen(0, '0.0.0.0', resolve));
const browser = await chromium.launch({ headless: true, executablePath: await pack.default.executablePath(), args: pack.default.args });
try {
  const page = await browser.newPage({ viewport: { width: 360, height: 800 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const url = `http://127.0.0.1:${server.address().port}`;
  const button = label => page.getByRole('button', { name: label, exact: true });
  const radio = label => page.getByRole('radio', { name: label, exact: false });
  const heading = label => page.getByRole('heading', { name: label, exact: true });
  const next = () => button('ادامه').click();
  let passed = 0;
  const check = async (name, fn) => { await fn(); passed++; console.log('PASS', name); };
  await page.goto(url);
  await heading('دوست داری چه زبانی یاد بگیری؟').waitFor();
  await check('fresh authenticated learner cannot skip language selection', async () => assert(await button('ادامه').isDisabled()));
  await radio('ترکی استانبولی').click(); await next();
  await check('familiarity required independently from language', async () => { await heading('چقدر با این زبان آشنایی داری؟').waitFor(); assert(await button('ادامه').isDisabled()); });
  await radio('در موقعیت‌های روزمره ارتباط می‌گیرم').click(); await next();
  await check('learning goal is required', async () => assert(await button('ادامه').isDisabled()));
  await radio('سفر و زندگی در محیط تازه').click(); await next();
  await page.screenshot({ path: path.join(cache, 'confirmation-mobile.png'), fullPage: true });
  await button('ورود به کریدور و دیدن پیشرفت من').click();
  await heading('مسیر من، پیشرفت واقعی من').waitFor();
  await page.getByRole('progressbar').first().waitFor();
  await check('save opens real dashboard, preserving raw learning storage', async () => {
    const values = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
    assert.equal(JSON.parse(values['learner_journey_v1:A']).language, 'tr');
    assert(!Object.keys(values).some(key => key.startsWith('sentence_course_progress')));
    assert.equal(await page.getByRole('progressbar').count(), 3);
  });
  await page.screenshot({ path: path.join(cache, 'dashboard-mobile.png'), fullPage: true });
  await button('شروع از درس‌های سطح پیشنهادی').click();
  await check('Turkish self-assessment opens actual A2 library, without completing lessons', async () => assert.deepEqual(await page.evaluate(() => window.__routes.at(-1)), { pathname: '/learn/tr/library', params: { level: '2' } }));
  await button('باز کردن کریدور ترکی استانبولی').click();
  await check('selected corridor opens correct home', async () => assert.equal(await page.evaluate(() => window.__routes.at(-1)), '/learn/tr'));
  await page.reload(); await heading('مسیر من، پیشرفت واقعی من').waitFor();
  await check('returning account resumes dashboard without repeat onboarding', async () => assert.equal(await heading('دوست داری چه زبانی یاد بگیری؟').count(), 0));
  await button('تغییر زبان، سطح یا هدف').click();
  await radio('آلمانی').click(); await next();
  await check('switching language does not reuse another language self-assessment', async () => assert(await button('ادامه').isDisabled()));
  await radio('از صفر شروع می‌کنم').click(); await next(); await radio('کار و ارتباط حرفه‌ای').click(); await next();
  await button('ورود به کریدور و دیدن پیشرفت من').click(); await heading('مسیر من، پیشرفت واقعی من').waitFor();
  await check('per-language preferences and prior Turkish path retained', async () => {
    const p = await page.evaluate(() => JSON.parse(localStorage.getItem('learner_journey_v1:A')));
    assert.equal(p.language, 'de'); assert.equal(p.paths.de.familiarity, 'new'); assert.equal(p.paths.tr.familiarity, 'everyday');
  });
  await page.evaluate(() => window.__allow(['en']));
  await check('admin revocation hides disabled language reports and entry buttons', async () => {
    await heading('زبان انتخابی فعلاً غیرفعال است').waitFor();
    assert.equal(await button('باز کردن کریدور آلمانی').count(), 0);
    assert.equal(await heading('آلمانی').count(), 0);
  });
  await button('تغییر زبان، سطح یا هدف').click();
  await check('setup cannot select an admin-disabled language', async () => { assert.equal(await radio('آلمانی').count(), 0); assert(await button('ادامه').isDisabled()); });
  await page.evaluate(() => window.__allow([]));
  await page.getByText('همهٔ زبان‌ها غیرفعال‌اند', { exact: true }).waitFor();
  await check('all-disabled state has retry, no proceed action', async () => { assert(await button('بررسی دوبارهٔ زبان‌ها').isVisible()); assert.equal(await button('ادامه').count(), 0); });
  await page.evaluate(() => { window.__allow(['en','de','tr']); window.__account('B'); });
  await heading('دوست داری چه زبانی یاد بگیری؟').waitFor();
  await check('account switch discards previous account preferences in memory', async () => assert(await button('ادامه').isDisabled()));
  // A failed write must keep the wizard open, not pretend completion.
  await radio('انگلیسی').click(); await next(); await radio('از صفر شروع می‌کنم').click(); await next(); await radio('زندگی و گفت‌وگوی روزمره').click(); await next();
  await page.evaluate(() => { window.__originalSet = Storage.prototype.setItem; Storage.prototype.setItem = function(){throw Error('disk full')}; });
  await button('ورود به کریدور و دیدن پیشرفت من').click();
  await check('storage failure is visible, does not finish onboarding', async () => {
    await page.getByRole('alert').waitFor(); assert.equal(await heading('مسیر من، پیشرفت واقعی من').count(), 0);
    assert.equal(await page.evaluate(() => localStorage.getItem('learner_journey_v1:B')), null);
  });
  await page.evaluate(() => { Storage.prototype.setItem = window.__originalSet; });
  await button('ورود به کریدور و دیدن پیشرفت من').click(); await heading('مسیر من، پیشرفت واقعی من').waitFor();
  await check('retry after failed save succeeds', async () => assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('learner_journey_v1:B')).language), 'en'));
  await button('همگام‌سازی سابقهٔ انگلیسی و آلمانی').click();
  await check('unavailable remote sync is reported honestly and local report remains', async () => { await page.getByText('همگام‌سازی انجام نشد؛', { exact: false }).waitFor(); assert.equal(await page.getByRole('progressbar').count(), 3); });
  await page.evaluate(() => {
    const [first,second]=window.__lessonIds;
    const d=new Date();const day=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    localStorage.setItem('sentence_course_progress_v1',JSON.stringify({completedLessonIds:[first,first],reviewCards:[],currentStreak:2,longestStreak:4,lastActiveDate:day,totalMinutes:88,updatedAt:d.toISOString()}));
    localStorage.setItem('english_study_state_v1',JSON.stringify({version:1,days:{[day]:180000},sessions:{[second]:{stage:1,sentenceIndex:0,revealed:false,evidencePassed:false}},lessonEvidence:{}}));
  });
  await button('تازه‌سازی گزارش محلی').click();
  await check('existing study history appears after refresh, without fabricated completions', async () => {
    await page.getByText('۱ / ۱۷۴',{exact:true}).waitFor();
    assert((await page.getByText('زمان اندازه‌گیری‌شدهٔ دورهٔ اصلی:',{exact:false}).textContent()).includes('۳ دقیقه'));
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('sentence_course_progress_v1')).completedLessonIds.length),2);
  });
  await page.evaluate(() => localStorage.setItem('sentence_course_progress_tr_v1','{broken'));
  await button('تازه‌سازی گزارش محلی').click();
  await check('corrupt language is shown as unreadable, not zero, while other reports survive', async () => {
    await page.getByText('گزارش این زبان خوانده نشد.',{exact:false}).waitFor();
    assert.equal(await page.getByRole('progressbar').count(),2);
    assert.equal(await page.evaluate(()=>localStorage.getItem('sentence_course_progress_tr_v1')),'{broken');
  });
  await page.screenshot({path:path.join(cache,'existing-history-mobile.png'),fullPage:true});
  await page.setViewportSize({width:320,height:640});
  await check('mobile UI stays within viewport', async () => assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)));
  await check('no unhandled React/runtime errors', async () => assert.deepEqual(errors, []));
  console.log(`Learner onboarding browser integration: ${passed} checks passed (360px mobile). Auth/access are isolated test doubles, not a real provider login.`);
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
