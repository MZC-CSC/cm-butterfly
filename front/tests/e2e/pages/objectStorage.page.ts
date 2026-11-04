import { Locator, Page, expect } from '@playwright/test';
import { humanClick, humanFill } from '../support/humanize';
import { ModelsPage } from './models.page';
import { SourceServicesPage } from './sourceServices.page';

/**
 * 오브젝트 스토리지(버킷) 마이그레이션 — 서버와 같은 단계를 밟는다.
 *
 *   클라우드 소스 서비스의 버킷 커넥션 → Bucket Collect 탭에서 수집 → 소스 모델 저장
 *   → Source Models 의 View Recommended List 로 추천 → 목표 모델 저장
 *   → Target Models 의 Migrate Buckets 로 버킷 생성
 *   → Workload Operations ▸ Object Storages 에서 조회·삭제
 *
 * 모델은 cm-beetle 산출물 저장소에 있고 목록에서는 Migration Type 이 `Object Storage` 다.
 * 판정은 화면이 드러내는 결과로 한다 — 수집·이행 상태는 `data-status`, 계보는 모델 JSON.
 * 미리내 버튼 비활성은 클래스뿐이라(DESIGN-MIRINAE §1.6) 버튼 상태로 판정하지 않는다.
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

  async migratedBucketIds(): Promise<string[]> {
    await humanClick(this.page.getByTestId('os-migrated-refresh'));
    await expect(this.page.getByTestId('os-migrated-table')).toBeVisible();
    return this.page
      .getByTestId('os-migrated-table')
      .locator('tbody tr[data-testid^="os-migrated-"]')
      .evaluateAll(rows =>
        rows
          .map(r => r.getAttribute('data-testid') ?? '')
          .filter(id => id !== 'os-migrated-empty')
          .map(id => id.replace('os-migrated-', '')),
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

  // ── Source Services: the bucket connection ───────────────────────────────

  /** 그룹의 버킷 커넥션을 골라 Bucket Collect 탭에서 수집한다. 그 버킷을 계정에서 찾아야 성공이다. */
  async collectBucket(group: string, bucket: string): Promise<void> {
    const sources = new SourceServicesPage(this.page);
    await sources.goto();
    await sources.selectGroup(group);
    await humanClick(this.page.getByRole('tab', { name: /Connections/i }));
    const row = this.page
      .getByTestId('source-connection-list-table')
      .getByRole('row', { name: new RegExp(bucket) })
      .first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await humanClick(row);
    await humanClick(
      this.page
        .getByTestId('source-connection-detail')
        .getByText('Bucket Collect', { exact: true }),
    );
    await expect(this.page.getByTestId('bucket-collect-name')).toHaveText(
      bucket,
    );
    await humanClick(this.page.getByTestId('bucket-collect-run'));
    await expect(
      this.page.getByTestId('bucket-collect-status'),
    ).toHaveAttribute('data-status', /success|failed/, { timeout: 120_000 });
    await expect(
      this.page.getByTestId('bucket-collect-status'),
    ).toHaveAttribute('data-status', 'success');
  }

  async saveCollectedAsSourceModel(name: string): Promise<void> {
    await humanClick(this.page.getByTestId('bucket-collect-save-model'));
    await humanFill(this.input('model-name-input'), name);
    await humanClick(this.confirmButton('model-name-save'));
    await expect(this.page.getByTestId('bucket-collect-saved')).toContainText(
      name,
      { timeout: 30_000 },
    );
  }

  // ── Models ───────────────────────────────────────────────────────────────

  /** 목록에서 그 모델의 Migration Type 이 Object Storage 로 보이는지. 모델 ID(`art-…`)를 돌려준다. */
  async expectObjectStorageModel(
    kind: 'source' | 'target',
    name: string,
  ): Promise<string> {
    const models = new ModelsPage(this.page);
    if (kind === 'source') await models.gotoSourceModels();
    else await models.gotoTargetModels();
    await models.expectModelInList(name);
    const row = this.page
      .getByTestId('model-list-table')
      .getByRole('row', { name: new RegExp(name) })
      .first();
    await expect(row).toContainText('Object Storage');
    const id = (await row.innerText()).match(/\bart-[a-z0-9]+\b/)?.[0];
    if (!id) throw new Error(`${name} 행에서 모델 ID 를 찾지 못했다`);
    return id;
  }

  async recommendAndSaveTargetModel(
    sourceModel: string,
    provider: string,
    region: string,
    targetModel: string,
  ): Promise<void> {
    const models = new ModelsPage(this.page);
    await models.gotoSourceModels();
    await models.selectModel(sourceModel);
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
    await humanFill(this.input('os-recommend-region'), region);
    await humanClick(this.page.getByTestId('os-recommend-run'));
    await expect(this.page.getByTestId('os-recommend-table')).toBeVisible({
      timeout: 120_000,
    });
    await humanFill(this.input('os-recommend-model-name'), targetModel);
    await humanClick(this.confirmButton('os-recommend-save'));
    await expect(this.page.getByTestId('os-recommend-go-target')).toBeVisible({
      timeout: 30_000,
    });
    await humanClick(this.page.getByTestId('os-recommend-go-target'));
  }

  /** 목표 모델 상세의 View Target Model 이 보여 주는 cm-beetle 산출물 JSON. */
  async targetModelArtifact(targetModel: string): Promise<any> {
    const models = new ModelsPage(this.page);
    await models.gotoTargetModels();
    await models.selectModel(targetModel);
    await humanClick(this.page.getByTestId('target-detail-custom-view'));
    const json = await this.page.getByTestId('os-model-view-json').innerText();
    await humanClick(this.confirmButton('os-model-view-close'));
    return JSON.parse(json);
  }

  /** 목표 모델에서 Migrate Buckets 로 버킷을 만들고 Success/Error 가 정해질 때까지 지켜본다. */
  async migrateFromTargetModel(
    targetModel: string,
    nameSeed: string,
  ): Promise<string> {
    const models = new ModelsPage(this.page);
    await models.gotoTargetModels();
    await models.selectModel(targetModel);
    await humanClick(this.page.getByTestId('target-migrate-buckets'));
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

  async deleteModel(kind: 'source' | 'target', name: string): Promise<void> {
    const models = new ModelsPage(this.page);
    if (kind === 'source') await models.gotoSourceModels();
    else await models.gotoTargetModels();
    const row = this.page
      .getByTestId('model-list-table')
      .getByRole('row', { name: new RegExp(name) })
      .first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    // 미리내 표의 체크박스는 실제 input 이 아니다(DESIGN-MIRINAE §1.5) — 행을 눌러 고른다.
    await humanClick(row);
    await humanClick(this.page.getByTestId('model-list-delete'));
    await humanClick(this.confirmButton('model-list-delete-confirm'));
    await expect(
      this.page
        .getByTestId('model-list-table')
        .getByRole('row', { name: new RegExp(name) }),
    ).toHaveCount(0, { timeout: 30_000 });
  }
}
