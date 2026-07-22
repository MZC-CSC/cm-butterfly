import { Page, expect, Locator } from '@playwright/test';

/**
 * CloudResourcesPage — the "where/how" layer of the cloud resources domain (CSP credentials).
 *
 * It covers a single screen:
 *  - Cloud Credentials list  /main/cloud-resources/cloud-credentials  (cb-spider List-Credential)
 *
 * ★ Registration and removal are not covered — the registration modal does not work yet (WIP). Only the list view is verified.
 *
 * ★ VPC is not part of this domain — cm-butterfly has no VPC-specific screen. The only Cloud Resources
 *   child routes registered in the router are cloud-credentials and apis, and going to /cloud-resources/vpc
 *   actually returns a 404. VPC is just information included in the recommendation result when a target model
 *   is recommended from a source model; it is not something registered or deleted on its own. So the VPC Page
 *   Object, steps, and scenarios were all removed.
 */
export class CloudResourcesPage {
  /** ★ Screen location (URL) */
  static readonly credentialsPath = '/main/cloud-resources/cloud-credentials';

  constructor(private readonly page: Page) {}

  /** Credential list container (the "Cloud Credentials" header + the list table) */
  private get credentialListRoot(): Locator {
    return this.page.getByTestId('credential-list');
  }

  /** Navigate to the credentials screen */
  async gotoCredentials(): Promise<void> {
    await this.page.goto(CloudResourcesPage.credentialsPath);
    await expect(this.credentialListRoot).toBeVisible({ timeout: 15_000 });
  }

  /**
   * Verify that the list screen loaded correctly.
   * Zero registered credentials is still valid — if the list container appears, it passes (empty state != error).
   */
  async expectCredentialListVisible(): Promise<void> {
    await expect(this.credentialListRoot).toBeVisible({ timeout: 15_000 });
  }
}
