import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { test } from '../support/fixtures';
import { ObjectStoragePage } from '../pages/objectStorage.page';
import { CspSourcePage } from '../pages/cspSource.page';
import { SourceServicesPage } from '../pages/sourceServices.page';
import { ModelsPage } from '../pages/models.page';
import { cspAccess, testBucket } from '../support/cspAccess';
import { uniqueName } from '../support/naming';

const { Given, When, Then } = createBdd(test);

// 이번 실행에서 만든 것. 시나리오 끝에서 지운다.
const run = {
  group: '',
  sourceModel: '',
  sourceModelId: '',
  planningModel: '',
  planningModelId: '',
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

Then('이행된 버킷 목록만 보이고 직접 시험 단계는 없다', async ({ page }) => {
  const os = new ObjectStoragePage(page);
  await os.expectMigratedList();
  await os.expectNoDirectFlow();
});

When('System 의 Develop 화면을 열면', async ({ page }) => {
  await new ObjectStoragePage(page).openDevelop();
});

Then(
  '오브젝트 스토리지 직접 시험 단계 3개가 탭으로 보인다',
  async ({ page }) => {
    await new ObjectStoragePage(page).expectDirectFlowTabs();
  },
);

Then(
  '목표 모델의 버킷 만들기에서 버킷 이름 규칙에 맞지 않는 접두어는 요청 없이 막힌다',
  async ({ page }) => {
    await new ObjectStoragePage(page).expectInvalidNameSeedBlocked(
      run.targetModel,
      'Mig_01',
    );
  },
);

Given('시험용 계정으로 클라우드 소스 서비스를 등록한다', async ({ page }) => {
  // 이 스텝이 시나리오의 시작이다. 앞 시나리오가 남긴 이름이 정리 단계로 넘어가지 않게 비운다.
  Object.assign(run, {
    group: '',
    sourceModel: '',
    sourceModelId: '',
    planningModel: '',
    planningModelId: '',
    targetModel: '',
    bucketsBefore: [],
    created: [],
  });
  const access = cspAccess();
  run.group = uniqueName('e2e-os-csp');
  const sources = new SourceServicesPage(page);
  const csp = new CspSourcePage(page);
  await sources.gotoCloud();
  await csp.openCspRegistration();
  await csp.selectProvider(access.provider);
  await csp.fill(run.group, access);
  await csp.register();
  await csp.expectGroupShownAsCloud(run.group, access);
});

When(
  '소스 서비스 상세에서 버킷을 스캔해 시험용 버킷을 등록하면',
  async ({ page }) => {
    await new ObjectStoragePage(page).scanAndRegisterBucket(
      run.group,
      testBucket(),
    );
  },
);

Then('그 버킷이 커넥션 목록에 보인다', async ({ page }) => {
  await new ObjectStoragePage(page).expectBucketConnection(testBucket());
});

When(
  'Source Models 에서 그 버킷을 수집해 오브젝트 스토리지 소스 모델을 만들면',
  async ({ page }) => {
    run.sourceModel = uniqueName('e2e-os-src');
    run.sourceModelId = await new ObjectStoragePage(page).createSourceModel(
      run.group,
      testBucket(),
      run.sourceModel,
    );
    expect(run.sourceModelId).not.toBe('');
  },
);

Then('그 소스 모델에 그 버킷이 수집한 설정으로 들어 있다', async ({ page }) => {
  await new ObjectStoragePage(page).expectCollectedBucketInModel(
    run.sourceModel,
    testBucket(),
  );
});

Then('그 소스 모델에서는 추천을 받을 수 없다', async ({ page }) => {
  const models = new ModelsPage(page);
  await models.gotoSourceModels();
  await models.expectSourceModelReadOnly(run.sourceModel);
});

When('그 소스 모델을 계획 모델로 저장하면', async ({ page }) => {
  run.planningModel = uniqueName('e2e-os-plan');
  const models = new ModelsPage(page);
  await models.gotoSourceModels();
  await models.selectModel(run.sourceModel);
  await models.saveAsSourceModel(run.planningModel);
  run.planningModelId = await new ObjectStoragePage(page).selectedModelId(
    run.planningModel,
  );
  expect(run.planningModelId).not.toBe('');
});

Then('계획 모델이 그 소스 모델에서 나온 것으로 보인다', async ({ page }) => {
  const models = new ModelsPage(page);
  await models.expectSourceDetailStage(run.planningModel, 'Planning');
  await models.expectDerivedFrom(run.planningModel, run.sourceModelId);
});

When(
  '계획 모델에서 같은 CSP·리전으로 추천받아 목표 모델로 저장하면',
  async ({ page }) => {
    const access = cspAccess();
    run.targetModel = uniqueName('e2e-os-tgt');
    await new ObjectStoragePage(page).recommendAndSaveTargetModel(
      run.planningModel,
      access.provider,
      access.region,
      run.targetModel,
    );
  },
);

When('그 버킷 연결의 정보에서 수집하면', async ({ page }) => {
  await new ObjectStoragePage(page).collectFromConnection(testBucket());
});

Then('수집한 버킷 설정이 그 자리에 보인다', async ({ page }) => {
  await new ObjectStoragePage(page).expectCollectedSettingsShown();
});

When('그 자리에서 소스 모델로 저장하면', async ({ page }) => {
  run.sourceModel = uniqueName('e2e-os-conn');
  await new ObjectStoragePage(page).saveSourceModelFromConnection(
    testBucket(),
    run.sourceModel,
  );
});

Then('목표 모델이 그 계획 모델을 계보로 가리킨다', async ({ page }) => {
  const parent = await new ObjectStoragePage(page).targetModelPlanningId(
    run.targetModel,
  );
  expect(parent).toBe(run.planningModelId);
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
  // 계보로 참조되는 모델은 지워지지 않으므로 목표 → 계획 → 소스 순서로 지운다.
  if (run.targetModel) await os.deleteModel('target', run.targetModel);
  if (run.planningModel) await os.deleteModel('source', run.planningModel);
  if (run.sourceModel) await os.deleteModel('source', run.sourceModel);
  if (run.group) {
    const sources = new SourceServicesPage(page);
    await sources.gotoCloud();
    await sources.selectGroup(run.group);
    await sources.deleteSelectedGroup();
  }
});
