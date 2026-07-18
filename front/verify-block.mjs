import { chromium } from 'playwright';
const BASE='http://cmig.stage.cscmzc.com', DIR='/tmp/imp2';
const R=[]; const rec=(id,n,p,d='')=>{R.push({id,n,p,d});console.log(`  ${p?'PASS':'FAIL'} [${id}] ${n}${d?' — '+d:''}`);};
const run=async()=>{
  const b=await chromium.launch();
  const page=await(await b.newContext({viewport:{width:1700,height:1100}})).newPage();
  await page.goto(BASE,{waitUntil:'domcontentloaded'}); await page.waitForTimeout(2500);
  await page.locator('input').first().fill('cmiguser');
  await page.locator('input[type="password"]').fill('cmiguserPassword!');
  await page.getByRole('button',{name:/login/i}).click(); await page.waitForTimeout(7000);

  await page.getByRole('button',{name:/^\+?\s*Add$/i}).first().click(); await page.waitForTimeout(2500);
  await page.locator('input[data-testid="source-service-name"], [data-testid="source-service-name"] input').first().fill('bar1529-block-check');
  await page.locator('[data-testid="source-service-with-connection"]').first().click(); await page.waitForTimeout(1200);

  const addBtn = () => page.getByRole('button',{name:/^Add$/}).last();
  const enabled = async () => !(await addBtn().evaluate(el=>el.className.split(/\s+/).includes('disabled')));
  const fi = page.locator('input[data-testid="source-import-input"], [data-testid="source-import-input"]').first();

  rec('A', '이름만 입력 — 그룹만 등록 가능(활성)', await enabled());

  await fi.setInputFiles(`${DIR}/03-errors.csv`); await page.waitForTimeout(4500);
  await page.screenshot({path:'/tmp/blk-01-invalid.png',fullPage:true});
  rec('B', '검증 실패 파일 임포트 → 등록 버튼 비활성', (await enabled())===false);

  await page.locator('[data-testid="source-import-clear"]').first().click(); await page.waitForTimeout(1200);
  await page.screenshot({path:'/tmp/blk-02-cleared.png',fullPage:true});
  rec('C', '목록 제거 → 다시 활성(그룹만 등록 가능)',
    await enabled() && (await page.locator('[data-testid="source-import-preview"]').count())===0);

  await fi.setInputFiles(`${DIR}/01-ok.csv`); await page.waitForTimeout(4500);
  rec('D', '정상 파일 임포트 → 활성', await enabled());

  await fi.setInputFiles(`${DIR}/03-errors.csv`); await page.waitForTimeout(4500);
  rec('E', '정상 → 실패 파일로 교체 → 다시 비활성', (await enabled())===false);

  await b.close();
  console.log('FAIL 수:', R.filter(r=>!r.p).length);
};
run().catch(e=>{console.error('FATAL',e);process.exit(1);});
