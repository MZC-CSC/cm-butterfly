import { test, expect } from '@playwright/test';
import { captureTestStep, waitForPageLoad } from '../utils/test-helpers';
import { testUser, pageUrls, selectors, timeouts } from '../fixtures/test-data';

test.describe('로그인 기능 테스트', () => {
  test.beforeEach(async ({ page }) => {
    // 로그인 페이지로 이동
    await page.goto(pageUrls.login);
    await waitForPageLoad(page);
  });

  test('로그인 페이지 접속 및 UI 확인', async ({ page }) => {
    // 1. 테스트 전 화면 캡처
    await captureTestStep(page, 'login-page-access', 'before', '로그인 페이지 초기 화면');

    // 로고 확인
    const logo = page.locator(selectors.layout.logo);
    await expect(logo).toBeVisible();

    // 로그인 폼 확인
    const loginForm = page.locator(selectors.login.loginForm);
    await expect(loginForm).toBeVisible();

    // 입력 필드 확인
    const userIdInput = page.locator(selectors.login.userIdInput);
    const passwordInput = page.locator(selectors.login.passwordInput);
    const submitButton = page.locator(selectors.login.submitButton);

    await expect(userIdInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();

    // 2. 결과 화면 캡처
    await captureTestStep(page, 'login-page-access', 'result', '로그인 페이지 UI 요소 확인 완료');
  });

  test('정상 로그인 테스트', async ({ page }) => {
    // 1. 테스트 전 화면 캡처
    await captureTestStep(page, 'login-success', 'before', '로그인 전 화면');

    // 사용자명 입력
    const userIdInput = page.locator(selectors.login.userIdInput);
    await userIdInput.fill(testUser.username);

    // 비밀번호 입력
    const passwordInput = page.locator(selectors.login.passwordInput);
    await passwordInput.fill(testUser.password);

    // 2. 입력값 입력 후 화면 캡처
    await captureTestStep(page, 'login-success', 'input', `사용자명: ${testUser.username} 입력 완료`);

    // 로그인 버튼 클릭
    const submitButton = page.locator(selectors.login.submitButton);
    await submitButton.click();

    // 페이지 이동 대기 (메인 페이지로)
    await page.waitForURL(/\/main/, { timeout: timeouts.pageLoad });

    // 로그인 성공 확인 - 메인 페이지 URL 확인
    expect(page.url()).toContain('/main');

    // 3. 결과 화면 캡처
    await captureTestStep(page, 'login-success', 'result', '로그인 성공 - 메인 페이지 이동');
  });

  test('빈 사용자명으로 로그인 시도', async ({ page }) => {
    // 1. 테스트 전 화면 캡처
    await captureTestStep(page, 'login-empty-username', 'before', '빈 사용자명 테스트 시작');

    // 비밀번호만 입력
    const passwordInput = page.locator(selectors.login.passwordInput);
    await passwordInput.fill(testUser.password);

    // 2. 입력값 입력 후 화면 캡처
    await captureTestStep(page, 'login-empty-username', 'input', '비밀번호만 입력');

    // 로그인 버튼 클릭
    const submitButton = page.locator(selectors.login.submitButton);
    await submitButton.click();

    // 잠시 대기
    await page.waitForTimeout(timeouts.short);

    // 여전히 로그인 페이지에 있는지 확인
    expect(page.url()).toContain('/auth/login');

    // 3. 결과 화면 캡처
    await captureTestStep(page, 'login-empty-username', 'result', '로그인 페이지에 머무름');
  });

  test('빈 비밀번호로 로그인 시도', async ({ page }) => {
    // 1. 테스트 전 화면 캡처
    await captureTestStep(page, 'login-empty-password', 'before', '빈 비밀번호 테스트 시작');

    // 사용자명만 입력
    const userIdInput = page.locator(selectors.login.userIdInput);
    await userIdInput.fill(testUser.username);

    // 2. 입력값 입력 후 화면 캡처
    await captureTestStep(page, 'login-empty-password', 'input', '사용자명만 입력');

    // 로그인 버튼 클릭
    const submitButton = page.locator(selectors.login.submitButton);
    await submitButton.click();

    // 잠시 대기
    await page.waitForTimeout(timeouts.short);

    // 여전히 로그인 페이지에 있는지 확인
    expect(page.url()).toContain('/auth/login');

    // 3. 결과 화면 캡처
    await captureTestStep(page, 'login-empty-password', 'result', '로그인 페이지에 머무름');
  });

  test('잘못된 비밀번호로 로그인 시도', async ({ page }) => {
    // 1. 테스트 전 화면 캡처
    await captureTestStep(page, 'login-wrong-password', 'before', '잘못된 비밀번호 테스트 시작');

    // 사용자명 입력
    const userIdInput = page.locator(selectors.login.userIdInput);
    await userIdInput.fill(testUser.username);

    // 잘못된 비밀번호 입력
    const passwordInput = page.locator(selectors.login.passwordInput);
    await passwordInput.fill('wrongPassword123!');

    // 2. 입력값 입력 후 화면 캡처
    await captureTestStep(page, 'login-wrong-password', 'input', '잘못된 비밀번호 입력');

    // 로그인 버튼 클릭
    const submitButton = page.locator(selectors.login.submitButton);
    await submitButton.click();

    // API 응답 대기
    await page.waitForTimeout(timeouts.medium);

    // 에러 메시지 또는 로그인 페이지 확인
    const errorMsg = page.locator(selectors.login.errorMessage);
    const isErrorVisible = await errorMsg.isVisible().catch(() => false);

    if (isErrorVisible) {
      // 에러 메시지가 표시되는 경우
      await expect(errorMsg).toBeVisible();
    } else {
      // 로그인 페이지에 머무르는 경우
      expect(page.url()).toContain('/auth/login');
    }

    // 3. 결과 화면 캡처
    await captureTestStep(page, 'login-wrong-password', 'result', '로그인 실패 화면');
  });

  test('Enter 키로 로그인 시도', async ({ page }) => {
    // 1. 테스트 전 화면 캡처
    await captureTestStep(page, 'login-enter-key', 'before', 'Enter 키 로그인 테스트 시작');

    // 사용자명 입력
    const userIdInput = page.locator(selectors.login.userIdInput);
    await userIdInput.fill(testUser.username);

    // 비밀번호 입력
    const passwordInput = page.locator(selectors.login.passwordInput);
    await passwordInput.fill(testUser.password);

    // 2. 입력값 입력 후 화면 캡처
    await captureTestStep(page, 'login-enter-key', 'input', '입력값 입력 완료');

    // Enter 키로 로그인
    await passwordInput.press('Enter');

    // 페이지 이동 대기
    await page.waitForURL(/\/main/, { timeout: timeouts.pageLoad });

    // 로그인 성공 확인
    expect(page.url()).toContain('/main');

    // 3. 결과 화면 캡처
    await captureTestStep(page, 'login-enter-key', 'result', 'Enter 키 로그인 성공');
  });
});
