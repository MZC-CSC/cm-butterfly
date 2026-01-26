import { test, expect } from '@playwright/test';
import { captureTestStep, waitForPageLoad, performLogin } from './utils/test-helpers';
import { testUser, pageUrls, selectors, timeouts } from './fixtures/test-data';

test.describe('페이지 네비게이션 테스트', () => {
  test.beforeEach(async ({ page }) => {
    // 로그인 수행
    await performLogin(page, testUser.username, testUser.password);
    await waitForPageLoad(page);
  });

  test('메인 페이지 레이아웃 확인', async ({ page }) => {
    // 1. 테스트 전 화면 캡처
    await captureTestStep(page, 'main-layout', 'before', '메인 페이지 초기 화면');

    // 메인 콘텐츠 영역 확인
    const url = page.url();
    expect(url).toContain('/main');

    // 2. 결과 화면 캡처
    await captureTestStep(page, 'main-layout', 'result', '메인 페이지 레이아웃 확인');
  });

  test('Source Services 페이지 이동', async ({ page }) => {
    // 1. 테스트 전 화면 캡처
    await captureTestStep(page, 'nav-source-services', 'before', '네비게이션 전 화면');

    // Source Services 페이지로 이동
    await page.goto(pageUrls.sourceServices);
    await waitForPageLoad(page);

    // 2. 입력 (페이지 이동) 화면 캡처
    await captureTestStep(page, 'nav-source-services', 'input', 'Source Services 페이지 이동 중');

    // URL 확인
    expect(page.url()).toContain('source-services');

    // 3. 결과 화면 캡처
    await captureTestStep(page, 'nav-source-services', 'result', 'Source Services 페이지 도착');
  });

  test('Workflows 페이지 이동', async ({ page }) => {
    // 1. 테스트 전 화면 캡처
    await captureTestStep(page, 'nav-workflows', 'before', '네비게이션 전 화면');

    // Workflows 페이지로 이동
    await page.goto(pageUrls.workflows);
    await waitForPageLoad(page);

    // 2. 입력 화면 캡처
    await captureTestStep(page, 'nav-workflows', 'input', 'Workflows 페이지 로딩');

    // URL 확인
    expect(page.url()).toContain('workflows');

    // 3. 결과 화면 캡처
    await captureTestStep(page, 'nav-workflows', 'result', 'Workflows 페이지 표시');
  });

  test('Workflow Templates 페이지 이동', async ({ page }) => {
    // 1. 테스트 전 화면 캡처
    await captureTestStep(page, 'nav-workflow-templates', 'before', '네비게이션 전 화면');

    // Workflow Templates 페이지로 이동
    await page.goto(pageUrls.workflowTemplates);
    await waitForPageLoad(page);

    // 2. 입력 화면 캡처
    await captureTestStep(page, 'nav-workflow-templates', 'input', 'Workflow Templates 페이지 로딩');

    // URL 확인
    expect(page.url()).toContain('workflow-templates');

    // 3. 결과 화면 캡처
    await captureTestStep(page, 'nav-workflow-templates', 'result', 'Workflow Templates 페이지 표시');
  });

  test('Task Components 페이지 이동', async ({ page }) => {
    // 1. 테스트 전 화면 캡처
    await captureTestStep(page, 'nav-task-components', 'before', '네비게이션 전 화면');

    // Task Components 페이지로 이동
    await page.goto(pageUrls.taskComponents);
    await waitForPageLoad(page);

    // 2. 입력 화면 캡처
    await captureTestStep(page, 'nav-task-components', 'input', 'Task Components 페이지 로딩');

    // URL 확인
    expect(page.url()).toContain('task-components');

    // 3. 결과 화면 캡처
    await captureTestStep(page, 'nav-task-components', 'result', 'Task Components 페이지 표시');
  });

  test('Workloads 페이지 이동', async ({ page }) => {
    // 1. 테스트 전 화면 캡처
    await captureTestStep(page, 'nav-workloads', 'before', '네비게이션 전 화면');

    // Workloads 페이지로 이동
    await page.goto(pageUrls.workloads);
    await waitForPageLoad(page);

    // 2. 입력 화면 캡처
    await captureTestStep(page, 'nav-workloads', 'input', 'Workloads 페이지 로딩');

    // URL 확인
    expect(page.url()).toContain('workloads');

    // 3. 결과 화면 캡처
    await captureTestStep(page, 'nav-workloads', 'result', 'Workloads 페이지 표시');
  });

  test('Source Models 페이지 이동', async ({ page }) => {
    // 1. 테스트 전 화면 캡처
    await captureTestStep(page, 'nav-source-models', 'before', '네비게이션 전 화면');

    // Source Models 페이지로 이동
    await page.goto(pageUrls.sourceModels);
    await waitForPageLoad(page);

    // 2. 입력 화면 캡처
    await captureTestStep(page, 'nav-source-models', 'input', 'Source Models 페이지 로딩');

    // URL 확인
    expect(page.url()).toContain('source-models');

    // 3. 결과 화면 캡처
    await captureTestStep(page, 'nav-source-models', 'result', 'Source Models 페이지 표시');
  });

  test('Target Models 페이지 이동', async ({ page }) => {
    // 1. 테스트 전 화면 캡처
    await captureTestStep(page, 'nav-target-models', 'before', '네비게이션 전 화면');

    // Target Models 페이지로 이동
    await page.goto(pageUrls.targetModels);
    await waitForPageLoad(page);

    // 2. 입력 화면 캡처
    await captureTestStep(page, 'nav-target-models', 'input', 'Target Models 페이지 로딩');

    // URL 확인
    expect(page.url()).toContain('target-models');

    // 3. 결과 화면 캡처
    await captureTestStep(page, 'nav-target-models', 'result', 'Target Models 페이지 표시');
  });

  test('APIs 페이지 이동', async ({ page }) => {
    // 1. 테스트 전 화면 캡처
    await captureTestStep(page, 'nav-apis', 'before', '네비게이션 전 화면');

    // APIs 페이지로 이동
    await page.goto(pageUrls.apis);
    await waitForPageLoad(page);

    // 2. 입력 화면 캡처
    await captureTestStep(page, 'nav-apis', 'input', 'APIs 페이지 로딩');

    // URL 확인
    expect(page.url()).toContain('apis');

    // 3. 결과 화면 캡처
    await captureTestStep(page, 'nav-apis', 'result', 'APIs 페이지 표시');
  });
});
