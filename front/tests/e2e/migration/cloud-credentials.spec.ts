import { test, expect } from '@playwright/test';
import { captureTestStep, waitForPageLoad, performLogin } from '../utils/test-helpers';
import { testUser, pageUrls, timeouts } from '../fixtures/test-data';

/**
 * Phase 1: Cloud Credentials 테스트
 * - AWS 자격증명 등록/조회/삭제
 */
test.describe('Phase 1: Cloud Credentials 테스트', () => {
  const testCredentialName = `e2e-test-credential-${Date.now()}`;

  test.beforeEach(async ({ page }) => {
    await performLogin(page, testUser.username, testUser.password);
    await waitForPageLoad(page);
  });

  test('P1-01: Cloud Credentials 페이지 접속', async ({ page }) => {
    await captureTestStep(page, 'credentials-page-access', 'before', '네비게이션 전 화면');

    // Cloud Credentials 페이지로 이동
    await page.goto(pageUrls.cloudCredentials);
    await waitForPageLoad(page);

    // URL 확인
    expect(page.url()).toContain('cloud-credentials');

    // 페이지 요소 확인
    await expect(page.locator('text=Cloud Credentials').first()).toBeVisible();

    await captureTestStep(page, 'credentials-page-access', 'result', 'Cloud Credentials 페이지');
  });

  test('P1-02: AWS Credential 등록', async ({ page }) => {
    await page.goto(pageUrls.cloudCredentials);
    await waitForPageLoad(page);

    await captureTestStep(page, 'credentials-add', 'before', '등록 전 화면');

    // Add 버튼 클릭
    const addButton = page.locator('button:has-text("Add")').first();
    await expect(addButton).toBeVisible({ timeout: timeouts.medium });
    await addButton.click();

    // 모달 대기
    await page.waitForTimeout(timeouts.short);

    // 입력 필드 확인 및 입력
    const credentialNameInput = page.locator('input[placeholder*="Credential"], input[name*="credential"], .p-text-input input').first();

    if (await credentialNameInput.isVisible()) {
      await credentialNameInput.fill(testCredentialName);

      // AWS Access Key 입력
      const accessKeyInput = page.locator('input[placeholder*="Access"], input[name*="access"]').first();
      if (await accessKeyInput.isVisible()) {
        await accessKeyInput.fill('AKIAIOSFODNN7EXAMPLE');
      }

      // AWS Secret Key 입력
      const secretKeyInput = page.locator('input[placeholder*="Secret"], input[name*="secret"], input[type="password"]').first();
      if (await secretKeyInput.isVisible()) {
        await secretKeyInput.fill('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');
      }

      await captureTestStep(page, 'credentials-add', 'input', '입력값 입력 후');

      // Confirm 버튼 클릭
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Save")').first();
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
        await page.waitForTimeout(timeouts.medium);
      }
    }

    await captureTestStep(page, 'credentials-add', 'result', '등록 후 화면');
  });

  test('P1-03: Credential 목록 조회', async ({ page }) => {
    await page.goto(pageUrls.cloudCredentials);
    await waitForPageLoad(page);

    await captureTestStep(page, 'credentials-list', 'before', '목록 조회');

    // 테이블 존재 확인
    const table = page.locator('.p-data-table, table, .p-toolbox-table').first();
    await expect(table).toBeVisible({ timeout: timeouts.medium });

    await captureTestStep(page, 'credentials-list', 'result', '목록 조회 완료');
  });

  test('P1-04: Credential 상세 조회', async ({ page }) => {
    await page.goto(pageUrls.cloudCredentials);
    await waitForPageLoad(page);

    await captureTestStep(page, 'credentials-detail', 'before', '상세 조회 전');

    // 첫 번째 행 클릭
    const firstRow = page.locator('tr').nth(1);
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await page.waitForTimeout(timeouts.short);
    }

    await captureTestStep(page, 'credentials-detail', 'result', '상세 정보 표시');
  });
});
