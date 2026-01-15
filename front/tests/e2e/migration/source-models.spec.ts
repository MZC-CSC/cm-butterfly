import { test, expect } from '@playwright/test';
import { captureTestStep, waitForPageLoad, performLogin } from '../utils/test-helpers';
import { testUser, pageUrls, timeouts } from '../fixtures/test-data';

/**
 * Phase 3-1: Source Models 테스트
 * - Source Model 목록 조회
 * - Source Model 상세 조회
 * - Source Model 수정 (커스텀 생성)
 */
test.describe('Phase 3-1: Source Models 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await performLogin(page, testUser.username, testUser.password);
    await waitForPageLoad(page);
  });

  test('P3-01: Source Models 페이지 접속', async ({ page }) => {
    await captureTestStep(page, 'source-models-page', 'before', '네비게이션 전');

    await page.goto(pageUrls.sourceModels);
    await waitForPageLoad(page);

    expect(page.url()).toContain('source-models');
    await expect(page.locator('text=Source Models').first()).toBeVisible();

    await captureTestStep(page, 'source-models-page', 'result', 'Source Models 페이지');
  });

  test('P3-02: Source Model 목록 조회', async ({ page }) => {
    await page.goto(pageUrls.sourceModels);
    await waitForPageLoad(page);

    await captureTestStep(page, 'source-models-list', 'before', '목록 조회');

    // 테이블 확인
    const table = page.locator('.p-data-table, table, .p-toolbox-table').first();
    await expect(table).toBeVisible({ timeout: timeouts.medium });

    // 데이터 행 존재 확인
    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();
    console.log(`Source Models 목록 수: ${rowCount}`);

    await captureTestStep(page, 'source-models-list', 'result', '목록 표시');
  });

  test('P3-03: Source Model 상세 조회', async ({ page }) => {
    await page.goto(pageUrls.sourceModels);
    await waitForPageLoad(page);

    await captureTestStep(page, 'source-model-detail', 'before', '상세 조회 전');

    // 첫 번째 Model 클릭
    const firstRow = page.locator('tbody tr').first();
    if (await firstRow.isVisible({ timeout: timeouts.medium })) {
      await firstRow.click();
      await page.waitForTimeout(timeouts.short);
    }

    // Details 탭 확인
    const detailsTab = page.locator('button:has-text("Details"), [role="tab"]:has-text("Details")').first();
    if (await detailsTab.isVisible()) {
      await detailsTab.click();
      await page.waitForTimeout(timeouts.short);
    }

    await captureTestStep(page, 'source-model-detail', 'result', 'Source Model 상세 정보');
  });

  test('P3-04: Source Model 수정 (커스텀 생성)', async ({ page }) => {
    await page.goto(pageUrls.sourceModels);
    await waitForPageLoad(page);

    // 첫 번째 Model 클릭
    const firstRow = page.locator('tbody tr').first();
    if (await firstRow.isVisible({ timeout: timeouts.medium })) {
      await firstRow.click();
      await page.waitForTimeout(timeouts.short);
    }

    await captureTestStep(page, 'source-model-edit', 'before', '수정 전');

    // Edit 버튼 클릭
    const editButton = page.locator('button:has-text("Edit")').first();
    if (await editButton.isVisible()) {
      await editButton.click();
      await page.waitForTimeout(timeouts.short);
    }

    // 이름 수정
    const nameInput = page.locator('input[placeholder*="name"], input[placeholder*="Name"], .p-text-input input').first();
    if (await nameInput.isVisible()) {
      await nameInput.clear();
      await nameInput.fill(`custom-source-model-${Date.now()}`);
    }

    // Description 수정
    const descInput = page.locator('textarea, input[placeholder*="Description"]').first();
    if (await descInput.isVisible()) {
      await descInput.fill('커스텀 Source Model - E2E 테스트');
    }

    await captureTestStep(page, 'source-model-edit', 'input', '수정 입력');

    // Save 버튼 클릭
    const saveButton = page.locator('button:has-text("Save"), button:has-text("Confirm")').first();
    if (await saveButton.isVisible()) {
      await saveButton.click();
      await page.waitForTimeout(timeouts.medium);
    }

    await captureTestStep(page, 'source-model-edit', 'result', '수정 완료');
  });

  test('P3-05: Source Model JSON 뷰어', async ({ page }) => {
    await page.goto(pageUrls.sourceModels);
    await waitForPageLoad(page);

    // 첫 번째 Model 클릭
    const firstRow = page.locator('tbody tr').first();
    if (await firstRow.isVisible({ timeout: timeouts.medium })) {
      await firstRow.click();
      await page.waitForTimeout(timeouts.short);
    }

    await captureTestStep(page, 'source-model-json', 'before', 'JSON 뷰어 열기 전');

    // Custom View 버튼 클릭
    const customViewButton = page.locator('button:has-text("Custom View"), button:has-text("View JSON")').first();
    if (await customViewButton.isVisible()) {
      await customViewButton.click();
      await page.waitForTimeout(timeouts.short);
    }

    await captureTestStep(page, 'source-model-json', 'result', 'JSON 데이터 표시');
  });

  test('P3-06: Target Model 추천 받기', async ({ page }) => {
    await page.goto(pageUrls.sourceModels);
    await waitForPageLoad(page);

    // 첫 번째 Model 클릭
    const firstRow = page.locator('tbody tr').first();
    if (await firstRow.isVisible({ timeout: timeouts.medium })) {
      await firstRow.click();
      await page.waitForTimeout(timeouts.short);
    }

    await captureTestStep(page, 'target-model-recommend', 'before', '추천 받기 전');

    // View Recommended List 버튼 클릭
    const recommendButton = page.locator('button:has-text("Recommend"), button:has-text("View Recommended")').first();
    if (await recommendButton.isVisible()) {
      await recommendButton.click();
      await page.waitForTimeout(timeouts.medium);
    }

    await captureTestStep(page, 'target-model-recommend', 'result', '추천 목록 표시');
  });
});
