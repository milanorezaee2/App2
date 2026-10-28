// Optional login-to-language-choice integration. Run the login-edition web export
// with scripts/serve-preview.mjs first; BROWSER_BASE_URL defaults to port 8081.
// ALL Supabase HTTP responses are local fixtures. No real provider is contacted.
// Dependencies: playwright + @sparticuz/chromium in BROWSER_DEPS or the ignored cache.
const assert=require('node:assert/strict');const path=require('node:path');const {pathToFileURL}=require('node:url');const os=require('node:os');
const dep=process.env.BROWSER_DEPS||path.resolve('node_modules/.cache/language-entry/deps');const {chromium}=require(require.resolve('playwright',{paths:[dep]}));
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
 const base=process.env.BROWSER_BASE_URL||'http://127.0.0.1:8081';
 const button=name=>page.getByRole('button',name.startsWith('ورود به زبان ')?{name:new RegExp('^'+name)}:{name,exact:true});
 await page.goto(base+'/App2/learn/de/library');
 await page.waitForURL('**/languages',{timeout:45000});
 await button('ورود به زبان انگلیسی').waitFor({timeout:10000}).catch(async e=>{console.log(await page.locator('body').innerText());console.log('REQUESTS',requests);console.log(await page.getByRole('button').allTextContents());throw e});console.log('PASS restored authenticated route lands at existing language choice');
 assert.equal(await page.getByRole('radio').count(),0);assert.equal(await page.getByRole('progressbar').count(),0);
 for(const [name,target] of [['آلمانی','/learn/de'],['ترکی استانبولی','/learn/tr'],['انگلیسی','/lang']]){
  await button('ورود به زبان '+name).click();await page.waitForURL(url=>url.pathname.endsWith(target));
  console.log('PASS one language tap opens existing course: '+target);
  if(target!='/lang'){await button('بازگشت به صفحهٔ اصلی اپ').filter({visible:true}).first().click();await page.waitForURL('**/languages');}
 }
 for(let i=0;i<2;i++){
  await button('ورود ایمیلی و همگام‌سازی شخصی').click();
  await button('خروج از حساب (دادهٔ محلی پاک نمی‌شود)').click();await button('ورود').waitFor();
  user={...user,id:i===0?'66666666-7777-4888-8999-aaaaaaaaaaaa':'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff',email:'account'+i+'@example.invalid'};
  await button('ورود').click();await page.getByRole('textbox',{name:'ایمیل حساب',exact:true}).fill(user.email);await button('دریافت کد ورود').click();await page.getByRole('textbox',{name:'کد تأیید ایمیل',exact:true}).fill('123456');await button('تأیید و ورود').click();
  await page.waitForURL('**/languages');await button('ورود به زبان انگلیسی').waitFor();console.log('PASS logout and subsequent OTP login '+(i+1)+' lands on language choice, not old course');
  await button('ورود به زبان انگلیسی').click();await page.waitForURL(url=>url.pathname.endsWith('/lang'));
 }
 assert.equal(await page.getByRole('radio').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS no React/navigation errors; HTTP auth responses are fixtures, not real OTP delivery');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
