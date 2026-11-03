import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { test } from '../support/fixtures';
import { ObjectStoragePage } from '../pages/objectStorage.page';
import { cspAccess } from '../support/cspAccess';
import { uniqueName } from '../support/naming';

const { Given, When, Then } = createBdd(test);

const run = {
  sourceModel: '',
  targetModel: '',
  bucketsBefore: [] as string[],
  created: [] as string[],
};

Given('오브젝트 스토리지 화면을 연다', async ({ page }) => {
  await new ObjectStoragePage(page).open();
});

Then('네 단계 탭이 보인다', async ({ page }) => {
  await new ObjectStoragePage(page).expectSteps();
});

When('소스 계정의 버킷을 스캔하면', async ({ page }) => {
  const buckets = await new ObjectStoragePage(page).scan(cspAccess());
  expect(buckets.length).toBeGreaterThan(0);
});

When(
  '환경변수로 지정한 버킷을 골라 정밀 조회하고 소스 모델로 저장하면',
  async ({ page }) => {
    const bucket = process.env.TEST_CSP_SOURCE_BUCKET;
    if (!bucket)
      throw new Error(
        'TEST_CSP_SOURCE_BUCKET 이 없다 — 조회할 소스 버킷을 지정한다',
      );
    run.sourceModel = uniqueName('e2e-os-src');
    const os = new ObjectStoragePage(page);
    await os.pickBucket(bucket);
    await os.inspectAndSaveSourceModel(run.sourceModel);
  },
);

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

Then('목표 모델이 소스 모델 산출물을 계보로 가리킨다', async ({ page }) => {
  const lineage = await new ObjectStoragePage(page).targetModelLineage(
    run.targetModel,
  );
  expect(lineage).toMatch(/^art-/);
});

When('목표 모델로 버킷을 만들면', async ({ page }) => {
  const os = new ObjectStoragePage(page);
  run.bucketsBefore = await os.migratedBucketIds();
  const status = await os.createBuckets(
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

Then('이번에 만든 소스·목표 모델을 지운다', async ({ page }) => {
  const os = new ObjectStoragePage(page);
  if (run.targetModel) await os.deleteModel('target', run.targetModel);
  if (run.sourceModel) await os.deleteModel('source', run.sourceModel);
});
