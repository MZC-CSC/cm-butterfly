import { Locator, Page, expect } from '@playwright/test';
import { humanClick, humanFill } from '../support/humanize';
import { SourceServicesPage } from './sourceServices.page';
import { RegionSelectControl } from './regionSelect.page';
import { ModelsPage } from './models.page';

/**
 * 오브젝트 스토리지(버킷) 마이그레이션.
 *
 *   Source Services ▸ (클라우드 소스) Detail ▸ Scan Buckets → 버킷을 커넥션으로 등록
 *   → Models ▸ Source Models ▸ Create Object Storage Source Model (버킷 선택 → 수집 → 저장)
 *   → View & Save as Planning Model (계획 모델) → View Recommended List → 목표 모델 저장
 *   → Models ▸ Target Models ▸ Migrate Buckets → Workload Operations ▸ Object Storages 에서 조회·삭제
 *
 * 모델은 cm-damselfly 에 인프라 모델과 같은 규칙(소스 → 계획 → 목표, 계보)으로 저장된다.
 *
 * 표는 미리내 표가 아니라 일반 표이고, 선택은 행의 `data-selected` 로 드러난다.
 * 판정은 화면이 드러내는 결과로 한다 — 이행 상태는 `data-status`, 계보는 행의
 * `data-source-model-id`. 미리내 버튼 비활성은 클래스뿐이라(DESIGN-MIRINAE §1.6)
 * 버튼 상태로 판정하지 않는다.
 */
export class ObjectStoragePage {
  constructor(private readonly page: Page) {}

  private input(testid: string): Locator {
    return this.page.locator(`input[data-testid="${testid}"]`).first();
  }

  private confirmButton(testid: string): Locator {
    return this.page.locator('button', { has: this.page.getByTestId(testid) });
  }

  // ── Workload Operations ▸ Object Storages ────────────────────────────────

  async open(): Promise<void> {
    await humanClick(
      this.page.getByText('Object Storages', { exact: true }).first(),
    );
    await expect(this.page.getByTestId('object-storages-header')).toBeVisible({
      timeout: 30_000,
    });
  }

  async expectMigratedList(): Promise<void> {
    await expect(this.page.getByTestId('os-migrated-table')).toBeVisible({
      timeout: 30_000,
    });
  }

  /** 이행된 버킷 화면에는 cm-beetle 직접 시험 단계가 섞여 있지 않다. */
  async expectNoDirectFlow(): Promise<void> {
    await expect(this.page.getByTestId('os-step-source')).toHaveCount(0);
    await expect(this.page.getByTestId('os-source-scan')).toHaveCount(0);
    await expect(
      this.page.getByTestId('object-storages-page'),
    ).not.toContainText('cm-beetle direct');
  }

  // ── System ▸ Develop (임시 시험 도구) ────────────────────────────────────

  async openDevelop(): Promise<void> {
    await humanClick(this.page.getByText('Develop', { exact: true }).first());
    await expect(this.page.getByTestId('develop-header')).toBeVisible({
      timeout: 30_000,
    });
  }

  /** Develop 의 오브젝트 스토리지 직접 시험 탭 — 소스 스캔·추천·생성 세 단계. */
  async expectDirectFlowTabs(): Promise<void> {
    const page = this.page.getByTestId('develop-page');
    await expect(page.getByRole('tab')).toHaveText([
      /Source Buckets/,
      /Target Recommendation/,
      /Migration/,
    ]);
    await expect(this.page.getByTestId('os-source-scan')).toBeVisible();
  }

  async migratedBucketIds(): Promise<string[]> {
    await humanClick(this.page.getByTestId('os-migrated-refresh'));
    await expect(this.page.getByTestId('os-migrated-table')).toBeVisible();
    return this.page
      .getByTestId('os-migrated-table')
      .locator('tbody tr[data-testid^="os-migrated-"]')
      .evaluateAll(rows =>
        rows.map(r =>
          (r.getAttribute('data-testid') ?? '').replace('os-migrated-', ''),
        ),
      );
  }

  async expectBucketEmpty(osId: string): Promise<void> {
    await humanClick(this.page.getByTestId(`os-migrated-objects-${osId}`));
    await expect(this.page.getByTestId('os-migrated-objects')).toContainText(
      'The bucket is empty',
      { timeout: 30_000 },
    );
  }

