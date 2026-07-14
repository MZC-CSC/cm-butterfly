import { Page, expect, Locator } from '@playwright/test';

/**
 * CloudResourcesPage — 클라우드 리소스 도메인(CSP 자격증명)의 "어디서/어떻게" 계층.
 *
 * 다루는 화면은 하나다:
 *  - Cloud Credentials 목록  /main/cloud-resources/cloud-credentials  (cb-spider List-Credential)
 *
 * ★ 등록·해제는 다루지 않는다 — 등록 모달이 아직 동작하지 않는다(WIP). 목록 조회만 검증한다.
 *
 * ★ VPC는 이 도메인에 없다 — cm-butterfly에 VPC 전용 화면이 없다. 라우터에 등록된 Cloud Resources
 *   자식 경로는 cloud-credentials·apis 둘뿐이고 /cloud-resources/vpc 로 가면 실제로 404가 뜬다.
 *   VPC는 소스 모델로 타깃 모델을 추천받을 때 그 추천 결과 안에 포함되는 정보일 뿐, 따로 등록·삭제하는
 *   작업이 아니다. 그래서 VPC Page Object·스텝·시나리오를 모두 걷어냈다.
 */
export class CloudResourcesPage {
  /** ★ 화면 위치(URL) */
  static readonly credentialsPath = '/main/cloud-resources/cloud-credentials';

  constructor(private readonly page: Page) {}

  /** 자격증명 목록 컨테이너(헤더 "Cloud Credentials" + 목록 테이블) */
  private get credentialListRoot(): Locator {
    return this.page.getByTestId('credential-list');
  }

  /** 자격증명 화면으로 이동 */
  async gotoCredentials(): Promise<void> {
    await this.page.goto(CloudResourcesPage.credentialsPath);
    await expect(this.credentialListRoot).toBeVisible({ timeout: 15_000 });
  }

  /**
   * 목록 화면이 정상으로 떴는지 확인.
   * 등록된 자격증명이 0건이어도 정상이다 — 목록 컨테이너가 뜨면 통과다(빈 상태 ≠ 오류).
   */
  async expectCredentialListVisible(): Promise<void> {
    await expect(this.credentialListRoot).toBeVisible({ timeout: 15_000 });
  }
}
