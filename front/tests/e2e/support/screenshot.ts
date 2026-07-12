import { Page, TestInfo, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 화면 캡처 지원 — 웹은 계약(API)만 맞아도 *보이는 것*이 깨질 수 있어, 실행 후 화면을 남겨
 * 사람이 비교하거나 baseline과 자동 비교할 수 있게 한다.
 *
 * 두 가지를 제공한다.
 *  1) captureScreen()   — 시나리오 진행 중 임의 시점의 화면을 저장 + 리포트에 첨부.
 *                         (증거 보존용. 실패하지 않는다)
 *  2) expectScreenBaseline() — baseline 이미지와 픽셀 비교. baseline이 없으면 처음 실행에서 생성된다.
 *                         (시각 회귀 감지용. 차이가 임계치를 넘으면 실패)
 *
 * 저장 위치: test-results/screens/{시나리오}/{이름}.png
 * baseline:  tests/e2e/__screens__/{이름}.png  (git에 함께 보관)
 */

const SCREEN_DIR = 'test-results/screens';

function slug(s: string): string {
  return s.replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

/** 현재 화면을 저장하고 리포트에 첨부한다. 증거 보존용 — 실패시키지 않는다. */
export async function captureScreen(page: Page, testInfo: TestInfo, name: string): Promise<string> {
  const dir = path.join(SCREEN_DIR, slug(testInfo.title));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${slug(name)}.png`);
  await page.screenshot({ path: file, fullPage: true });
  await testInfo.attach(name, { path: file, contentType: 'image/png' });
  return file;
}

/**
 * baseline 이미지와 비교한다. 화면이 의도치 않게 바뀌면 실패한다.
 *
 * 처음 실행하면 baseline이 없으므로 Playwright가 생성하고 통과시킨다(그 결과를 리뷰 후 커밋).
 * 애니메이션·시간 표시 같은 흔들리는 영역은 mask로 제외한다.
 */
export async function expectScreenBaseline(
  page: Page,
  name: string,
  opts: { maxDiffPixelRatio?: number; mask?: ReturnType<Page['locator']>[] } = {},
): Promise<void> {
  await expect(page).toHaveScreenshot(`${slug(name)}.png`, {
    fullPage: true,
    animations: 'disabled',
    maxDiffPixelRatio: opts.maxDiffPixelRatio ?? 0.02,
    mask: opts.mask,
  });
}
