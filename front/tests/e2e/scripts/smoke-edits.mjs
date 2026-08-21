// 시나리오가 화면에서 하는 편집을 실제로 해 보고, 값이 들어갔는지 확인한다. 2분이면 끝난다.
//
// ★ 편집 경로를 손봤으면 촬영을 걸기 전에 이것부터 돌린다. 한 벌을 찍는 데 45분이 걸리고, 그
//   45분을 다 쓴 뒤에야 "규칙을 못 찾았다"를 보게 되는 일이 하루에 네 번 있었다. 여기서 걸리는
//   것은 촬영에서도 반드시 걸리고, 여기서 통과하면 그 자리는 촬영에서도 통과한다.
//
//   저장하지 않는다 — 확인이 끝나면 취소하고 나오므로 환경이 더러워지지 않는다.
//
// 사용법:
//   BASE_URL=http://localhost node scripts/smoke-edits.mjs
//   SOURCE_MODEL=onprem-web TARGET_MODEL=infra-nano-aws ... (이름이 다를 때)
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL || process.env.PROBE_BASE;
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1700, height: 1000 } });
let bad = 0;
const ok = (label, cond, detail = '') => {
  console.log(
    `  ${cond ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`,
  );
  if (!cond) bad++;
};

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page
  .locator('input[data-testid="login-id"], textarea[data-testid="login-id"]')
  .first()
  .fill('cmiguser');
await page
  .locator(
    'input[data-testid="login-password"], textarea[data-testid="login-password"]',
  )
  .first()
  .fill('cmiguserPassword!');
await page.getByTestId('login-submit').click();
await page.waitForURL(/\/main/, { timeout: 30000 });
const w = page.getByTestId('guided-setup-welcome');
if (await w.isVisible({ timeout: 3000 }).catch(() => false))
  await page.getByTestId('guided-setup-welcome-dismiss').click();

const rules = () =>
  page.evaluate(() => {
    const rows = Array.from(
      document.querySelectorAll('.pg-table tbody tr.pg-row'),
    );
    const read = p => {
      const r = rows.find(x => x.dataset.path === p);
      return (r?.querySelector('.pg-value')?.textContent ?? '').trim();
    };
    const out = [];
    for (const r of rows) {
      const path = r.dataset.path ?? '';
      const field = ['.dstPorts', '.Ports'].find(f => path.endsWith(f));
      if (!field) continue;
      const rule = path.slice(0, -field.length);
      out.push({
        rule,
        field,
        port: (r.querySelector('.pg-value')?.textContent ?? '').trim(),
        cidr: read(`${rule}.dstCIDR`) || read(`${rule}.CIDR`),
      });
    }
    return out;
  });

async function openEditor(kind, name) {
  await page.goto(
    `${BASE}/main/models/${kind === 'source' ? 'source-models' : 'target-models'}`,
  );
  await page.waitForTimeout(4000);
  const row = page.locator('tbody tr', { hasText: name }).first();
  if (!(await row.isVisible().catch(() => false))) return false;
  await row.click();
  await page.waitForTimeout(2000);
  await page
    .getByTestId(
      kind === 'source'
        ? 'source-detail-custom-view'
        : 'target-detail-custom-view',
    )
    .click();
  await page.waitForTimeout(2500);
  await page
    .locator('.jse-menu button')
    .filter({ hasText: /^\s*table\s*$/ })
    .first()
    .click();
  await page.waitForTimeout(1000);
  await page.locator('.jse-menu button[title="Expand all"]').first().click();
  await page.waitForTimeout(1200);
  return true;
}

async function setValue(rulePath) {
  const row = page.locator(
    `[data-path="${rulePath}.dstPorts"], [data-path="${rulePath}.Ports"]`,
  );
  await row.locator('.pg-cell-value').dblclick();
  const input = page.locator('.pg-edit-input');
  await input.waitFor({ state: 'visible', timeout: 8000 });
  await input.fill('5555');
  await input.press('Enter');
  await page.waitForTimeout(800);
}

for (const [kind, name] of [
  ['source', process.env.SOURCE_MODEL || 'onprem-web'],
  ['target', process.env.TARGET_MODEL || 'infra-nano-aws'],
]) {
  console.log(`=== ${kind} · ${name} ===`);
  /*
    없으면 건너뛴다 — 실패가 아니다.

    ★ 이 점검이 보는 것은 *편집이 되는가* 이지 모델이 있는가가 아니다. 촬영은 자료를 비우고
      시작하므로 그 직후에는 모델이 하나도 없고, 그것을 실패로 세면 촬영 자체가 막힌다(실제로
      막았다). 있을 때만 확인하고, 없으면 그 구간이 만들면서 확인된다.
  */
  if (!(await openEditor(kind, name))) {
    console.log(
      `  ⏭  건너뜀 — "${name}" 이 목록에 없다(자료를 비운 직후라면 정상)`,
    );
    continue;
  }

  const before = await rules();
  const v4 = before.find(
    r => r.port === '22' && r.cidr && !r.cidr.includes('::/'),
  );
  ok('IPv4 22 규칙을 찾는다', !!v4, v4?.rule);
  if (!v4) continue;

  // 복제
  const item = page.locator(`[data-path="${v4.rule}"]`);
  await item.hover();
  await page.waitForTimeout(300);
  const dup = item.getByTestId('json-grid-row-duplicate');
  ok('복제 버튼이 있다', (await dup.count()) > 0);
  if (!(await dup.count())) continue;
  await dup.first().click();
  await page.waitForTimeout(1200);
  // 새 항목은 접힌 채로 온다 — 다시 펼쳐야 그 자식 행이 생긴다
  await page.locator('.jse-menu button[title="Expand all"]').first().click();
  await page.waitForTimeout(1200);

  const mid = await rules();
  ok(
    '규칙이 하나 늘었다',
    mid.length === before.length + 1,
    `${before.length} → ${mid.length}`,
  );

  // 원본 행의 값을 바꾼다
  await setValue(v4.rule);
  const after = await rules();
  const edited = after.find(r => r.rule === v4.rule);
  ok(
    '그 행이 5555 가 됐다',
    edited?.port === '5555',
    `port=${edited?.port} cidr=${edited?.cidr}`,
  );
  ok(
    '그 규칙은 IPv4 다',
    !!edited?.cidr && !edited.cidr.includes('::/'),
    edited?.cidr,
  );
  ok(
    '22 규칙도 남아 있다',
    after.some(r => r.port === '22' && r.cidr && !r.cidr.includes('::/')),
  );

  // 저장하지 않고 나온다
  await page
    .getByTestId(
      kind === 'source' ? 'source-custom-cancel' : 'target-custom-cancel',
    )
    .click()
    .catch(() => {});
  await page.waitForTimeout(1500);
}

console.log(bad === 0 ? '\n✅ 편집 경로 전부 정상' : `\n❌ ${bad}건 실패`);
await b.close();
process.exit(bad === 0 ? 0 : 1);