  async deleteBucket(osId: string): Promise<void> {
    await humanClick(this.page.getByTestId(`os-migrated-delete-${osId}`));
    await humanFill(this.input('os-migrated-delete-confirm-input'), osId);
    await humanClick(this.confirmButton('os-migrated-delete-confirm'));
    await expect(this.page.getByTestId(`os-migrated-${osId}`)).toHaveCount(0, {
      timeout: 120_000,
    });
  }

  // ── Source Services ▸ Detail ▸ Scan Buckets ──────────────────────────────

  /**
   * 그룹 상세의 Scan Buckets 로 연결 추가 창을 버킷 유형으로 열고, 지정한 버킷만 골라 등록한다.
   * 없으면 다른 버킷으로 대신하지 않는다. 버킷은 그룹에 저장된 크레덴셜로 읽는다.
   */
  async scanAndRegisterBucket(group: string, bucket: string): Promise<void> {
    const sources = new SourceServicesPage(this.page);
    await sources.gotoCloud();
    await sources.selectGroup(group);
    await humanClick(this.page.getByTestId('csp-bucket-scan-run'));
    await expect(
      this.page.getByTestId('csp-connection-modal-body'),
    ).toBeVisible({ timeout: 15_000 });
    const list = this.page.getByTestId('csp-connection-resource-list');
    await expect(list).toBeVisible({ timeout: 120_000 });
    const row = list.getByTestId(`csp-connection-resource-${bucket}`);
    await expect(row).toHaveCount(1, { timeout: 30_000 });
    await humanClick(this.page.getByTestId(`csp-connection-pick-${bucket}`));
    await expect(row).toHaveAttribute('data-selected', 'true');
    await humanClick(this.confirmButton('csp-connection-confirm'));
    await expect(this.page.getByTestId('csp-connection-modal-body')).toBeHidden(
      { timeout: 60_000 },
    );
  }

  async expectBucketConnection(bucket: string): Promise<void> {
    await humanClick(this.page.getByRole('tab', { name: /Connections/i }));
    await expect(
      this.page.getByTestId('source-connection-list-table'),
    ).toContainText(bucket, { timeout: 30_000 });
  }

  // ── Models ▸ Source Models / Target Models (오브젝트 스토리지 모델) ──────────
  //
  // 오브젝트 스토리지 모델은 cm-damselfly 에 인프라·SW 모델과 함께 저장되고 같은 목록에 나온다.
  // 목록 선택·계획 모델 저장·단계/부모 확인은 ModelsPage 를 그대로 쓴다.

  /**
   * Source Models 의 Create Object Storage Source Model 창에서 그룹과 버킷을 골라 수집하고 저장한다.
   * 버킷 설정은 손으로 넣지 않는다 — 소스 서비스가 계정에서 읽어 온 값이 들어간다.
   * 저장된 모델의 ID 를 돌려준다.
   */
  async createSourceModel(
    group: string,
    bucket: string,
    name: string,
  ): Promise<string> {
    const models = new ModelsPage(this.page);
    await models.gotoSourceModels();
    await humanClick(this.page.getByTestId('os-source-create-open'));
    await expect(this.page.getByTestId('os-source-create-body')).toBeVisible({
      timeout: 15_000,
    });
    const dropdown = this.page.getByTestId('os-source-create-group');
    await humanClick(dropdown);
    await humanClick(
      dropdown
        .locator('.p-context-menu-item', { hasText: `${group} (` })
        .first(),
    );
    const row = this.page.getByTestId(`os-source-create-bucket-${bucket}`);
    await expect(row).toBeVisible({ timeout: 30_000 });
    await humanClick(this.page.getByTestId(`os-source-create-pick-${bucket}`));
    await expect(row).toHaveAttribute('data-selected', 'true');
    await humanClick(this.page.getByTestId('os-source-create-collect'));
    await expect(row).toHaveAttribute('data-status', 'collected', {
      timeout: 120_000,
    });
    await humanFill(this.input('os-source-create-name'), name);
    await humanClick(this.confirmButton('os-source-create-save'));
    await expect(this.page.getByTestId('os-source-create-body')).toHaveCount(
      0,
      { timeout: 30_000 },
    );
    return this.selectedModelId(name);
  }

