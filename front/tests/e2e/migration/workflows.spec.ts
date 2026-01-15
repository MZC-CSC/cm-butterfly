import { test, expect } from '@playwright/test';
import { captureTestStep, waitForPageLoad, performLogin } from '../utils/test-helpers';
import { testUser, pageUrls, timeouts } from '../fixtures/test-data';

/**
 * Phase 4: Workflows 테스트
 * - Workflow 생성 (Target Model 기반)
 * - Workflow 목록/상세 조회
 * - Workflow 수정
 *
 * 주의: Workflow 실행은 비용이 발생하므로 이 테스트에서는 실행하지 않음
 */
test.describe('Phase 4: Workflows 테스트', () => {
  const testWorkflowName = `e2e-test-workflow-${Date.now()}`;

  test.beforeEach(async ({ page }) => {
    await performLogin(page, testUser.username, testUser.password);
    await waitForPageLoad(page);
  });

  test('P4-01: Workflows 페이지 접속', async ({ page }) => {
    await captureTestStep(page, 'workflows-page', 'before', '네비게이션 전');

    await page.goto(pageUrls.workflows);
    await waitForPageLoad(page);

    expect(page.url()).toContain('workflows');
    await expect(page.locator('text=Workflows').first()).toBeVisible();

    await captureTestStep(page, 'workflows-page', 'result', 'Workflows 페이지');
  });

  test('P4-02: Target Model에서 Workflow 생성', async ({ page }) => {
    // Target Models 페이지로 이동
    await page.goto(pageUrls.targetModels);
    await waitForPageLoad(page);

    // 첫 번째 Target Model 선택
    const firstRow = page.locator('tbody tr').first();
    if (await firstRow.isVisible({ timeout: timeouts.medium })) {
      await firstRow.click();
      await page.waitForTimeout(timeouts.short);
    }

    await captureTestStep(page, 'workflow-create-from-target', 'before', 'Workflow 생성 전');

    // Workflow Editor 버튼 클릭
    const workflowButton = page.locator('button:has-text("Workflow"), button:has-text("Create Workflow")').first();
    if (await workflowButton.isVisible()) {
      await workflowButton.click();
      await page.waitForTimeout(timeouts.medium);
    }

    // Workflow Name 입력
    const nameInput = page.locator('input[placeholder*="name"], input[placeholder*="Name"], input[placeholder*="workflow"]').first();
    if (await nameInput.isVisible()) {
      await nameInput.fill(testWorkflowName);
    }

    await captureTestStep(page, 'workflow-create-from-target', 'input', 'Workflow 정보 입력');

    // Create/Save 버튼 클릭
    const createButton = page.locator('button:has-text("Create"), button:has-text("Save")').first();
    if (await createButton.isVisible()) {
      await createButton.click();
      await page.waitForTimeout(timeouts.medium);
    }

    await captureTestStep(page, 'workflow-create-from-target', 'result', 'Workflow 생성 완료');
  });

  test('P4-03: Workflow 목록 조회', async ({ page }) => {
    await page.goto(pageUrls.workflows);
    await waitForPageLoad(page);

    await captureTestStep(page, 'workflow-list', 'before', '목록 조회');

    // 테이블 확인
    const table = page.locator('.p-data-table, table, .p-toolbox-table').first();
    await expect(table).toBeVisible({ timeout: timeouts.medium });

    // 데이터 행 존재 확인
    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();
    console.log(`Workflow 목록 수: ${rowCount}`);

    await captureTestStep(page, 'workflow-list', 'result', '목록 표시');
  });

  test('P4-04: Workflow 상세 조회', async ({ page }) => {
    await page.goto(pageUrls.workflows);
    await waitForPageLoad(page);

    await captureTestStep(page, 'workflow-detail', 'before', '상세 조회 전');

    // 첫 번째 Workflow 클릭
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

    await captureTestStep(page, 'workflow-detail', 'result', 'Workflow 상세 정보');
  });

  test('P4-05: Workflow 이름 수정', async ({ page }) => {
    await page.goto(pageUrls.workflows);
    await waitForPageLoad(page);

    // 첫 번째 Workflow 클릭
    const firstRow = page.locator('tbody tr').first();
    if (await firstRow.isVisible({ timeout: timeouts.medium })) {
      await firstRow.click();
      await page.waitForTimeout(timeouts.short);
    }

    await captureTestStep(page, 'workflow-edit', 'before', '수정 전');

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
      await nameInput.fill(`updated-workflow-${Date.now()}`);
    }

    await captureTestStep(page, 'workflow-edit', 'input', '수정 입력');

    // Save 버튼 클릭
    const saveButton = page.locator('button:has-text("Save"), button:has-text("Confirm")').first();
    if (await saveButton.isVisible()) {
      await saveButton.click();
      await page.waitForTimeout(timeouts.medium);
    }

    await captureTestStep(page, 'workflow-edit', 'result', '수정 완료');
  });

  test('P4-06: Workflow Editor로 수정', async ({ page }) => {
    await page.goto(pageUrls.workflows);
    await waitForPageLoad(page);

    // 첫 번째 Workflow 클릭
    const firstRow = page.locator('tbody tr').first();
    if (await firstRow.isVisible({ timeout: timeouts.medium })) {
      await firstRow.click();
      await page.waitForTimeout(timeouts.short);
    }

    await captureTestStep(page, 'workflow-editor', 'before', 'Editor 열기 전');

    // Workflow Tool 버튼 클릭
    const toolButton = page.locator('button:has-text("Workflow Tool"), button:has-text("Edit Workflow")').first();
    if (await toolButton.isVisible()) {
      await toolButton.click();
      await page.waitForTimeout(timeouts.medium);
    }

    await captureTestStep(page, 'workflow-editor', 'input', 'Workflow Editor 표시');

    // Close/Cancel 버튼 클릭 (저장 없이 닫기)
    const closeButton = page.locator('button:has-text("Close"), button:has-text("Cancel"), [aria-label="Close"]').first();
    if (await closeButton.isVisible()) {
      await closeButton.click();
      await page.waitForTimeout(timeouts.short);
    }

    await captureTestStep(page, 'workflow-editor', 'result', 'Editor 닫힘');
  });

  test('P4-07: Workflow JSON 뷰어', async ({ page }) => {
    await page.goto(pageUrls.workflows);
    await waitForPageLoad(page);

    // 첫 번째 Workflow 클릭
    const firstRow = page.locator('tbody tr').first();
    if (await firstRow.isVisible({ timeout: timeouts.medium })) {
      await firstRow.click();
      await page.waitForTimeout(timeouts.short);
    }

    await captureTestStep(page, 'workflow-json', 'before', 'JSON 뷰어 열기 전');

    // Custom View 버튼 클릭
    const customViewButton = page.locator('button:has-text("Custom View"), button:has-text("View JSON")').first();
    if (await customViewButton.isVisible()) {
      await customViewButton.click();
      await page.waitForTimeout(timeouts.short);
    }

    await captureTestStep(page, 'workflow-json', 'result', 'JSON 데이터 표시');
  });

  test('P4-08: Workflow History 탭 확인', async ({ page }) => {
    await page.goto(pageUrls.workflows);
    await waitForPageLoad(page);

    // 첫 번째 Workflow 클릭
    const firstRow = page.locator('tbody tr').first();
    if (await firstRow.isVisible({ timeout: timeouts.medium })) {
      await firstRow.click();
      await page.waitForTimeout(timeouts.short);
    }

    await captureTestStep(page, 'workflow-history', 'before', 'History 탭 클릭 전');

    // History 탭 클릭
    const historyTab = page.locator('button:has-text("History"), [role="tab"]:has-text("History")').first();
    if (await historyTab.isVisible()) {
      await historyTab.click();
      await page.waitForTimeout(timeouts.short);
    }

    await captureTestStep(page, 'workflow-history', 'result', 'History 탭 표시');
  });
});

