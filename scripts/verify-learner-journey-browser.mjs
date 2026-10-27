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
  let passed = 0;
  const check = async (name, fn) => { await fn(); passed++; console.log('PASS', name); };
  await page.goto(url);
  await heading('چه زبانی می‌خواهی یاد بگیری؟').waitFor();
  await check('a language is required, but there is no level/goal questionnaire', async () => {
    assert(await button('شروع از اولین درس').isDisabled());
    assert.equal(await page.getByText('چقدر با این زبان آشنایی داری؟',{exact:true}).count(),0);
  });
  await radio('ترکی استانبولی').click();await button('شروع از اولین درس').click();
  await heading('زبانت را انتخاب کن؛ از صفر شروع کن').waitFor();
  await check('onboarding saves introductory preference and does not write learning records', async () => {
    const values=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
    const p=JSON.parse(values['learner_journey_v1:A']);assert.equal(p.language,'tr');assert.equal(p.paths.tr.familiarity,'new');
    assert(!Object.keys(values).some(k=>k.startsWith('sentence_course_progress')));
  });
  await check('all three languages are immediately available with no eager report', async () => {
    assert.equal(await page.getByRole('progressbar').count(),0);
    for(const name of ['انگلیسی','آلمانی','ترکی استانبولی']) assert(await button(`شروع ${name} از درس اول`).isVisible());
  });
  for(const [language,name,pathname] of [['en','انگلیسی','/lang/library'],['de','آلمانی','/learn/de/library'],['tr','ترکی استانبولی','/learn/tr/library']]) {
    await button(`شروع ${name} از درس اول`).click();
    await page.waitForFunction(p=>window.__routes?.at(-1)?.pathname===p,pathname);
    await check(`${language} always opens level zero`,async()=>assert.deepEqual(await page.evaluate(()=>window.__routes.at(-1)),{pathname,params:{level:'0'}}));
  }
  const before=await page.evaluate(()=>window.__routes.length);
  await button('شروع انگلیسی از درس اول').evaluate(el=>{for(let i=0;i<8;i++)el.click()});
  await page.waitForFunction(n=>window.__routes.length>n,before);
  await check('rapid taps do not push duplicate screens',async()=>assert.equal(await page.evaluate(()=>window.__routes.length),before+1));
  await button('دیدن گزارش پیشرفت قبلی').click();await page.getByRole('progressbar').nth(2).waitFor();
  await check('real progress report loads only after explicit request',async()=>assert.equal(await page.getByRole('progressbar').count(),3));
  await button('بازگشت به انتخاب سریع زبان').click();
  await page.reload();await heading('زبانت را انتخاب کن؛ از صفر شروع کن').waitFor();
  await check('returning user goes straight to fast language selection',async()=>assert.equal(await heading('چه زبانی می‌خواهی یاد بگیری؟').count(),0));
  await page.evaluate(()=>window.__allow(['en']));
  await check('revoked languages disappear from entry',async()=>{assert.equal(await button('شروع آلمانی از درس اول').count(),0);assert.equal(await button('شروع ترکی استانبولی از درس اول').count(),0)});
  await page.evaluate(()=>window.__allow([]));await page.getByText('همهٔ زبان‌ها غیرفعال‌اند',{exact:true}).waitFor();
  await check('all-disabled state provides retry instead of an unusable entry',async()=>assert(await button('بررسی دوبارهٔ زبان‌ها').isVisible()));
  await page.evaluate(()=>{window.__allow(['en','de','tr']);window.__account('B')});
  await heading('چه زبانی می‌خواهی یاد بگیری؟').waitFor();
  await check('new account does not inherit another account language preference',async()=>assert(await button('شروع از اولین درس').isDisabled()));
  await radio('انگلیسی').click();
  await page.evaluate(()=>{window.__originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw Error('disk full')}});
  await button('شروع از اولین درس').click();await page.getByRole('alert').waitFor();
  await check('failed save leaves setup visible and no false completion',async()=>{assert.equal(await heading('زبانت را انتخاب کن؛ از صفر شروع کن').count(),0);assert.equal(await page.evaluate(()=>localStorage.getItem('learner_journey_v1:B')),null)});
  await page.evaluate(()=>{Storage.prototype.setItem=window.__originalSet});
  await button('شروع از اولین درس').click();await heading('زبانت را انتخاب کن؛ از صفر شروع کن').waitFor();
  await check('storage recovery can be retried without restarting the app',async()=>assert.equal(await page.getByRole('alert').count(),0));
  await page.evaluate(()=>{
    localStorage.setItem('sentence_course_progress_v1',JSON.stringify({completedLessonIds:[window.__lessonIds[0]],reviewCards:[]}));
    localStorage.setItem('learner_journey_v1:C',JSON.stringify({schemaVersion:1,userId:'C',language:'en',paths:{en:{familiarity:'fluent',goal:'work'}},updatedAt:new Date().toISOString()}));
    window.__account('C');
  });
  await heading('زبانت را انتخاب کن؛ از صفر شروع کن').waitFor();
  await button('شروع انگلیسی از درس اول').click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('learner_journey_v1:C')).paths.en.familiarity==='new');
  await check('old advanced preferences no longer skip introductory lessons or erase history',async()=>{assert.equal((await page.evaluate(()=>window.__routes.at(-1))).params.level,'0');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('sentence_course_progress_v1')).completedLessonIds.length),1)});
  await page.evaluate(()=>localStorage.setItem('sentence_course_progress_tr_v1','{broken'));
  await button('دیدن گزارش پیشرفت قبلی').click();await page.getByText('گزارش این زبان خوانده نشد.',{exact:false}).waitFor();
  await check('corrupt report is unknown, not fake zero, and other history remains visible',async()=>{assert.equal(await page.getByRole('progressbar').count(),2);assert.equal(await page.evaluate(()=>localStorage.getItem('sentence_course_progress_tr_v1')),'{broken')});
  await button('بازگشت به انتخاب سریع زبان').click();
  await page.setViewportSize({width:320,height:640});
  await check('small mobile viewport has no horizontal overflow',async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)));
  await page.screenshot({path:path.join(cache,'fast-entry-mobile.png'),fullPage:true});
  await check('no unhandled React/runtime errors',async()=>assert.deepEqual(errors,[]));
  console.log(`Fast zero-start browser integration: ${passed} checks passed; auth/access are local fixtures.`);

} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
