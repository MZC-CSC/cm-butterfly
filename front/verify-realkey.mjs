import { chromium } from 'playwright';
const BASE='http://cmig.stage.cscmzc.com', DIR='/tmp/imp';
const run=async()=>{
  const b=await chromium.launch();
  const page=await(await b.newContext({viewport:{width:1700,height:1100}})).newPage();
  await page.goto(BASE,{waitUntil:'domcontentloaded'}); await page.waitForTimeout(2500);
  await page.locator('input').first().fill('cmiguser');
  await page.locator('input[type="password"]').fill('cmiguserPassword!');
  await page.getByRole('button',{name:/login/i}).click(); await page.waitForTimeout(7000);

  const doImport = async (file, group) => {
    await page.goto(`${BASE}/main/source-computing/source-services`,{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(3000);
    await page.getByRole('button',{name:/^\+?\s*Add$/i}).first().click(); await page.waitForTimeout(2500);
    await page.locator('input[data-testid="source-service-name"], [data-testid="source-service-name"] input').first().fill(group);
    await page.locator('[data-testid="source-service-with-connection"]').first().click(); await page.waitForTimeout(1200);
    await page.locator('input[data-testid="source-import-input"], [data-testid="source-import-input"]').first().setInputFiles(`${DIR}/${file}`);
    await page.waitForTimeout(5000);
    const rows = await page.locator('[data-testid="source-import-preview"] tbody tr').count();
    console.log(`  ${file}: 미리보기 ${rows}행`);
    const addBtn=page.getByRole('button',{name:/^Add$/}).last();
    await addBtn.click();
    // 실제 SSH 시도 때문에 오래 걸린다. 모달이 닫힐 때까지 기다린다.
    for (let i=0;i<40;i++){
      if ((await page.locator('[data-testid="source-import-preview"]').count())===0) break;
      await page.waitForTimeout(3000);
    }
    console.log(`  ${file}: 등록 요청 완료`);
  };

  await doImport('real-key.csv','bar1529-realkey-csv');
  await doImport('real-key.xlsx','bar1529-realkey-xlsx');
  await b.close();
};
run().catch(e=>{console.error('FATAL',e);process.exit(1);});
