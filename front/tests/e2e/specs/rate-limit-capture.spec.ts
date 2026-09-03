import { test, expect, request as pwRequest } from '@playwright/test';
import fs from 'node:fs';
import { getUser, testNamespace } from '../fixtures/test-data';
import { LoginPage } from '../pages/login.page';
import { WorkloadPage } from '../pages/workload.page';

/**
 * Photograph the workload screens with a real lineup, quiet and busy.
 *
 * What the retry notices look like cannot be judged from a mock: the mock is what decides to
 * refuse, so the screen it produces is the screen we asked for. Here the refusals come from the
 * linked system's own limit, reached by asking it for the infra list from the side while the
 * console is doing its work.
 *
 * Saves nothing to the environment beyond deleting the workloads it is pointed at — which is the
 * thing being watched.
 *
 *   BASE_URL=http://localhost API_URL=http://localhost:4000 \
 *   SHOT_DIR=/tmp/shots npx playwright test \
 *     --config=tests/e2e/playwright.specs.config.ts rate-limit-capture
 */

const DIR = process.env.SHOT_DIR || '/tmp/rate-limit-shots';
const API = process.env.API_URL || 'http://localhost:4000';
const NS = testNamespace.id;

/** The workloads this run deletes. Whatever is not there is skipped. */
const QUIET_TARGET = process.env.RATELIMIT_QUIET || 'ratelimit-nano-1';
const BUSY_TARGETS = (
  process.env.RATELIMIT_BUSY || 'ratelimit-nano-2,ratelimit-nano-4'
)
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

/**
 * Keeps the linked system busy enough to turn requests away.
 *
 * The infra lookup is capped, and everything reaching it through cm-beetle draws on the same
 * allowance — so asking for the list from here, hard, is enough to make the console's own
 * requests wait their turn. It is the real limit doing the refusing, which is the point.
 */
class Load {
  private stop = false;
  private done!: Promise<void>;

  constructor(
    private token: string,
    // How many at once. The far side admits a fixed number of waiting callers before it starts
    // turning them away, so this is the knob that decides whether a refusal happens at all.
    private concurrency = Number(process.env.RATELIMIT_LOAD || 12),
  ) {}

  start(): void {
    this.stop = false;
    const ctx = pwRequest.newContext({
      extraHTTPHeaders: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
    });
    const one = async () => {
      const c = await ctx;
      while (!this.stop) {
        await c
          .post(`${API}/api/cm-beetle/ListInfra`, {
            data: { pathParams: { nsId: NS }, queryParams: {}, request: {} },
            timeout: 20_000,
          })
          .catch(() => undefined);
      }
    };
    this.done = Promise.all(Array.from({ length: this.concurrency }, one)).then(
      () => undefined,
    );
  }

  async end(): Promise<void> {
    this.stop = true;
    await this.done;
  }
}

async function shot(page: any, name: string): Promise<void> {
  fs.mkdirSync(DIR, { recursive: true });
  await page.screenshot({ path: `${DIR}/${name}.png` });
  console.log(`[shot] ${name}`);
}

/** Watch for the retry notice and photograph it while it is up. */
async function catchRetryNotice(
  page: any,
  testId: string,
  name: string,
  timeoutMs = 60_000,
): Promise<boolean> {
  try {
    await expect(page.getByTestId(testId)).toBeVisible({ timeout: timeoutMs });
  } catch {
    console.log(`[shot] ${name} — 재시도 표시가 뜨지 않았다`);
    return false;
  }
  await shot(page, name);
  const text = await page.getByTestId(testId).innerText();
  console.log(`[shot] ${name} 문구: ${text.replace(/\s+/g, ' ')}`);
  return true;
}