/**
 * Phase 5: Workflow 실행 (비용 발생 - 별도 실행)
 *
 * 주의: 아래 테스트는 실제 클라우드 리소스를 생성하여 비용이 발생합니다.
 * 필요 시 별도로 실행하세요.
 */
test.describe.skip('Phase 5: Workflow 실행 (비용 발생)', () => {
  test.beforeEach(async ({ page }) => {
    await performLogin(page, testUser.username, testUser.password);
    await waitForPageLoad(page);
  });

  test('P5-01: Workflow 실행', async ({ page }) => {
    await page.goto(pageUrls.workflows);
    await waitForPageLoad(page);

    // 첫 번째 Workflow 클릭
    const firstRow = page.locator('tbody tr').first();
    if (await firstRow.isVisible({ timeout: timeouts.medium })) {
      await firstRow.click();
      await page.waitForTimeout(timeouts.short);
    }

    await captureTestStep(page, 'workflow-run', 'before', '실행 전');

    // Run 버튼 클릭
    const runButton = page.locator('button:has-text("Run")').first();
    if (await runButton.isVisible()) {
      await runButton.click();
      await page.waitForTimeout(timeouts.short);
    }

    // 확인 다이얼로그
    const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes")').first();
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }

    await captureTestStep(page, 'workflow-run', 'input', '실행 시작');

    // 실행 완료 대기 (최대 5분)
    await page.waitForTimeout(300000);

    await captureTestStep(page, 'workflow-run', 'result', '실행 완료');
  });
});
