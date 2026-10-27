#!/usr/bin/env node
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url).pathname;
const state = { files: new Map(), storage: new Map(), downloads: [], moves: [], removed: 0, listeners: 0,
  healthOK: false, healthCalls: 0, failCDN: true, failAll: false, decodeFailure: false, noFinish: false, neverDownload: false, cancels: 0, speeches: [], networkForbidden: false };
globalThis.__repair = state;
globalThis.fetch = async () => { state.healthCalls++; return { ok: true, json: async () => ({ ok: state.healthOK }) }; };
const options = {
  stdin: { contents: `export * from './lib/narrator/engine';export * from './lib/narrator/cloudNarrator';export * from './lib/narrator/audioCache';export {registerNativeVoiceFetcher} from './lib/speechLanguage';export {getCourseProgress} from './lib/courseProgress';export {createBoundedFetch} from './lib/boundedFetch';`, resolveDir: root, loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent',
  define: { 'process.env.EXPO_PUBLIC_NARRATOR_CDN_URL': '"https://cdn.invalid/audio"', 'process.env.EXPO_PUBLIC_NARRATOR_CLOUD': '"on"' },
  plugins: [{ name: 'native-boundary-fixtures', setup(b) {
    const stubs = {
      'react-native': `export const Platform={OS:'android'};`,
      'expo-constants': `export default {expoConfig:{extra:{}}};`,
      '@react-native-async-storage/async-storage': `export default {getItem:async k=>globalThis.__repair.storage.get(k)??null,setItem:async(k,v)=>globalThis.__repair.storage.set(k,v)};`,
      'expo-speech': `export const speak=(text,o)=>{globalThis.__repair.speeches.push(text);setTimeout(()=>o.onDone?.(),2)};export const stop=async()=>{};export const pause=async()=>{};export const resume=async()=>{};export const getAvailableVoicesAsync=async()=>[];export const isSpeakingAsync=async()=>false;`,
      'expo-audio': `export const setAudioModeAsync=async()=>{};export function createAudioPlayer({uri}){const s=globalThis.__repair;let fn,removed=false;return {playing:true,playbackRate:1,play(){setTimeout(()=>{if(removed)return;if(s.decodeFailure){fn?.({error:'bad decoder'});return}fn?.({isLoaded:true});if(!s.noFinish)setTimeout(()=>{if(!removed)fn?.({isLoaded:true,didJustFinish:true})},3)},1)},pause(){},remove(){removed=true;s.removed++},addListener(_name,cb){s.listeners++;fn=cb;return {remove(){s.listeners--;fn=null}}}}}`,
      'expo-file-system/legacy': `export const cacheDirectory='file:///cache/';export const makeDirectoryAsync=async()=>{};
        export const getInfoAsync=async p=>({exists:globalThis.__repair.files.has(p),size:globalThis.__repair.files.has(p)?100:0});
        export const deleteAsync=async p=>{globalThis.__repair.files.delete(p)};
        export const moveAsync=async({from,to})=>{const s=globalThis.__repair;s.files.set(to,s.files.get(from));s.files.delete(from);s.moves.push(to)};
        export function createDownloadResumable(url,uri){let rejectDownload;return {async downloadAsync(){const s=globalThis.__repair;s.downloads.push(url);s.files.set(uri,url);if(s.delayDownloads)await new Promise(r=>setTimeout(r,s.delayDownloads));if(s.neverDownload)return new Promise((_,r)=>rejectDownload=r);const bad=s.failAll||(s.failCDN&&url.includes('cdn.invalid'));return {status:bad?404:200,uri,headers:{'Content-Type':bad?'application/json':'audio/mpeg'}}},async cancelAsync(){globalThis.__repair.cancels++;rejectDownload?.(Error('cancelled'))}}}`,
      config: `export const SUPABASE_PUBLIC_URL='https://narrator.invalid';export const SUPABASE_PUBLIC_ANON_KEY='public-fixture';`,
      supabase: `export const supabase=new Proxy({}, {get(){throw Error('Read-only lesson progress contacted backend')}});`,
    };
    b.onResolve({ filter: /^(react-native|expo-constants|expo-speech|expo-audio|expo-file-system\/legacy|@react-native-async-storage\/async-storage)$|(?:^|\/)(supabase|supabaseConfig)$/ }, a => ({ path: a.path.endsWith('supabaseConfig') ? 'config' : a.path.endsWith('supabase') ? 'supabase' : a.path, namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ contents: stubs[a.path], loader: 'js' }));
  } }],
};
const out = await build(options);
const api = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
let checks = 0;
const check = (name, fn) => { fn(); checks++; console.log('PASS', name); };
check('existing introductory progress reads locally without a backend', () => assert.equal(typeof api.getCourseProgress, 'function'));
const local = await api.getCourseProgress();
check('no hidden network or storage write from progress read', () => { assert.equal(local.completedLessonIds.length, 0); assert.equal(state.storage.size, 0); });
state.storage.set('sentence_course_progress_v1', '{broken');
await assert.rejects(api.getCourseProgress);
check('corrupt history is not silently replaced by zero', () => assert.equal(state.storage.get('sentence_course_progress_v1'), '{broken'));
state.storage.clear();
await api.playCloudNarration({ text: 'Good morning.', locale: 'en-US', cancelled: () => false });
check('broken CDN falls through to original cloud source', () => { assert(state.downloads.some(x => x.includes('cdn.invalid'))); assert(state.downloads.some(x => x.includes('narrator.invalid'))); });
check('HTTP error body never becomes a final cached mp3', () => {
  assert([...state.files.keys()].every(k => !k.endsWith('.part')));
  assert([...state.files.values()].every(v => !v.includes('cdn.invalid')));
});
const downloadsBefore = state.downloads.length;
await api.playCloudNarration({ text: 'Good morning.', locale: 'en-US', cancelled: () => false });
check('cached original audio remains playable without another download/health prerequisite', () => {
  assert.equal(state.healthCalls, 0);
  assert.equal(state.downloads.length, downloadsBefore);
  assert.equal(state.downloads.filter(x => x.includes('narrator.invalid')).length, 1);
});
const probeBundle = await build({ ...options, stdin: {contents: "export {checkCloudNarrator} from './lib/narrator/cloudNarrator';", resolveDir: root, loader:'ts'},
  define: {...options.define,'process.env.EXPO_PUBLIC_NARRATOR_CDN_URL':'""'} });
const probe = await import(`data:text/javascript;base64,${Buffer.from(probeBundle.outputFiles[0].text).toString('base64')}`);
const realNow = Date.now; let now = realNow(); Date.now = () => now;
const probed = await Promise.all([probe.checkCloudNarrator(),probe.checkCloudNarrator(),probe.checkCloudNarrator()]);
check('concurrent health probes are deduplicated',()=>{assert.equal(state.healthCalls,1);assert(probed.every(x=>x===false));});
now += 16000; state.healthOK = true;
assert.equal(await probe.checkCloudNarrator(),true);
check('negative health expires and recovery is retried',()=>assert.equal(state.healthCalls,2));
now += 301000; state.healthOK = false;
assert.equal(await probe.checkCloudNarrator(),false);
check('in-memory positive health also expires instead of sticking forever',()=>assert.equal(state.healthCalls,3));
Date.now = realNow;
state.failCDN = false;
await Promise.all([api.cacheAudioFile('https://audio.invalid/one', 'same'), api.cacheAudioFile('https://audio.invalid/one', 'same')]);
check('concurrent requests share one atomic download', () => assert.equal(state.downloads.filter(x => x === 'https://audio.invalid/one').length, 1));
await api.cacheAudioFile('https://audio.invalid/two', 'same');
check('different voice/source URLs cannot collide in the cache', () => assert.equal(state.moves.filter(x => x.includes('same-')).length, 2));
state.failAll = true;
await api.narrate('No remote service.', 'en-US');
check('unavailable original voice reports error, never silently substitutes device voice', () => { assert.equal(api.getNarratorSnapshot().status, 'error'); assert.equal(state.speeches.length, 0); });
api.registerNativeVoiceFetcher(async () => [{identifier:'en-us-female',name:'Samantha',language:'en-US',quality:'Enhanced'}]);
await api.chooseDeviceNarration('Optional help.', 'en-US');
check('device voice is available only after explicit learner choice and correctly labelled', () => { assert.equal(state.speeches.at(-1), 'Optional help.'); assert.equal(api.getNarratorSnapshot().engine, 'device'); assert.match(api.getNarratorSnapshot().qualityLabel, /نه نریتور اصلی/); });
const downloadCount = state.downloads.length;
await api.narrate('Next sentence.', 'en-US');
check('explicit device choice avoids repeated unavailable-network waits for this language', () => { assert.equal(state.downloads.length, downloadCount); assert.equal(state.speeches.at(-1), 'Next sentence.'); });
state.failAll = false;
await api.chooseOriginalNarration('Return to original.', 'en-US');
check('learner can return to the original narrator without altering teaching text', () => assert.equal(api.getNarratorSnapshot().engine, 'cloud'));
state.decodeFailure = true;
await assert.rejects(api.playCloudNarration({text:'A bad decoder.',locale:'de-DE',cancelled:()=>false}));
state.decodeFailure = false;
check('decoder failure releases all native subscriptions and player objects', () => { assert.equal(state.listeners, 0); assert(state.removed > 0); });
state.noFinish = true;
const pending = api.playCloudNarration({text:'Stop this.',locale:'de-DE',cancelled:()=>false});
await new Promise(resolve => setTimeout(resolve, 10)); api.stopCloudNarration(); await pending;
state.noFinish = false;
check('stop resolves pending playback and removes native resources', () => assert.equal(state.listeners, 0));
state.delayDownloads=80;
const removedBefore=state.removed;
const preparing=api.narrate('Pause before loading.', 'en-US');
await new Promise(resolve=>setTimeout(resolve,5));await api.pauseNarration();await preparing;
state.delayDownloads=0;
check('pausing during a download prevents late autoplay after pause',()=>{assert.equal(api.getNarratorSnapshot().status,'paused');assert.equal(state.removed,removedBefore);});
await api.resumeNarration();
check('paused preparation can resume from its cached sentence',()=>assert.equal(api.getNarratorSnapshot().status,'idle'));
state.neverDownload = true;
const started = Date.now();
await assert.rejects(api.cacheAudioFile('https://audio.invalid/hung', 'hang'));
state.neverDownload = false;
check('hung download times out, cancels transport, and leaves no corrupt cache', () => {
  assert(Date.now() - started < 10000); assert(state.cancels > 0);
  assert([...state.files.keys()].every(k => !k.endsWith('.part')));
});
const read = p => readFileSync(root + p, 'utf8');
check('landing page has no eager curriculum or report imports', () => {
  assert.doesNotMatch(read('app/journey.tsx'), /^import .*learnerProgressSummary/m);
  assert.match(read('app/journey.tsx'), /await import\('@\/components\/LearnerProgressDashboard'\)/);
  assert.match(read('app/journey.tsx'), /level: '0'/);
});
check('no duplicate setup/level questionnaire; all entry routes start at introductory level', () => {
  assert(!read('components/LearnerJourneyGate.tsx').includes('if (!profile) return <LearnerSetup'));
  assert.doesNotMatch(read('components/LearnerSetup.tsx'), /FAMILIARITIES\.map|JOURNEY_GOALS\.map|setStep/);
  assert.match(read('components/LearnerSetup.tsx'), /onSave\(language, 'new', 'daily'\)/);
});
check('narrator animation runs off JS thread and hidden screens do not autoplay', () => {
  assert.doesNotMatch(read('components/LessonNarrator.tsx'), /useNativeDriver: false/);
  assert.match(read('lib/narrator/useLessonNarrator.ts'), /!focused/);
  assert.doesNotMatch(read('lib/narrator/useLessonNarrator.ts'), /void primeNarrator|prefetchSentence\(cleanText/);
});
check('foreground does not throw away lesson navigation and cloud sync is not on every home focus', () => {
  assert.doesNotMatch(read('app/_layout.tsx'), /visibilitychange|AppState\.addEventListener/);
  for (const p of ['app/lang/index.tsx','components/GermanSentenceHome.tsx']) assert.doesNotMatch(read(p), /void syncPersonalLearningData\(\)/);
});
let requestSignal;
const bounded=api.createBoundedFetch(async(_url,init)=>{requestSignal=init.signal;return new Promise(()=>{})},5);
await assert.rejects(bounded('https://api.invalid'),/timed out/);
check('API waits have an enforced deadline and abort transport',()=>assert(requestSignal.aborted));
const controller=new AbortController();controller.abort();let called=false;
await assert.rejects(api.createBoundedFetch(async()=>{called=true;return {}},100)('https://api.invalid',{signal:controller.signal}),/cancelled/);
check('caller cancellation is preserved before starting a network request',()=>assert.equal(called,false));
const locked=JSON.parse(read('docs/repair-content-lock.json'));
check('all frozen educational content is byte-for-byte unchanged',()=>{
  for(const [file,sha] of Object.entries(locked)) assert.equal(createHash('sha256').update(readFileSync(root+file)).digest('hex'),sha,file);
});
api.stopNarration();
console.log(`Narration reliability and fast zero-start: ${checks} checks passed. Real remote service availability is not implied.`);