  /** 목록에서 그 모델을 골라 상세가 가리키는 모델 ID 를 읽는다. */
  async selectedModelId(name: string): Promise<string> {
    const models = new ModelsPage(this.page);
    await models.selectModel(name);
    const detail = this.page.getByTestId('source-model-detail');
    await expect(detail).toContainText(name, { timeout: 15_000 });
    return (await detail.getAttribute('data-model-id')) ?? '';
  }

  /**
   * 소스·계획 모델 상세 아래 버킷 표에 그 버킷이 *수집한 값*으로 들어 있다.
   * 수집하지 않은 값은 '-' 로 남으므로, 버저닝이 on/off 이고 크기가 채워졌는지로 판정한다.
   */
  async expectCollectedBucketInModel(
    name: string,
    bucket: string,
  ): Promise<void> {
    const models = new ModelsPage(this.page);
    await models.gotoSourceModels();
    await models.selectModel(name);
    const row = this.page
      .getByTestId('os-model-buckets')
      .getByTestId(`os-model-bucket-${bucket}`);
    await expect(row).toBeVisible({ timeout: 15_000 });
    const cells = await row.locator('td').allInnerTexts();
    expect(cells[1], '버저닝이 수집되지 않았다').toMatch(/^(on|off)$/);
    expect(cells[5], '크기가 수집되지 않았다').not.toBe('-');
  }

  /** 연결 목록에서 그 버킷 연결을 열고 Information 의 Collect 를 누른다. 수집한 설정이 그 자리에 보인다. */
  async collectFromConnection(bucket: string): Promise<void> {
    await this.expectBucketConnection(bucket);
    await humanClick(
      this.page
        .getByTestId('source-connection-list-table')
        .getByRole('row', { name: new RegExp(bucket) })
        .first(),
    );
    await expect(this.page.getByTestId('bucket-collect-name')).toHaveText(
      bucket,
      { timeout: 15_000 },
    );
    await humanClick(this.page.getByTestId('bucket-collect-run'));
    await expect(
      this.page.getByTestId('bucket-collect-status'),
    ).toHaveAttribute('data-status', 'success', { timeout: 120_000 });
  }

  async expectCollectedSettingsShown(): Promise<void> {
    await expect(this.page.getByTestId('bucket-collect-versioning')).toHaveText(
      /^\s*(on|off)\s*$/,
    );
    await expect(this.page.getByTestId('bucket-collect-size')).not.toHaveText(
      /^\s*-\s*$/,
    );
  }

  /** 수집이 끝난 버킷 연결에서 Save as Source Model 로 저장한다. 창은 그 버킷을 골라 수집한 채로 열린다. */
  async saveSourceModelFromConnection(
    bucket: string,
    name: string,
  ): Promise<void> {
    await humanClick(this.page.getByTestId('bucket-collect-save-model'));
    const row = this.page.getByTestId(`os-source-create-bucket-${bucket}`);
    await expect(row).toHaveAttribute('data-selected', 'true', {
      timeout: 30_000,
    });
    await expect(row).toHaveAttribute('data-status', 'collected', {
      timeout: 120_000,
    });
    await humanFill(this.input('os-source-create-name'), name);
    await humanClick(this.confirmButton('os-source-create-save'));
    await expect(this.page.getByTestId('bucket-collect-saved')).toContainText(
      name,
      { timeout: 30_000 },
    );
  }

  /** 계획 모델 상세의 View Recommended List 로 추천 창을 열고, 같은 CSP·리전으로 추천받아 목표 모델로 저장한다. */
  async recommendAndSaveTargetModel(
    planningModel: string,
    provider: string,
    region: string,
    targetModel: string,
  ): Promise<void> {
    const models = new ModelsPage(this.page);
    await models.gotoSourceModels();
    await models.selectModel(planningModel);
    await humanClick(this.page.getByTestId('source-detail-view-recommend'));
    await expect(this.page.getByTestId('os-recommend-body')).toBeVisible({
      timeout: 15_000,
    });
    const dropdown = this.page.getByTestId('os-recommend-provider');
    await humanClick(dropdown);
    await humanClick(
      dropdown
        .locator('.p-context-menu-item', {
          hasText: new RegExp(`^\\s*${provider}\\s*$`),
        })
        .first(),
    );
    await new RegionSelectControl(this.page, 'os-recommend-region').pick(
      region,
    );
    await humanClick(this.page.getByTestId('os-recommend-run'));
    await expect(this.page.getByTestId('os-recommend-table')).toBeVisible({
      timeout: 120_000,
    });
    await humanFill(this.input('os-recommend-model-name'), targetModel);
    await humanClick(this.confirmButton('os-recommend-save'));
    await expect(this.page.getByTestId('os-recommend-saved')).toContainText(
      'Saved',
      { timeout: 30_000 },
    );
    await humanClick(this.confirmButton('os-recommend-close'));
    await expect(this.page.getByTestId('os-recommend-body')).toHaveCount(0, {
      timeout: 15_000,
    });
  }

