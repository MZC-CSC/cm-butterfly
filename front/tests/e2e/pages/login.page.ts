import { Page, expect, Locator } from '@playwright/test';
import { humanClick, humanFill } from '../support/humanize';

/**
 * LoginPage — the layer where "where/how" is explicitly defined (Page Object).
 *
 * ★ The scenario's (.feature) "logs in" captures only the *intent*,
 *   while the actual screen location (URL) and elements (selectors) are gathered here in one place.
 *   → When the screen changes, only this file needs fixing, and the Korean scenarios stay as-is.
 */
export class LoginPage {
  /** ★ screen location (URL) — states "where the login screen is" */
  static readonly path = '/auth/login';

  constructor(private readonly page: Page) {}

  /**
   * Centralized selectors (on source changes, only this file is edited).
   * Prefer data-testid for stability, falling back to placeholder/role where it isn't assigned yet.
   * → The fallback will be removed once data-testid is assigned in the front (BAR-880).
   */
  private get idInput(): Locator {
    return this.page
      .locator(
        'input[data-testid="login-id"], textarea[data-testid="login-id"]',
      )
      .or(this.page.getByPlaceholder('id'));
  }
  private get passwordInput(): Locator {
    return this.page
      .locator(
        'input[data-testid="login-password"], textarea[data-testid="login-password"]',
      )
      .or(this.page.getByPlaceholder(/password/i));
  }
  private get submitButton(): Locator {
    return this.page.getByTestId('login-submit');
  }

  /** navigate to the login screen — "where" is decided here */
  async goto(): Promise<void> {
    await this.page.goto(LoginPage.path);
    await expect(this.idInput).toBeVisible();
  }

  /** enter credentials and log in. On success, navigate to /main */
  async login(id: string, password: string): Promise<void> {
    await humanFill(this.idInput, id);
    await humanFill(this.passwordInput, password);
    await humanClick(this.submitButton);
  }

  async expectLoggedIn(): Promise<void> {
    await this.page.waitForURL(/\/main/, { timeout: 15_000 });
  }

  async expectLoginFailed(): Promise<void> {
    // stays on the login screen (does not navigate to main)
    await expect(this.page).toHaveURL(/\/auth\/login/);
  }
}
