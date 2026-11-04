import { Locator, Page, expect } from '@playwright/test';
import { humanClick, humanFill } from '../support/humanize';
import { SourceServicesPage } from './sourceServices.page';
import { RegionSelectControl } from './regionSelect.page';

/**
 * 오브젝트 스토리지(버킷) 마이그레이션.
 *
 *   Source Services ▸ (클라우드 소스) Detail ▸ Scan Buckets → 버킷을 커넥션으로 등록
 *   → Models ▸ Object Storage Models ▸ Source ▸ Create Source Model (등록된 버킷 선택·속성 확인)
 *   → Recommend Target → 목표 모델 저장 (Target 탭)
 *   → Migrate Buckets → Workload Operations ▸ Object Storages 에서 조회·삭제
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

  // ── Models ▸ Object Storage Models ───────────────────────────────────────

  async openModels(): Promise<void> {
    await humanClick(
      this.page.getByText('Object Storage Models', { exact: true }).first(),
    );
    await expect(this.page.getByTestId('os-models-header')).toBeVisible({
      timeout: 30_000,
    });
  }

  private async openModelTab(name: 'Source' | 'Target'): Promise<void> {
    await humanClick(this.page.getByRole('tab', { name, exact: true }));
  }

  /** 등록된 버킷으로 소스 모델을 만든다. 원본 버킷은 버전 관리가 켜져 있어 그 값을 넣는다. 모델 ID 를 돌려준다. */
  async createSourceModel(
    group: string,
    bucket: string,
    name: string,
  ): Promise<string> {
    await this.openModels();
    await this.openModelTab('Source');
    await humanClick(this.page.getByTestId('os-models-source-create'));
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
    await humanClick(
      this.page.getByTestId(`os-source-create-versioning-${bucket}`),
    );
    await expect(row).toHaveAttribute('data-selected', 'true');
    await humanFill(this.input('os-source-create-name'), name);
    await humanClick(this.confirmButton('os-source-create-save'));
    await expect(this.page.getByTestId('os-source-create-body')).toHaveCount(
      0,
      { timeout: 30_000 },
    );
    const listed = this.page.getByTestId(`os-models-source-${name}`);
    await expect(listed).toBeVisible({ timeout: 30_000 });
    return (await listed.getAttribute('data-id')) ?? '';
  }

  /** 연결 목록에서 그 버킷 연결을 열고 Information 의 Collect → Save as Source Model 로 저장한다. */
  async collectAndSaveFromConnection(
    bucket: string,
    name: string,
  ): Promise<void> {
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
    await humanClick(this.page.getByTestId('bucket-collect-save-model'));
    await expect(
      this.page.getByTestId(`os-source-create-bucket-${bucket}`),
    ).toHaveAttribute('data-selected', 'true', { timeout: 30_000 });
    await humanFill(this.input('os-source-create-name'), name);
    await humanClick(this.confirmButton('os-source-create-save'));
    await expect(this.page.getByTestId('bucket-collect-saved')).toContainText(
      name,
      { timeout: 30_000 },
    );
  }

  async expectSourceModelBucket(name: string, bucket: string): Promise<void> {
    await humanClick(this.page.getByTestId(`os-models-source-${name}`));
    await expect(
      this.page.getByTestId('os-models-source-detail'),
    ).toContainText(bucket);
  }

  async recommendAndSaveTargetModel(
    sourceModel: string,
    provider: string,
    region: string,
    targetModel: string,
  ): Promise<void> {
    await this.openModels();
    await this.openModelTab('Source');
    await humanClick(this.page.getByTestId(`os-models-source-${sourceModel}`));
    await humanClick(this.page.getByTestId('os-models-source-recommend'));
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

  /** 목표 모델 행이 가리키는 소스 모델 ID (계보). */
  async targetModelSourceId(targetModel: string): Promise<string> {
    await this.openModels();
    await this.openModelTab('Target');
    const row = this.page.getByTestId(`os-models-target-${targetModel}`);
    await expect(row).toBeVisible({ timeout: 30_000 });
    return (await row.getAttribute('data-source-model-id')) ?? '';
  }

  /** 목표 모델에서 Migrate Buckets 로 버킷을 만들고 Success/Error 가 정해질 때까지 지켜본다. */
  async migrateFromTargetModel(
    targetModel: string,
    nameSeed: string,
  ): Promise<string> {
    await this.openModels();
    await this.openModelTab('Target');
    await humanClick(this.page.getByTestId(`os-models-target-${targetModel}`));
    await humanClick(this.page.getByTestId('os-models-target-migrate'));
    await expect(this.page.getByTestId('os-migrate-body')).toBeVisible({
      timeout: 15_000,
    });
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
    await this.openModels();
    await this.openModelTab('Target');
    await humanClick(this.page.getByTestId(`os-models-target-${targetModel}`));
    await humanClick(this.page.getByTestId('os-models-target-migrate'));
    await expect(this.page.getByTestId('os-migrate-body')).toBeVisible({
      timeout: 15_000,
    });
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

  async deleteModel(kind: 'source' | 'target', name: string): Promise<void> {
    await this.openModels();
    await this.openModelTab(kind === 'source' ? 'Source' : 'Target');
    const row = this.page.getByTestId(`os-models-${kind}-${name}`);
    await expect(row).toBeVisible({ timeout: 30_000 });
    await humanClick(row);
    await humanClick(this.page.getByTestId(`os-models-${kind}-delete`));
    await humanClick(this.confirmButton('os-models-delete-confirm'));
    await expect(row).toHaveCount(0, { timeout: 30_000 });
  }
}