test('workload screens, quiet and busy @integration', async ({ page }) => {
  test.setTimeout(30 * 60_000);

  const user = getUser('cmiguser');
  const login = new LoginPage(page);
  await login.goto();
  await login.login(user.id, user.password);
  await login.expectLoggedIn();

  // A token of our own for the side traffic — the console's is in the browser.
  const api = await pwRequest.newContext();
  const res = await api.post(`${API}/api/auth/login`, {
    data: { request: { id: user.id, password: user.password } },
  });
  const token = (await res.json()).responseData.access_token as string;
  const load = new Load(token);

  const wl = new WorkloadPage(page);

  // ── 1. Quiet: the list as it normally arrives ────────────────────────
  await wl.gotoMci();
  await wl.expectMciListLoaded();
  await shot(page, '10-정상-워크로드-목록');

  // Just the list, for a shot of how it stands. Nothing is deleted.
  if (process.env.RATELIMIT_SHOT_ONLY === '1') return;

  /**
   * The list waiting its turn, and nothing else. Deletes nothing, so it needs no workloads.
   *
   * Useful on its own because the wait the list shows is the one thing that changes when the
   * far side starts answering these refusals with a status and a time of its own.
   */
  if (process.env.RATELIMIT_MODE === 'list-only') {
    load.start();
    await page.waitForTimeout(1_500);
    const reloading = page.reload();
    await catchRetryNotice(
      page,
      'mci-list-retry-notice',
      '60-목록조회-대기',
      60_000,
    );
    await page.waitForTimeout(1_200);
    await shot(page, '61-목록조회-대기-카운트다운');
    await reloading.catch(() => undefined);
    await load.end();
    await wl.expectMciListLoaded().catch(() => undefined);
    await shot(page, '62-부하해제-복구');
    return;
  }

  /**
   * Delete one workload while the far side is too busy to take the work behind the acceptance.
   *
   * This is the case the request record was extended for. The request is accepted, so nothing is
   * refused on the way out; the refusal happens later, inside the job, and reaches the console
   * only through the record. What the screen must not do is call that a failure of the delete —
   * nothing was started, so the workload is still there to be deleted again.
   *
   * The load has to come from outside: it is built out of deletes, which is the only thing that
   * queues deeply enough, and this run has one workload to spare rather than fifty.
   */
  if (process.env.RATELIMIT_MODE === 'async-refusal') {
    await wl.selectMci(QUIET_TARGET);
    await wl.openDeleteModal();

    // The backlog is built *here*, not before, and taken down again straight after. Everything
    // that reaches the far side shares one queue, so a backlog deep enough to turn the delete
    // away also stops the list from loading — and then there is no screen to photograph. The
    // dialog is already open by this point and needs nothing from the far side.
    load.start();
    await page.waitForTimeout(12_000);
    await wl.sendDelete(QUIET_TARGET, 'normal');
    await expect(page.getByTestId('mci-delete-progress')).toBeVisible({
      timeout: 60_000,
    });
    await shot(page, '70-비동기거절-접수됨');
    await load.end();
    await wl.closeDeleteModal();

    // The tracker is what learns the outcome, so this waits on the row rather than the dialog.
    await expect
      .poll(
        async () => {
          await wl.gotoMci().catch(() => undefined);
          await wl.expectMciListLoaded().catch(() => undefined);
          return page
            .getByRole('row', { name: new RegExp(QUIET_TARGET) })
            .first()
            .innerText()
            .catch(() => '');
        },
        { timeout: 5 * 60_000, intervals: [5_000] },
      )
      .toContain('Failed');
    await shot(page, '71-비동기거절-목록-실패표시');

    await page
      .getByRole('row', { name: new RegExp(QUIET_TARGET) })
      .first()
      .hover();
    await page.waitForTimeout(800);
    await shot(page, '72-비동기거절-사유');

    // The notification is where the console says what to do about it, and that sentence is the
    // point of the whole exchange: nothing was started, so this is not a retry of half-done work.
    await page.getByTestId('notification-badge').click();
    await page.waitForTimeout(1_500);
    await shot(page, '73-비동기거절-알림');
    return;
  }

  /**
   * Delete one workload while something *outside* this run is holding the far side busy.
   *
   * The load this script makes on its own trips the request-rate limit, which answers 429 and
   * says nothing about how long to wait. The other limit — the one that does say, with
   * `Retry-After` — is on how many background jobs may run at once, and reaching it means
   * occupying those jobs from elsewhere. That is done outside this file, and this mode is what
   * photographs the screen while it holds.
   */
  if (process.env.RATELIMIT_MODE === 'external-load') {
    await wl.selectMci(QUIET_TARGET);
    await wl.openDeleteModal();
    await wl.sendDelete(QUIET_TARGET, 'normal');
    await catchRetryNotice(
      page,
      'mci-delete-retry-notice',
      '50-외부부하-삭제-재시도',
      60_000,
    );
    await page.waitForTimeout(1_500);
    await shot(page, '51-외부부하-삭제-재시도-카운트다운');
    await expect(page.getByTestId('mci-delete-progress')).toBeVisible({
      timeout: 5 * 60_000,
    });
    await shot(page, '52-외부부하-접수완료');
    return;
  }

  // ── 2. Busy: the list waiting its turn ───────────────────────────────
  load.start();
  await page.waitForTimeout(1_500);
  const reload = page.reload();
  await catchRetryNotice(
    page,
    'mci-list-retry-notice',
    '11-부하-목록조회-재시도',
    40_000,
  );
  await reload.catch(() => undefined);
  await load.end();
  await wl.expectMciListLoaded().catch(() => undefined);
  await shot(page, '12-부하해제-목록-복구');

  // ── 3. Quiet: deleting one, start to finish ──────────────────────────
  await wl.gotoMci();
  await wl.expectMciListLoaded();
  await wl.selectMci(QUIET_TARGET);
  await wl.openDeleteModal();
  await shot(page, '20-정상-삭제-확인단계');
  await wl.sendDelete(QUIET_TARGET, 'normal');
  await expect(page.getByTestId('mci-delete-progress')).toBeVisible({
    timeout: 60_000,
  });
  await shot(page, '21-정상-삭제-처리중');
  await wl.closeDeleteModal();
  await page.waitForTimeout(2_000);
  await shot(page, '22-정상-목록-삭제상태');

  // ── 4. Busy: deleting while the far side is full ─────────────────────
  await wl.gotoMci();
  await wl.expectMciListLoaded();
  for (const name of BUSY_TARGETS) await wl.selectMci(name);
  await wl.openDeleteModal();
  await shot(page, '30-부하-삭제-확인단계');

  load.start();
  await page.waitForTimeout(1_000);
  const keyword =
    BUSY_TARGETS.length === 1 ? BUSY_TARGETS[0] : BUSY_TARGETS.join(', ');
  await wl.sendDelete(keyword, 'normal');
  const caught = await catchRetryNotice(
    page,
    'mci-delete-retry-notice',
    '31-부하-삭제-재시도',
    60_000,
  );
  if (caught) {
    // Once more a second later, so the countdown can be seen to move.
    await page.waitForTimeout(1_200);
    await shot(page, '32-부하-삭제-재시도-카운트다운');
  }
  await load.end();

  await expect(page.getByTestId('mci-delete-progress')).toBeVisible({
    timeout: 120_000,
  });
  await shot(page, '33-부하-삭제-접수완료');
  await wl.closeDeleteModal();
  await page.waitForTimeout(2_000);
  await shot(page, '34-부하-목록-삭제상태');

  // ── 5. The deletes finishing ─────────────────────────────────────────
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(15_000);
    await wl.gotoMci();
    await wl.expectMciListLoaded().catch(() => undefined);
    const left = await page.locator('tbody tr').count();
    console.log(`[wait] ${i}: 행 ${left}`);
    const gone = await page
      .getByRole('row', { name: new RegExp(QUIET_TARGET) })
      .count();
    if (gone === 0) break;
  }
  await shot(page, '40-삭제완료-목록');
});
