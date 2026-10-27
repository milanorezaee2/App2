// Optional production Expo routing integration. Run the login-edition web export
// with scripts/serve-preview.mjs first; BROWSER_BASE_URL defaults to port 8081.
// ALL Supabase HTTP responses are local fixtures. No real provider is contacted.
// Dependencies: same external JOURNEY_BROWSER_DEPS as the isolated browser test.
const assert=require('node:assert/strict');const path=require('node:path');const {pathToFileURL}=require('node:url');const os=require('node:os');
const dep=process.env.JOURNEY_BROWSER_DEPS||path.resolve('node_modules/.cache/journey-browser/deps');const {chromium}=require(require.resolve('playwright',{paths:[dep]}));
(async()=>{const pkg=require.resolve('@sparticuz/chromium',{paths:[dep]});const pack=await import(pathToFileURL(pkg));await pack.inflate(path.resolve(path.dirname(pkg),'../bin/al2023.tar.br'));pack.setupLambdaEnvironment(path.join(os.tmpdir(),'al2023/lib'));const browser=await chromium.launch({headless:true,args:pack.default.args,executablePath:await pack.default.executablePath()});
try{
 const page=await browser.newPage({viewport:{width:360,height:800}});const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message)});let requests=[];
 let user={id:'11111111-2222-4333-8444-555555555555',email:'learner@example.invalid',email_confirmed_at:'2026-10-28T00:00:00Z',is_anonymous:false,user_metadata:{full_name:'زبان‌آموز آزمایشی'},app_metadata:{provider:'email'},aud:'authenticated',role:'authenticated'};
 await page.route('**/*.supabase.co/**',async route=>{const req=route.request();requests.push(req.url());let data=[];
  if(req.url().includes('/auth/v1/user'))data=user;
  if(req.url().includes('/auth/v1/verify'))data={access_token:Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+86400,aud:'authenticated',role:'authenticated'})).toString('base64url')+'.fixture-not-a-real-token',refresh_token:'fixture-not-a-real-refresh-token',token_type:'bearer',expires_in:86400,user};
  if(req.url().includes('/rest/v1/app_user_profiles'))data=[{user_id:user.id,full_name:'زبان‌آموز آزمایشی',email:user.email,registered_at:'2026-10-28T00:00:00Z',last_seen_at:'2026-10-28T00:00:00Z'}];
  await route.fulfill({status:req.method()==='OPTIONS'?204:200,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS','content-type':'application/json'},body:req.method()==='OPTIONS'?'':JSON.stringify(data)});
 });
 await page.addInitScript(({user})=>{if(sessionStorage.getItem('fixture-ready'))return;sessionStorage.setItem('fixture-ready','true');const encode=o=>btoa(JSON.stringify(o)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');const expires_at=Math.floor(Date.now()/1000)+86400;localStorage.setItem('sb-doagwkssxtxseuavrxnr-auth-token',JSON.stringify({access_token:encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:user.id,exp:expires_at,aud:'authenticated',role:'authenticated'})+'.fixture-not-a-real-token',refresh_token:'fixture-not-a-real-refresh-token',token_type:'bearer',expires_in:86400,expires_at,user}));},{user});
 await page.goto((process.env.BROWSER_BASE_URL||'http://127.0.0.1:8081')+'/App2/');
 await page.getByRole('heading',{name:'زبانت را انتخاب کن؛ از صفر شروع کن',exact:true}).waitFor({timeout:45000});console.log('PASS production auth gate opens a single language entry, no setup questionnaire');
 const button=name=>page.getByRole('button',{name,exact:true});
 assert.equal(await page.getByRole('progressbar').count(),0);
 await page.screenshot({path:'node_modules/.cache/journey-browser/production-fast-entry-mobile.png',fullPage:true});
 await button('شروع آلمانی از درس اول').click();await page.waitForURL('**/learn/de/library?level=0');await page.getByText('آلمانی مقدماتی',{exact:true}).filter({visible:true}).first().waitFor();console.log('PASS language choice opens the actual introductory library, not advanced self-assessed levels');
 await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.waitForTimeout(100);assert(page.url().includes('/learn/de/library?level=0'));console.log('PASS foreground/tab visibility does not reset the current course');
 await page.getByRole('button',{name:'1. سلام و آشنایی',exact:true}).click();await page.waitForURL('**/learn/de/lesson?id=de-v2-greetings');console.log('PASS first existing lesson opens without modifying curriculum');
 await page.getByRole('button',{name:'بازگشت به صفحهٔ اصلی اپ',exact:true}).filter({visible:true}).first().click();await page.waitForURL('**/journey');
 await button('دیدن گزارش پیشرفت قبلی').click();await page.getByRole('progressbar').nth(2).waitFor();console.log('PASS reports are available on demand after fast entry');
 await button('بازگشت به انتخاب سریع زبان').click();
 await button('حساب من و همگام‌سازی').click();await button('خروج از حساب (دادهٔ محلی پاک نمی‌شود)').click();
 await button('ورود').waitFor(); user={...user,id:'66666666-7777-4888-8999-aaaaaaaaaaaa',email:'second@example.invalid'};
 await button('ورود').click();await page.getByRole('textbox',{name:'ایمیل حساب',exact:true}).fill(user.email);await button('دریافت کد ورود').click();await page.getByRole('textbox',{name:'کد تأیید ایمیل',exact:true}).fill('123456');await button('تأیید و ورود').click();
 await page.getByRole('heading',{name:'زبانت را انتخاب کن؛ از صفر شروع کن',exact:true}).waitFor();
 await button('شروع انگلیسی از درس اول').click();await page.waitForURL('**/lang/library?level=0');console.log('PASS second account starts its chosen introductory library in one tap, without old route restoration');
 assert.deepEqual(errors,[]);console.log('PASS production routing has no navigation-before-mount or React errors; all backend HTTP responses were local fixtures, not remote login verification');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
