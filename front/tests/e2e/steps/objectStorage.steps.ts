import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { test } from '../support/fixtures';
import { ObjectStoragePage } from '../pages/objectStorage.page';
import { CspSourcePage } from '../pages/cspSource.page';
import { SourceServicesPage } from '../pages/sourceServices.page';
import { cspAccess, testBucket } from '../support/cspAccess';
import { uniqueName } from '../support/naming';

const { Given, When, Then } = createBdd(test);

// 이번 실행에서 만든 것. 시나리오 끝에서 지운다.
const run = {
  group: '',
  sourceModel: '',
  sourceModelId: '',
  targetModel: '',
  bucketsBefore: [] as string[],
  created: [] as string[],
};

Given('오브젝트 스토리지 화면을 연다', async ({ page }) => {
  await new ObjectStoragePage(page).open();
});

Then('이행된 버킷 목록이 보인다', async ({ page }) => {
  await new ObjectStoragePage(page).expectMigratedList();
});

Given(
  '시험용 버킷을 커넥션으로 가진 클라우드 소스 서비스를 등록한다',
  async ({ page }) => {
    const access = cspAccess();
    const bucket = testBucket();
    run.group = uniqueName('e2e-os-csp');
    const sources = new SourceServicesPage(page);
    const csp = new CspSourcePage(page);
    await sources.goto();
    await csp.openCspRegistration();
    await csp.selectProvider(access.provider);
    await csp.fill(run.group, access);
    await csp.register();
    await csp.expectGroupShownAsCloud(run.group, access);
    await sources.selectGroup(run.group);
    await page.getByRole('tab', { name: /Connections/i }).click();
    await csp.openCspConnectionModal();
    await csp.chooseResourceType('Object Storage');
    await csp.discoverAndPick(bucket);
    await csp.addPickedResources();
  },
);

When('그 버킷 커넥션을 수집해 소스 모델로 저장하면', async ({ page }) => {
  const os = new ObjectStoragePage(page);
  run.sourceModel = uniqueName('e2e-os-src');
  await os.collectBucket(run.group, testBucket());
  await os.saveCollectedAsSourceModel(run.sourceModel);
});

Then('소스 모델 목록에 오브젝트 스토리지 유형으로 보인다', async ({ page }) => {
  run.sourceModelId = await new ObjectStoragePage(
    page,
  ).expectObjectStorageModel('source', run.sourceModel);
});

When('같은 CSP·리전으로 추천받아 목표 모델로 저장하면', async ({ page }) => {
  const access = cspAccess();
  run.targetModel = uniqueName('e2e-os-tgt');
  await new ObjectStoragePage(page).recommendAndSaveTargetModel(
    run.sourceModel,
    access.provider,
    access.region,
    run.targetModel,
  );
});

Then('목표 모델이 그 소스 모델을 계보로 가리킨다', async ({ page }) => {
  const artifact = await new ObjectStoragePage(page).targetModelArtifact(
    run.targetModel,
  );
  expect(artifact.lineage?.sourceModelId).toBe(run.sourceModelId);
  expect(
    artifact.payload?.targetObjectStorages?.map((b: any) => b.sourceBucketName),
  ).toContain(testBucket());
});

When('목표 모델에서 버킷을 만들면', async ({ page }) => {
  const os = new ObjectStoragePage(page);
  await os.open();
  run.bucketsBefore = await os.migratedBucketIds();
  const status = await os.migrateFromTargetModel(
    run.targetModel,
    uniqueName('cmig').replace(/-/g, ''),
  );
  expect(status).toBe('Success');
});

Then('새 버킷이 이행된 버킷 목록에 보이고 비어 있다', async ({ page }) => {
  const os = new ObjectStoragePage(page);
  const after = await os.migratedBucketIds();
  run.created = after.filter(id => !run.bucketsBefore.includes(id));
  expect(run.created.length).toBeGreaterThan(0);
  for (const id of run.created) await os.expectBucketEmpty(id);
});

Then('만든 버킷을 지우면 목록에서 사라진다', async ({ page }) => {
  const os = new ObjectStoragePage(page);
  for (const id of run.created) await os.deleteBucket(id);
});

Then('이번에 만든 모델과 소스 서비스를 지운다', async ({ page }) => {
  const os = new ObjectStoragePage(page);
  if (run.targetModel) await os.deleteModel('target', run.targetModel);
  if (run.sourceModel) await os.deleteModel('source', run.sourceModel);
  if (run.group) {
    const sources = new SourceServicesPage(page);
    await sources.goto();
    await sources.selectGroup(run.group);
    await sources.deleteSelectedGroup();
  }
});
