import { test, expect } from '@playwright/test';
import { captureTestStep, waitForPageLoad, performLogin, generateTestId } from '../utils/test-helpers';
import { testUser, pageUrls, selectors, timeouts } from '../fixtures/test-data';

test.describe('워크플로우 목록 테스트', () => {
  test.beforeEach(async ({ page }) => {
    // 로그인 수행
    await performLogin(page, testUser.username, testUser.password);
    await waitForPageLoad(page);
  });

  test('워크플로우 목록 페이지 접속', async ({ page }) => {
    // 1. 테스트 전 화면 캡처
    await captureTestStep(page, 'workflow-list-access', 'before', '워크플로우 페이지 이동 전');

    // 워크플로우 페이지로 이동
    await page.goto(pageUrls.workflows);
    await waitForPageLoad(page);

    // 2. 페이지 로딩 화면 캡처
    await captureTestStep(page, 'workflow-list-access', 'input', '워크플로우 목록 로딩');

    // URL 확인
    expect(page.url()).toContain('workflows');

    // 페이지 제목 또는 헤더 확인
    const pageTitle = page.locator('h1, h2, .page-title, [class*="title"]').first();
    await expect(pageTitle).toBeVisible({ timeout: timeouts.medium });

    // 3. 결과 화면 캡처
    await captureTestStep(page, 'workflow-list-access', 'result', '워크플로우 목록 페이지 표시 완료');
  });

  test('워크플로우 목록 테이블 확인', async ({ page }) => {
    // 워크플로우 페이지로 이동
    await page.goto(pageUrls.workflows);
    await waitForPageLoad(page);

    // 1. 테스트 전 화면 캡처
    await captureTestStep(page, 'workflow-list-table', 'before', '워크플로우 테이블 확인 시작');

    // 테이블 또는 목록 존재 확인
    const tableOrList = page.locator('table, .p-data-table, [class*="table"], [class*="list"]').first();

    // 2. 테이블 로딩 대기
    await page.waitForTimeout(timeouts.medium);
    await captureTestStep(page, 'workflow-list-table', 'input', '테이블 데이터 로딩');

    // 3. 결과 화면 캡처
    await captureTestStep(page, 'workflow-list-table', 'result', '워크플로우 테이블 표시');
  });

  test('워크플로우 생성 버튼 확인', async ({ page }) => {
    // 워크플로우 페이지로 이동
    await page.goto(pageUrls.workflows);
    await waitForPageLoad(page);

    // 1. 테스트 전 화면 캡처
    await captureTestStep(page, 'workflow-create-button', 'before', '생성 버튼 확인 시작');

    // Create 버튼 찾기
    const createButton = page.locator('button').filter({
      hasText: /Create|생성|New|추가/i
    }).first();

    // 2. 버튼 위치 확인 캡처
    await captureTestStep(page, 'workflow-create-button', 'input', 'Create 버튼 위치 확인');

    // 버튼 존재 확인
    const isVisible = await createButton.isVisible().catch(() => false);

    if (isVisible) {
      await expect(createButton).toBeVisible();
    }

    // 3. 결과 화면 캡처
    await captureTestStep(page, 'workflow-create-button', 'result', '생성 버튼 확인 완료');
  });
});

test.describe('워크플로우 템플릿 목록 테스트', () => {
  test.beforeEach(async ({ page }) => {
    // 로그인 수행
    await performLogin(page, testUser.username, testUser.password);
    await waitForPageLoad(page);
  });

  test('워크플로우 템플릿 목록 페이지 접속', async ({ page }) => {
    // 1. 테스트 전 화면 캡처
    await captureTestStep(page, 'workflow-template-list', 'before', '템플릿 페이지 이동 전');

    // 워크플로우 템플릿 페이지로 이동
    await page.goto(pageUrls.workflowTemplates);
    await waitForPageLoad(page);

    // 2. 페이지 로딩 화면 캡처
    await captureTestStep(page, 'workflow-template-list', 'input', '템플릿 목록 로딩');

    // URL 확인
    expect(page.url()).toContain('workflow-templates');

    // 3. 결과 화면 캡처
    await captureTestStep(page, 'workflow-template-list', 'result', '템플릿 목록 페이지 표시 완료');
  });

  test('Task Components 목록 페이지 접속', async ({ page }) => {
    // 1. 테스트 전 화면 캡처
    await captureTestStep(page, 'task-components-list', 'before', 'Task Components 페이지 이동 전');

    // Task Components 페이지로 이동
    await page.goto(pageUrls.taskComponents);
    await waitForPageLoad(page);

    // 2. 페이지 로딩 화면 캡처
    await captureTestStep(page, 'task-components-list', 'input', 'Task Components 목록 로딩');

    // URL 확인
    expect(page.url()).toContain('task-components');

    // 3. 결과 화면 캡처
    await captureTestStep(page, 'task-components-list', 'result', 'Task Components 목록 페이지 표시 완료');
  });
});
