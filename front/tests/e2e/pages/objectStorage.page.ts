import { Locator, Page, expect } from '@playwright/test';
import { humanClick, humanFill } from '../support/humanize';
import type { CspAccess } from '../support/cspAccess';

/**
 * Object Storages — 버킷 마이그레이션(cm-beetle).
 *
 * 소스 버킷 스캔·정밀 조회 → 소스 모델 저장 → 목표 추천 → 목표 모델 저장 → 버킷 생성 →
 * 이행된 버킷 조회·삭제. 모델은 cm-beetle 산출물 저장소에 들어간다.
 *
 * 표는 미리내 표가 아니라 일반 표이고, 선택은 행의 `data-selected` 로 드러난다.
 * 이행 결과는 화면의 상태 표시 `data-status`(Handling/Success/Error)로 판정한다.
 */
export class ObjectStoragePage {
  constructor(private readonly page: Page) {}

  async open(): Promise<void> {
    await humanClick(
      this.page.getByText('Object Storages', { exact: true }).first(),
    );
    await expect(this.page.getByTestId('object-storages-header')).toBeVisible({
      timeout: 30_000,
    });
  }

  async openTab(label: RegExp): Promise<void> {
    await humanClick(this.page.getByRole('tab', { name: label }));
  }

  async expectSteps(): Promise<void> {
    for (const name of [
      /Source Buckets/,
      /Target Recommendation/,
      /Migration/,
      /Migrated Buckets/,
    ]) {
      await expect(this.page.getByRole('tab', { name })).toBeVisible();
    }
  }

  private async pick(testid: string, value: string): Promise<void> {
    const dropdown = this.page.getByTestId(testid);
    await humanClick(dropdown);
    await humanClick(
      dropdown
        .locator('.p-context-menu-item', {
          hasText: new RegExp(`^\\s*${value}\\s*$`),
        })
        .first(),
    );
  }

  private input(testid: string): Locator {
    return this.page.locator(`input[data-testid="${testid}"]`).first();
  }

  async scan(access: CspAccess): Promise<string[]> {
    await this.openTab(/Source Buckets/);
    await this.pick('os-source-provider', access.provider);
    await humanFill(this.input('os-source-region'), access.region);
    await humanFill(this.input('os-source-access-key'), access.accessKey);
    await humanFill(this.input('os-source-secret-key'), access.secretKey);
    await humanClick(this.page.getByTestId('os-source-scan'));
    const table = this.page.getByTestId('os-source-bucket-table');
    await expect(table).toBeVisible({ timeout: 120_000 });
    return table
      .locator('tbody tr')
      .evaluateAll(rows =>
        rows.map(r =>
          (r.getAttribute('data-testid') ?? '').replace(
            'os-source-bucket-',
            '',
          ),
        ),
      );
  }

  async pickBucket(name: string): Promise<void> {
    const row = this.page.getByTestId(`os-source-bucket-${name}`);
    await humanClick(row);
    await expect(row).toHaveAttribute('data-selected', 'true');
  }

  async inspectAndSaveSourceModel(modelName: string): Promise<void> {
    await humanClick(this.page.getByTestId('os-source-inspect'));
    await expect(this.page.getByTestId('os-source-inspected')).toBeVisible({
      timeout: 180_000,
    });
    await humanFill(this.input('os-source-model-name'), modelName);
    await humanClick(this.page.getByTestId('os-source-save'));
    await expect(
      this.page.getByTestId(`os-source-model-${modelName}`),
    ).toHaveAttribute('data-selected', 'true', { timeout: 30_000 });
  }

  async recommendAndSaveTargetModel(
    sourceModel: string,
    provider: string,
    region: string,
    modelName: string,
  ): Promise<void> {
    await this.openTab(/Target Recommendation/);
    await humanClick(this.page.getByTestId(`os-source-model-${sourceModel}`));
    await this.pick('os-target-provider', provider);
    await humanFill(this.input('os-target-region'), region);
    await expect(this.page.getByTestId('os-target-support')).toBeVisible();
    await humanClick(this.page.getByTestId('os-target-recommend'));
    await expect(this.page.getByTestId('os-target-recommended')).toBeVisible({
      timeout: 120_000,
    });
    await humanFill(this.input('os-target-model-name'), modelName);
    await humanClick(this.page.getByTestId('os-target-save'));
    await expect(
      this.page.getByTestId(`os-target-model-${modelName}`),
    ).toHaveAttribute('data-selected', 'true', { timeout: 30_000 });
  }

  /** 목표 모델 행의 "From source model" 칸 — 계보로 이어진 소스 모델 산출물 ID. */
  async targetModelLineage(modelName: string): Promise<string> {
    return (
      await this.page
        .getByTestId(`os-target-model-${modelName}`)
        .locator('td')
        .nth(4)
        .innerText()
    ).trim();
  }

  async migratedBucketIds(): Promise<string[]> {
    await this.openTab(/Migrated Buckets/);
    await humanClick(this.page.getByTestId('os-migrated-refresh'));
    const table = this.page.getByTestId('os-migrated-table');
    await expect(table).toBeVisible();
    await this.page
      .waitForResponse(r => r.url().includes('ListObjectStorages'), {
        timeout: 30_000,
      })
      .catch(() => undefined);
    return table
      .locator('tbody tr[data-testid^="os-migrated-"]')
      .evaluateAll(rows =>
        rows.map(r =>
          (r.getAttribute('data-testid') ?? '').replace('os-migrated-', ''),
        ),
      );
  }

  /** 버킷을 만들고 결과가 Success/Error 로 정해질 때까지 상태 표시를 지켜본다. */
  async createBuckets(targetModel: string, nameSeed: string): Promise<string> {
    await this.openTab(/^3\. Migration/);
    await humanClick(this.page.getByTestId(`os-target-model-${targetModel}`));
    await humanFill(this.input('os-migrate-name-seed'), nameSeed);
    await humanClick(this.page.getByTestId('os-migrate-start'));
    const status = this.page.getByTestId('os-migrate-status');
    await expect(status).toHaveAttribute('data-status', /Success|Error/, {
      timeout: 300_000,
    });
    return (await status.getAttribute('data-status')) ?? '';
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
    await humanClick(
      this.page.locator('button', {
        has: this.page.getByTestId('os-migrated-delete-confirm'),
      }),
    );
    await expect(this.page.getByTestId(`os-migrated-${osId}`)).toHaveCount(0, {
      timeout: 120_000,
    });
  }

  async deleteModel(kind: 'source' | 'target', name: string): Promise<void> {
    await this.openTab(
      kind === 'source' ? /Target Recommendation/ : /^3\. Migration/,
    );
    await humanClick(this.page.getByTestId(`os-${kind}-model-delete-${name}`));
    await expect(this.page.getByTestId(`os-${kind}-model-${name}`)).toHaveCount(
      0,
      {
        timeout: 30_000,
      },
    );
  }
}
