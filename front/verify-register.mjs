import { chromium } from 'playwright';
const BASE='http://cmig.stage.cscmzc.com', DIR='/tmp/imp';
const GROUP='bar1529-import-'+Math.floor(Date.now()/1000).toString().slice(-6);
const R=[]; const rec=(id,n,p,d='')=>{R.push({id,n,p,d});console.log(`  ${p?'PASS':'FAIL'} [${id}] ${n}${d?' — '+d:''}`);};
const run=async()=>{
  const b=await chromium.launch();
  const page=await(await b.newContext({viewport:{width:1700,height:1100}})).newPage();
  const regCalls=[];
  page.on('response', async r=>{ if(r.url().includes('register-source-group')){ let j=null; try{j=await r.json();}catch{} regCalls.push({http:r.status(), status:j?.status?.code, msg:j?.status?.message}); }});

  await page.goto(BASE,{waitUntil:'domcontentloaded'}); await page.waitForTimeout(2500);
  await page.locator('input').first().fill('cmiguser');
  await page.locator('input[type="password"]').fill('cmiguserPassword!');
  await page.getByRole('button',{name:/login/i}).click(); await page.waitForTimeout(7000);

  await page.getByRole('button',{name:/^\+?\s*Add$/i}).first().click(); await page.waitForTimeout(2500);
  await page.locator('input[data-testid="source-service-name"], [data-testid="source-service-name"] input').first().fill(GROUP);
  await page.locator('[data-testid="source-service-with-connection"]').first().click(); await page.waitForTimeout(1200);

  const fi=page.locator('input[data-testid="source-import-input"], [data-testid="source-import-input"]').first();
  await fi.setInputFiles(`${DIR}/01-ok.csv`); await page.waitForTimeout(4000);
  await page.screenshot({path:'/tmp/reg-01-preview.png',fullPage:true});

  const addBtn=page.getByRole('button',{name:/^Add$/}).last();
  const enabled=!(await addBtn.evaluate(el=>el.className.split(/\s+/).includes('disabled')));
  rec('TC7','문제 없는 파일이면 등록 버튼 활성', enabled);
  if(!enabled){ await b.close(); return; }

  await addBtn.click(); await page.waitForTimeout(8000);
  await page.screenshot({path:'/tmp/reg-02-after.png',fullPage:true});
  console.log('register 응답:', JSON.stringify(regCalls));
  rec('TC8','등록 요청이 정상 처리', regCalls[0]?.status===200, JSON.stringify(regCalls[0]));
  console.log('GROUP='+GROUP);
  await b.close();
};
run().catch(e=>{console.error('FATAL',e);process.exit(1);});
