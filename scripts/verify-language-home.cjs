const assert=require('node:assert/strict'),path=require('node:path');
(async()=>{
 const loc=require.resolve('@sparticuz/chromium');const pack=await import(require('node:url').pathToFileURL(loc).href);await pack.inflate(path.resolve(path.dirname(loc),'../bin/al2023.tar.br'));pack.setupLambdaEnvironment(path.join(require('node:os').tmpdir(),'al2023/lib'));
 const browser=await require('playwright').chromium.launch({headless:true,args:pack.default.args,executablePath:await pack.default.executablePath()});
 try{
  let checks=0;const page=await browser.newPage();
  const root=process.env.BROWSER_BASE_URL||'http://127.0.0.1:8081';
  for(const width of [320,390,1280]){
   await page.setViewportSize({width,height:900});const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route(/supabase\.(co|in)/,r=>r.abort());await page.goto(root+'/languages',{waitUntil:'networkidle'});
   const en=page.getByRole('button',{name:'ورود به زبان انگلیسی',exact:true});const de=page.getByRole('button',{name:'ورود به زبان آلمانی',exact:true});const ru=page.getByRole('button',{name:'ورود به زبان روسی',exact:true});
   await en.waitFor();assert(await en.count()===1&&await de.count()===1&&await ru.count()===1);checks++;
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=Math.max(innerWidth,outerWidth||0)),'language chooser overflows the viewport');checks++;
   const a=await en.boundingBox(),b=await de.boundingBox(),c=await ru.boundingBox();assert(a.height>90&&b.height>90&&c.height>90,'Language cards must not collapse');checks++;
   assert((await de.innerText()).includes('۹۵ درس')&&(await ru.innerText()).includes('۶۹ درس')&&(await en.innerText()).includes('۱۷۴ درس'),'language cards show the live course sizes');checks++;
   assert.deepEqual(errors.filter(message=>!message.includes('cdn.jsdelivr.net/npm/jsqr@1.2.0/dist/jsQR.min.js')),[]);checks++;page.removeAllListeners('pageerror');

   if(width===1280){await de.focus();await page.keyboard.press('Enter');}else await de.click();
   await page.getByText('Deutsch Journey',{exact:true}).waitFor();checks++;
   const learningNav=await page.getByRole('button',{name:'یادگیری',exact:true}).boundingBox();const conversationNav=await page.getByRole('button',{name:'مکالمه',exact:true}).boundingBox();const reviewNav=await page.getByRole('button',{name:'مرور',exact:true}).boundingBox();assert(learningNav.x>conversationNav.x&&conversationNav.x>reviewNav.x,'German bottom navigation follows right-to-left order');checks++;
   const todayTitleBox=await page.getByText('برنامه امروز',{exact:true}).boundingBox();assert(todayTitleBox.x+todayTitleBox.width>Math.min(width,520)*.6,'German Today heading is positioned on the right');checks++;
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=Math.max(innerWidth,outerWidth||0)),'German home overflows the viewport');checks++;

   await page.goto(root+'/learn/de/library?level=0',{waitUntil:'domcontentloaded'});await page.getByText('آلمانی مقدماتی',{exact:true}).first().waitFor();
   const preLibrary=await page.locator('body').innerText();assert(/۲۰\s*درس/.test(preLibrary)&&/۱۰۰۰\s*جمله/.test(preLibrary)&&/۳۹۶\s*مدخل واژگانی یکتا/.test(preLibrary),'Pre-A1 library shows its metrics');checks++;
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=Math.max(innerWidth,outerWidth||0)),'Pre-A1 library overflows the viewport');checks++;
   await page.goto(root+'/learn/de/library?level=2',{waitUntil:'domcontentloaded'});await page.getByText('گفت‌وگوی ترکیبی A2',{exact:true}).waitFor();
   const a2Library=await page.locator('body').innerText();assert(/۲۵\s*درس/.test(a2Library)&&/۱۲۵۰\s*جمله/.test(a2Library)&&/۷۱۶\s*مدخل واژگانی یکتا/.test(a2Library),'A2 library shows expanded metrics');checks++;
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=Math.max(innerWidth,outerWidth||0)),'A2 library overflows the viewport');checks++;
   await page.goto(root+'/learn/de/library?level=3',{waitUntil:'domcontentloaded'});await page.getByText('گفت‌وگوی ترکیبی B1',{exact:true}).waitFor();
   const b1Library=await page.locator('body').innerText();assert(/۲۵\s*درس/.test(b1Library)&&/۱۲۵۰\s*جمله/.test(b1Library)&&/۷۳۴\s*مدخل واژگانی یکتا/.test(b1Library),'B1 library shows expanded metrics');checks++;
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=Math.max(innerWidth,outerWidth||0)),'B1 library overflows the viewport');checks++;

   await page.evaluate(()=>localStorage.removeItem('russian_lesson_sessions_v1'));
   await page.goto(root+'/learn/ru',{waitUntil:'networkidle'});await page.getByText('Russian Journey',{exact:true}).waitFor();
   await page.getByRole('button',{name:'فهرست درس‌های Foundation',exact:true}).click();await page.getByRole('button',{name:'1. سلام و خداحافظی',exact:true}).waitFor();
   await page.getByRole('button',{name:/سلام و خداحافظی/}).first().click();await page.getByText(/موقعیت · مرحلهٔ ۱ از ۹/).waitFor();
   await page.getByRole('button',{name:'ادامه',exact:true}).click();await page.getByText(/جملهٔ ۱ از ۸/).waitFor();
   assert((await page.locator('body').innerText()).includes('Приве́т!'));checks++;
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=Math.max(innerWidth,outerWidth||0)));checks++;
   page.removeAllListeners('pageerror');
  }
  await page.setViewportSize({width:390,height:844});
  const paginationErrors=[];page.on('pageerror',error=>paginationErrors.push(error.message));
  const germanStage = text => page.getByText(new RegExp(text.replace(/ /g,'\\s+')),{exact:false}).first().waitFor();
  await page.goto(root+'/learn/de/lesson?id=de-v2-greetings',{waitUntil:'networkidle'});
  await germanStage('موقعیت · مرحلهٔ ۱ از ۹');
  const germanSituation=await page.locator('body').innerText();
  assert(germanSituation.includes('در پایان این درس می‌توانید'),'German situation stage shows the lesson promise exactly like Russian');checks++;
  assert(germanSituation.includes('نکتهٔ آلمانی به فارسی'),'German situation stage keeps its Persian teaching note');checks++;
  await page.getByRole('button',{name:'ادامه',exact:true}).click();
  await germanStage('جمله‌های اصلی · مرحلهٔ ۲ از ۹');
  await page.getByText(/جملهٔ ۱ از ۵۰/).waitFor();
  for(let i=0;i<49;i++)await page.getByRole('button',{name:'جملهٔ بعدی',exact:true}).click();
  await page.getByText(/جملهٔ ۵۰ از ۵۰/).waitFor();
  await page.getByRole('button',{name:'ادامه',exact:true}).click();
  await germanStage('شنیدن · مرحلهٔ ۳ از ۹');
  await page.getByText(/صفحهٔ ۱ از ۱۰/).waitFor();
  assert(await page.getByRole('button',{name:/^شنیدن جمله:/}).count()===5,'German listening page shows five sentence cards');checks++;
  await page.getByRole('button',{name:'صفحهٔ بعدی',exact:true}).click();await page.getByText(/صفحهٔ ۲ از ۱۰/).waitFor();
  await page.getByRole('button',{name:'صفحهٔ قبل',exact:true}).click();await page.getByText(/صفحهٔ ۱ از ۱۰/).waitFor();
  for(let i=0;i<9;i++)await page.getByRole('button',{name:'صفحهٔ بعدی',exact:true}).click();
  await page.getByText(/صفحهٔ ۱۰ از ۱۰/).waitFor();
  assert(await page.getByRole('button',{name:/^شنیدن جمله:/}).count()===5,'the last German listening page stays within the five-card limit');checks++;
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=Math.max(innerWidth,outerWidth||0)),'German listening pages have no mobile horizontal overflow');checks++;
  await page.getByRole('button',{name:'ادامه',exact:true}).click();
  await germanStage('سایه‌خوانی · مرحلهٔ ۴ از ۹');
  await page.getByText('۱ / ۵۰').waitFor();
  await page.getByRole('button',{name:'جملهٔ بعد',exact:true}).click();await page.getByText('۲ / ۵۰').waitFor();checks++;
  await page.getByRole('button',{name:'ادامه',exact:true}).click();
  await germanStage('ساخت جمله · مرحلهٔ ۵ از ۹');
  await page.getByRole('button',{name:'ادامه',exact:true}).click();
  await germanStage('واژگان از جمله · مرحلهٔ ۶ از ۹');
  await page.getByText(/صفحهٔ ۱ از ۱۰/).waitFor();
  assert(await page.getByRole('button',{name:/^شنیدن مثال/}).count()>=5,'German vocabulary page shows the words of its first five sentences');checks++;
  assert(await page.getByRole('button',{name:/^تلفظ واژهٔ آلمانی:/}).count()>=5,'German vocabulary exposes tappable words with recorded meanings');checks++;
  await page.getByRole('button',{name:'پخش واژه‌های این صفحه',exact:true}).waitFor();checks++;
  await page.getByRole('button',{name:'صفحهٔ بعدی',exact:true}).click();await page.getByText(/صفحهٔ ۲ از ۱۰/).waitFor();
  await page.getByRole('button',{name:'صفحهٔ قبل',exact:true}).click();await page.getByText(/صفحهٔ ۱ از ۱۰/).waitFor();
  for(let i=0;i<9;i++)await page.getByRole('button',{name:'صفحهٔ بعدی',exact:true}).click();
  await page.getByText(/صفحهٔ ۱۰ از ۱۰/).waitFor();
  assert(await page.getByRole('button',{name:/^شنیدن مثال/}).count()>=1,'the last German vocabulary page keeps its sentence examples');checks++;
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=Math.max(innerWidth,outerWidth||0)),'German vocabulary pages have no mobile horizontal overflow');checks++;
  await page.getByRole('button',{name:'ادامه',exact:true}).click();
  await germanStage('دستور در کاربرد · مرحلهٔ ۷ از ۹');
  await page.getByRole('button',{name:'ادامه',exact:true}).click();
  await germanStage('مکالمه · مرحلهٔ ۸ از ۹');
  await page.getByRole('button',{name:'ادامه',exact:true}).click();
  await germanStage('مرور هوشمند · مرحلهٔ ۹ از ۹');
  assert(await page.getByRole('button',{name:'نمایش توضیح همهٔ پاسخ‌ها',exact:true}).count()===1,'the German lesson ends with the same nine-stage self-check');checks++;
  assert.deepEqual(paginationErrors.filter(message=>!message.includes('cdn.jsdelivr.net/npm/jsqr@1.2.0/dist/jsQR.min.js')),[],'no runtime errors in the nine-stage Pre-A1 lesson');checks++;
  page.removeAllListeners('pageerror');

  async function verifyExpandedLessonPagination(lessonId,levelName){
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto(`${root}/learn/de/lesson?id=${lessonId}`,{waitUntil:'networkidle'});
   await germanStage('موقعیت · مرحلهٔ ۱ از ۹');assert((await page.locator('body').innerText()).includes('۵۰ جملهٔ کوتاه'),`${levelName} situation card reports fifty examples`);checks++;
   await page.getByRole('button',{name:'ادامه',exact:true}).click();await page.getByText(/جملهٔ ۱ از ۵۰/).waitFor();
   for(let i=0;i<49;i++)await page.getByRole('button',{name:'جملهٔ بعدی',exact:true}).click();
   await page.getByText(/جملهٔ ۵۰ از ۵۰/).waitFor();checks++;
   await page.getByRole('button',{name:'ادامه',exact:true}).click();await page.getByText(/صفحهٔ ۱ از ۱۰/).waitFor();
   assert(await page.getByRole('button',{name:/^شنیدن جمله:/}).count()===5,`${levelName} listening pagination shows five cards`);checks++;
   for(let i=0;i<9;i++)await page.getByRole('button',{name:'صفحهٔ بعدی',exact:true}).click();await page.getByText(/صفحهٔ ۱۰ از ۱۰/).waitFor();
   assert(await page.getByRole('button',{name:/^شنیدن جمله:/}).count()===5,`${levelName} final listening page stays within the five-card limit`);checks++;
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=Math.max(innerWidth,outerWidth||0)),`${levelName} lesson has no mobile horizontal overflow`);checks++;
   assert.deepEqual(errors.filter(message=>!message.includes('cdn.jsdelivr.net/npm/jsqr@1.2.0/dist/jsQR.min.js')),[],`no runtime errors in the paginated ${levelName} lesson`);checks++;page.removeAllListeners('pageerror');
  }
  await verifyExpandedLessonPagination('de-v2-family','A1');
  await verifyExpandedLessonPagination('de-v2-weekend-past','A2');
  await verifyExpandedLessonPagination('de-v2-opinions-reasons','B1');
  console.log(`${checks} multilingual responsive, routing, Russian nine-stage and German nine-stage Pre-A1/A1/A2/B1 pagination checks passed.`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
