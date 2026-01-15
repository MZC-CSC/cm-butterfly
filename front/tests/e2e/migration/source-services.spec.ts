import { test, expect } from '@playwright/test';
import { captureTestStep, waitForPageLoad, performLogin } from '../utils/test-helpers';
import { testUser, pageUrls, timeouts } from '../fixtures/test-data';

/**
 * Phase 2: Source Services 테스트
 * - Source Service 생성/수정/삭제
 * - Source Connection 추가
 * - Infra/Software Collect
 */

/**
 * 테스트용 EC2 정보
 *
 * 환경 변수 설정 필요:
 * - TEST_EC2_IP: EC2 Public IP
 * - TEST_EC2_SSH_KEY: SSH Private Key (선택, 파일 경로 또는 직접 입력)
 *
 * 테스트 실행 예시:
 * TEST_EC2_IP=1.2.3.4 TEST_EC2_SSH_KEY="$(cat ~/.ssh/my-key.pem)" npm test
 */
const testEC2 = {
  ip: process.env.TEST_EC2_IP || '127.0.0.1',
  port: process.env.TEST_EC2_PORT || '22',
  user: process.env.TEST_EC2_USER || 'ec2-user',
  privateKey: process.env.TEST_EC2_SSH_KEY || '',
};

test.describe('Phase 2: Source Services 테스트', () => {
  const testServiceName = `e2e-test-service-${Date.now()}`;
  const testConnectionName = `e2e-test-connection-${Date.now()}`;

  test.beforeEach(async ({ page }) => {
    await performLogin(page, testUser.username, testUser.password);
    await waitForPageLoad(page);
  });

  test('P2-01: Source Services 페이지 접속', async ({ page }) => {
    await captureTestStep(page, 'source-services-page', 'before', '네비게이션 전');

    await page.goto(pageUrls.sourceServices);
    await waitForPageLoad(page);

    expect(page.url()).toContain('source-services');
    await expect(page.locator('text=Source Services').first()).toBeVisible();

    await captureTestStep(page, 'source-services-page', 'result', 'Source Services 페이지');
  });

  test('P2-02: Source Service 생성', async ({ page }) => {
    await page.goto(pageUrls.sourceServices);
    await waitForPageLoad(page);

    await captureTestStep(page, 'source-service-create', 'before', '생성 전');

    // Add 버튼 클릭
    const addButton = page.locator('button:has-text("Add")').first();
    await expect(addButton).toBeVisible({ timeout: timeouts.medium });
    await addButton.click();

    // 모달 대기
    await page.waitForTimeout(timeouts.short);

    // Service Name 입력
    const nameInput = page.locator('input[placeholder*="name"], input[placeholder*="Name"], .p-text-input input').first();
    if (await nameInput.isVisible()) {
      await nameInput.fill(testServiceName);
    }

    // Description 입력
    const descInput = page.locator('textarea, input[placeholder*="Description"]').first();
    if (await descInput.isVisible()) {
      await descInput.fill('E2E 테스트용 Source Service');
    }

    await captureTestStep(page, 'source-service-create', 'input', '입력 후');

    // Confirm 버튼 클릭
    const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Save"), button:has-text("Create")').first();
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
      await page.waitForTimeout(timeouts.medium);
    }

    await captureTestStep(page, 'source-service-create', 'result', '생성 후');
  });

  test('P2-03: Source Service 목록에서 선택', async ({ page }) => {
    await page.goto(pageUrls.sourceServices);
    await waitForPageLoad(page);

    await captureTestStep(page, 'source-service-select', 'before', '선택 전');

    // 테이블에서 첫 번째 행 클릭
    const tableRow = page.locator('tr').filter({ hasText: /test|e2e|service/i }).first();
    if (await tableRow.isVisible({ timeout: timeouts.short })) {
      await tableRow.click();
    } else {
      // 첫 번째 데이터 행 클릭
      const firstDataRow = page.locator('tbody tr').first();
      if (await firstDataRow.isVisible()) {
        await firstDataRow.click();
      }
    }

    await page.waitForTimeout(timeouts.short);
    await captureTestStep(page, 'source-service-select', 'result', 'Service 선택됨');
  });

  test('P2-04: Source Connection 추가', async ({ page }) => {
    await page.goto(pageUrls.sourceServices);
    await waitForPageLoad(page);

    // Source Service 선택
    const tableRow = page.locator('tbody tr').first();
    if (await tableRow.isVisible({ timeout: timeouts.medium })) {
      await tableRow.click();
      await page.waitForTimeout(timeouts.short);
    }

    await captureTestStep(page, 'source-connection-add', 'before', 'Connection 추가 전');

    // Connections 탭 클릭
    const connectionsTab = page.locator('button:has-text("Connections"), [role="tab"]:has-text("Connections")').first();
    if (await connectionsTab.isVisible()) {
      await connectionsTab.click();
      await page.waitForTimeout(timeouts.short);
    }

    // Add Connection 버튼 클릭
    const addConnButton = page.locator('button:has-text("Add")').first();
    if (await addConnButton.isVisible()) {
      await addConnButton.click();
      await page.waitForTimeout(timeouts.short);
    }

    // Connection Form 입력
    // Connection Name
    const connNameInput = page.locator('input[placeholder*="name"], input[placeholder*="Name"]').first();
    if (await connNameInput.isVisible()) {
      await connNameInput.fill(testConnectionName);
    }

    // IP Address
    const ipInput = page.locator('input[placeholder*="IP"], input[placeholder*="ip"], input[placeholder*="xxx.xxx"]').first();
    if (await ipInput.isVisible()) {
      await ipInput.fill(testEC2.ip);
    }

    // Port
    const portInput = page.locator('input[placeholder*="port"], input[placeholder*="Port"], input[type="number"]').first();
    if (await portInput.isVisible()) {
      await portInput.fill(testEC2.port);
    }

    // User
    const userInput = page.locator('input[placeholder*="User"], input[placeholder*="user"], input[placeholder*="ID"]').first();
    if (await userInput.isVisible()) {
      await userInput.fill(testEC2.user);
    }

    // Private Key
    const keyInput = page.locator('textarea[placeholder*="Key"], textarea[placeholder*="key"], textarea').first();
    if (await keyInput.isVisible()) {
      await keyInput.fill(testEC2.privateKey);
    }

    await captureTestStep(page, 'source-connection-add', 'input', 'Connection 정보 입력');

    // Confirm 버튼 클릭
    const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Save"), button:has-text("Add")').last();
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
      await page.waitForTimeout(timeouts.medium);
    }

    await captureTestStep(page, 'source-connection-add', 'result', 'Connection 추가 완료');
  });

  test('P2-05: Infra Collect 실행', async ({ page }) => {
    test.setTimeout(120000); // 2분 타임아웃

    await page.goto(pageUrls.sourceServices);
    await waitForPageLoad(page);

    // Source Service 선택
    const tableRow = page.locator('tbody tr').first();
    if (await tableRow.isVisible({ timeout: timeouts.medium })) {
      await tableRow.click();
      await page.waitForTimeout(timeouts.short);
    }

    // Connections 탭 클릭
    const connectionsTab = page.locator('button:has-text("Connections"), [role="tab"]:has-text("Connections")').first();
    if (await connectionsTab.isVisible()) {
      await connectionsTab.click();
      await page.waitForTimeout(timeouts.short);
    }

    // Connection 선택
    const connectionRow = page.locator('.connection-list tr, tbody tr').first();
    if (await connectionRow.isVisible()) {
      await connectionRow.click();
      await page.waitForTimeout(timeouts.short);
    }

    await captureTestStep(page, 'infra-collect', 'before', 'Collect 전');

    // Infra Collect 탭 클릭
    const infraTab = page.locator('button:has-text("Infra"), [role="tab"]:has-text("Infra")').first();
    if (await infraTab.isVisible()) {
      await infraTab.click();
      await page.waitForTimeout(timeouts.short);
    }

    // Collect 버튼 클릭
    const collectButton = page.locator('button:has-text("Collect")').first();
    if (await collectButton.isVisible()) {
      await collectButton.click();

      await captureTestStep(page, 'infra-collect', 'input', 'Collect 진행 중');

      // 수집 완료 대기 (최대 90초)
      await page.waitForTimeout(timeouts.long);
    }

    await captureTestStep(page, 'infra-collect', 'result', 'Collect 완료');
  });

  test('P2-06: Software Collect 실행', async ({ page }) => {
    test.setTimeout(120000);

    await page.goto(pageUrls.sourceServices);
    await waitForPageLoad(page);

    // Source Service 선택
    const tableRow = page.locator('tbody tr').first();
    if (await tableRow.isVisible({ timeout: timeouts.medium })) {
      await tableRow.click();
      await page.waitForTimeout(timeouts.short);
    }

    // Connections 탭 클릭
    const connectionsTab = page.locator('button:has-text("Connections"), [role="tab"]:has-text("Connections")').first();
    if (await connectionsTab.isVisible()) {
      await connectionsTab.click();
      await page.waitForTimeout(timeouts.short);
    }

    // Connection 선택
    const connectionRow = page.locator('.connection-list tr, tbody tr').first();
    if (await connectionRow.isVisible()) {
      await connectionRow.click();
      await page.waitForTimeout(timeouts.short);
    }

    await captureTestStep(page, 'software-collect', 'before', 'Software Collect 전');

    // Software Collect 탭 클릭
    const softwareTab = page.locator('button:has-text("Software"), [role="tab"]:has-text("Software")').first();
    if (await softwareTab.isVisible()) {
      await softwareTab.click();
      await page.waitForTimeout(timeouts.short);
    }

    // Collect 버튼 클릭
    const collectButton = page.locator('button:has-text("Collect")').first();
    if (await collectButton.isVisible()) {
      await collectButton.click();
      await page.waitForTimeout(timeouts.long);
    }

    await captureTestStep(page, 'software-collect', 'result', 'Software Collect 완료');
  });
});
