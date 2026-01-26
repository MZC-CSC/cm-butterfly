import { Page, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 스크린샷 저장 디렉토리
 */
const SCREENSHOT_DIR = 'test-results/screenshots';

/**
 * 스크린샷 디렉토리 확인 및 생성
 */
function ensureScreenshotDir(): void {
  const dir = path.resolve(SCREENSHOT_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * 테스트 단계별 스크린샷 캡처
 *
 * @param page - Playwright Page 객체
 * @param testName - 테스트 이름 (파일명에 사용)
 * @param step - 단계 (문자열, 예: 'before', '01-source-list', 'result' 등)
 * @param description - 스크린샷 설명 (선택)
 */
export async function captureTestStep(
  page: Page,
  testName: string,
  step: string,
  description?: string
): Promise<string> {
  ensureScreenshotDir();

  // 기존 호환성 유지: 'before', 'input', 'result'는 번호로 변환
  const legacyStepNumber: Record<string, string> = { before: '01', input: '02', result: '03' };
  let filename: string;

  if (legacyStepNumber[step]) {
    filename = `${testName}-${legacyStepNumber[step]}-${step}.png`;
  } else {
    // 커스텀 스텝 이름 사용
    filename = `${testName}-${step}.png`;
  }

  const filepath = path.join(SCREENSHOT_DIR, filename);

  await page.screenshot({
    path: filepath,
    fullPage: true,
  });

  console.log(`📸 Screenshot captured: ${filename}${description ? ` - ${description}` : ''}`);

  return filepath;
}

/**
 * 요소가 나타날 때까지 대기 후 스크린샷
 *
 * @param page - Playwright Page 객체
 * @param selector - 대기할 요소 선택자
 * @param testName - 테스트 이름
 * @param step - 단계
 */
export async function waitAndCapture(
  page: Page,
  selector: string,
  testName: string,
  step: string
): Promise<string> {
  await page.waitForSelector(selector, { state: 'visible', timeout: 10000 });
  return captureTestStep(page, testName, step);
}

/**
 * 페이지 로드 완료 대기
 *
 * @param page - Playwright Page 객체
 */
export async function waitForPageLoad(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
}

/**
 * 로그인 수행
 *
 * @param page - Playwright Page 객체
 * @param username - 사용자명
 * @param password - 비밀번호
 */
export async function performLogin(
  page: Page,
  username: string,
  password: string
): Promise<void> {
  // 로그인 페이지로 이동
  await page.goto('/auth/login');
  await waitForPageLoad(page);

  // 사용자명 입력
  const userIdInput = page.locator('input[placeholder="id"]');
  await userIdInput.waitFor({ state: 'visible' });
  await userIdInput.fill(username);

  // 비밀번호 입력
  const passwordInput = page.locator('input[type="password"]');
  await passwordInput.waitFor({ state: 'visible' });
  await passwordInput.fill(password);

  // 로그인 버튼 클릭
  const loginButton = page.locator('button[type="submit"]');
  await loginButton.click();

  // 페이지 이동 대기
  await page.waitForURL(/\/main/, { timeout: 15000 });
}

/**
 * 알림/토스트 메시지 확인
 *
 * @param page - Playwright Page 객체
 * @param expectedText - 예상 메시지 텍스트
 */
export async function checkNotification(
  page: Page,
  expectedText: string
): Promise<void> {
  const notification = page.locator('.notification, .toast, [role="alert"]');
  await expect(notification).toContainText(expectedText);
}

/**
 * 테이블에서 특정 행 찾기
 *
 * @param page - Playwright Page 객체
 * @param tableSelector - 테이블 선택자
 * @param searchText - 검색할 텍스트
 */
export async function findTableRow(
  page: Page,
  tableSelector: string,
  searchText: string
) {
  const table = page.locator(tableSelector);
  const row = table.locator('tr', { hasText: searchText });
  return row;
}

/**
 * 모달 닫기
 *
 * @param page - Playwright Page 객체
 */
export async function closeModal(page: Page): Promise<void> {
  const closeButton = page.locator('[aria-label="Close"], .modal-close, .close-button');
  if (await closeButton.isVisible()) {
    await closeButton.click();
    await page.waitForTimeout(500);
  }
}

/**
 * 랜덤 문자열 생성 (테스트 데이터용)
 *
 * @param prefix - 접두사
 * @param length - 길이
 */
export function generateTestId(prefix: string = 'test', length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${result}`;
}

/**
 * API 응답 대기
 *
 * @param page - Playwright Page 객체
 * @param urlPattern - URL 패턴
 */
export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp
): Promise<void> {
  await page.waitForResponse(
    response => {
      const url = response.url();
      if (typeof urlPattern === 'string') {
        return url.includes(urlPattern);
      }
      return urlPattern.test(url);
    },
    { timeout: 30000 }
  );
}
