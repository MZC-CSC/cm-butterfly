import { Page, expect, Locator } from '@playwright/test';

/**
 * LoginPage — "어디서/어떻게"가 명시적으로 정의되는 계층 (Page Object).
 *
 * ★ 시나리오(.feature)의 "로그인한다"는 *의도*만 담고,
 *   실제 화면 위치(URL)와 요소(셀렉터)는 여기 한 곳에 모읍니다.
 *   → 화면이 바뀌면 이 파일만 고치면 되고, 한국어 시나리오는 그대로 유지됩니다.
 */
export class LoginPage {
  /** ★ 화면 위치(URL) — "로그인 화면이 어디인가"를 명시 */
  static readonly path = '/auth/login';

  constructor(private readonly page: Page) {}

  /**
   * 셀렉터 중앙화 (소스 변경 시 이 파일만 수정).
   * 안정화를 위해 data-testid를 우선 사용하고, 아직 부여 전이면 placeholder/role로 fallback.
   * → 프론트에 data-testid 부여(BAR-880) 후 fallback 제거 예정.
   */
  private get idInput(): Locator {
    return this.page
      .locator('input[data-testid="login-id"], textarea[data-testid="login-id"]')
      .or(this.page.getByPlaceholder('id'));
  }
  private get passwordInput(): Locator {
    return this.page
      .locator('input[data-testid="login-password"], textarea[data-testid="login-password"]')
      .or(this.page.getByPlaceholder(/password/i));
  }
  private get submitButton(): Locator {
    return this.page
      .getByTestId('login-submit');
  }

  /** 로그인 화면으로 이동 — 여기서 "어디"가 결정됨 */
  async goto(): Promise<void> {
    await this.page.goto(LoginPage.path);
    await expect(this.idInput).toBeVisible();
  }

  /** 자격증명 입력 후 로그인. 성공 시 /main 으로 이동 */
  async login(id: string, password: string): Promise<void> {
    await this.idInput.fill(id);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async expectLoggedIn(): Promise<void> {
    await this.page.waitForURL(/\/main/, { timeout: 15_000 });
  }

  async expectLoginFailed(): Promise<void> {
    // 로그인 화면에 머무름(메인으로 이동하지 않음)
    await expect(this.page).toHaveURL(/\/auth\/login/);
  }
}