  /** 목표 모델 상세가 가리키는 계획 모델 ID (계보). */
  async targetModelPlanningId(targetModel: string): Promise<string> {
    const models = new ModelsPage(this.page);
    await models.gotoTargetModels();
    await models.selectModel(targetModel);
    const parent = this.page.getByTestId('target-detail-parent');
    await expect(parent).toBeVisible({ timeout: 15_000 });
    return (await parent.innerText()).trim();
  }

  private async openMigrate(targetModel: string): Promise<void> {
    const models = new ModelsPage(this.page);
    await models.gotoTargetModels();
    await models.selectModel(targetModel);
    await humanClick(this.page.getByTestId('target-migrate-buckets'));
    await expect(this.page.getByTestId('os-migrate-body')).toBeVisible({
      timeout: 15_000,
    });
  }

  /** 목표 모델에서 Migrate Buckets 로 버킷을 만들고 Success/Error 가 정해질 때까지 지켜본다. */
  async migrateFromTargetModel(
    targetModel: string,
    nameSeed: string,
  ): Promise<string> {
    await this.openMigrate(targetModel);
    await humanFill(this.input('os-migrate-name-seed'), nameSeed);
    await humanClick(this.confirmButton('os-migrate-start'));
    const status = this.page.getByTestId('os-migrate-status');
    await expect(status).toHaveAttribute('data-status', /Success|Error/, {
      timeout: 600_000,
    });
    const result = (await status.getAttribute('data-status')) ?? '';
    if (result === 'Success') {
      await humanClick(this.page.getByTestId('os-migrate-go-workloads'));
      await expect(this.page.getByTestId('object-storages-header')).toBeVisible(
        { timeout: 30_000 },
      );
    }
    return result;
  }

  /**
   * 버킷 이름 규칙에 맞지 않는 접두어는 cm-beetle 로 보내기 전에 막는다. 미리내 버튼
   * 비활성은 클래스뿐이라(§1.6) 눌러 보고 요청이 나가지 않는 것으로 판정한다.
   */
  async expectInvalidNameSeedBlocked(
    targetModel: string,
    nameSeed: string,
  ): Promise<void> {
    await this.openMigrate(targetModel);
    await humanFill(this.input('os-migrate-name-seed'), nameSeed);
    await expect(
      this.page.getByTestId('os-migrate-name-seed-error'),
    ).toContainText('lowercase letters');
    const calls: string[] = [];
    const listener = (r: { url(): string; method(): string }) => {
      if (r.method() === 'POST' && /MigrateObjectStorage/i.test(r.url()))
        calls.push(r.url());
    };
    this.page.on('request', listener);
    await this.confirmButton('os-migrate-start').click({ force: true });
    await this.page.waitForTimeout(2_000);
    this.page.off('request', listener);
    expect(calls).toEqual([]);
    await expect(
      this.page.getByTestId('os-migrate-status'),
    ).not.toHaveAttribute('data-status', /Handling|Error|Success/);
    await humanClick(this.confirmButton('os-migrate-cancel'));
    await expect(this.page.getByTestId('os-migrate-body')).toHaveCount(0, {
      timeout: 15_000,
    });
  }

  /**
   * 모델 목록에서 그 모델을 골라 삭제한다. 다른 모델이 계보로 가리키는 모델은 cm-damselfly 가
   * 거절하므로 목표 → 계획 → 소스 순서로 지운다.
   */
  async deleteModel(kind: 'source' | 'target', name: string): Promise<void> {
    const models = new ModelsPage(this.page);
    if (kind === 'source') await models.gotoSourceModels();
    else await models.gotoTargetModels();
    await models.selectModel(name);
    await humanClick(this.page.getByTestId('model-list-delete'));
    await humanClick(this.confirmButton('model-list-delete-confirm'));
    await expect(
      this.page.getByTestId('model-list-table').getByRole('row', { name }),
    ).toHaveCount(0, { timeout: 30_000 });
  }
}
