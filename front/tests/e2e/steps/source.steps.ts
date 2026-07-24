import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { test } from '../support/fixtures';
import { SourceServicesPage, Connection } from '../pages/sourceServices.page';
import { sourceServer } from '../fixtures/test-data';
import { uniqueName } from '../support/naming';
import { scenarioState } from '../support/world';

const { Given, When, Then } = createBdd(test);

/**
 * 지금 다루고 있는 소스그룹 이름.
 * 등록 스텝이 기억해 둔 값을 쓰고, 없으면(등록 없이 수집만 하는 경우) fixtures 기본값으로 되돌아간다.
 */
function currentSourceGroup(): string {
  return scenarioState.sourceGroupName ?? uniqueName(sourceServer.name);
}

/**
 * 소스 서비스(소스 컴퓨팅, cm-honeybee) 도메인 스텝.
 *
 * - 시나리오 문장(의도) ↔ Page Object(화면 위치·요소) 연결 계층.
 * - 마이그레이션 시나리오가 조립할 수 있도록 "소스서버 등록"·"인프라 수집"을
 *   재사용 가능한 상위 스텝으로 제공하고, 그 아래 유닛 스텝도 함께 둔다.
 */

/** fixtures/test-data.ts의 sourceServer + 환경변수(키/비밀번호)로 연결정보 조립.
 *  연결 이름도 honeybee에서 UNIQUE 제약이라 런별 고유 접미사를 붙인다. */
function connectionFromFixture(name: string): Connection {
  return {
    name: uniqueName(name),
    ip: sourceServer.ip,
    sshPort: sourceServer.sshPort,
    user: sourceServer.sshUser,
    // privateKey가 있으면 key 인증을 우선(둘 다 채우면 인증 방식이 모호해짐)
    password: sourceServer.privateKey
      ? undefined
      : sourceServer.password || undefined,
    privateKey: sourceServer.privateKey || undefined,
  };
}

// ───────────────────────── 상위(재사용) 스텝 — 마이그레이션 시나리오가 조립 ─────────────────────────

/**
 * "그리고 소스 서비스에 \"nano\"소스서버를 등록한다"
 * → 소스 서비스 화면으로 이동해 소스그룹 {string} 을 만들고, 같은 이름의 연결정보를 함께 등록한다.
 *   (온프렘 소스 서버 자리 = fixtures sourceServer)
 */
Given(
  '소스 서비스에 {string} 소스서버를 등록한다',
  async ({ page }, name: string) => {
    const source = new SourceServicesPage(page);
    await source.goto();
    await source.createSourceGroupWithConnection(
      uniqueName(name),
      connectionFromFixture(name),
    );
    // 뒤따르는 수집·저장 스텝이 *방금 등록한 그룹*을 대상으로 삼도록 기억해 둔다.
    // (예전엔 fixtures의 sourceServer.name을 그대로 박아 써서, 다른 이름으로 등록해도 엉뚱한 그룹을 집었다.)
    scenarioState.sourceGroupName = uniqueName(name);
  },
);

/**
 * "먼저 기존 소스 그룹 \"cmig-sshtest-group\" 을 사용한다"
 *
 * 이미 등록돼 있는 소스 그룹을 그대로 쓴다(새로 등록하지 않는다). 등록 스텝과 달리 런별 접미사를
 * 붙이지 않고 *화면에 보이는 이름 그대로* 잡는다 — 실 서버를 다시 등록하지 않고 수집·모델 저장부터
 * 이어가고 싶을 때(예: 서버 2대짜리 그룹으로 인프라를 만들 때) 쓴다.
 */
Given(
  '기존 소스 그룹 {string} 을 사용한다',
  async ({ page: _page }, name: string) => {
    scenarioState.sourceGroupName = name;
  },
);

/**
 * "그리고 소스 인프라를 수집한다"
 * → 등록한 소스그룹을 선택하면 하단 상세가 열리고, 상세의 Refresh로 연결 상태를 점검한 뒤
 *   Collect Infra(그룹단위 import-infra)를 실행해 결과(View Infra Meta 링크)를 확인한다.
 */
Given('소스 인프라를 수집한다', async ({ page }) => {
  const source = new SourceServicesPage(page);
  await source.selectGroup(currentSourceGroup());
  await source.collectInfra();
  await source.expectInfraCollected();
});

/**
 * "그리고 수집된 정보를 소스 모델로 저장한다"
 * → 수집 결과 팝업(Refine)에서 Convert → Save → 이름 입력 → 확인으로 인프라 소스모델(OnPremiseModel, "Basic")을 저장한다.
 *   이름은 소스그룹명(uniqueName)과 동일하게 해 이후 추천 단계에서 그 모델을 선택한다.
 */
Given('수집된 정보를 소스 모델로 저장한다', async ({ page }) => {
  const source = new SourceServicesPage(page);
  // 소스 모델 이름은 소스그룹 이름과 같게 둔다 — 이후 추천 단계가 그 이름으로 모델을 찾는다.
  const modelName = currentSourceGroup();
  await source.saveCollectedInfraAsSourceModel(modelName);
  scenarioState.sourceModelName = modelName;
});

// ───────────────────────── 유닛 스텝 ─────────────────────────

/** "먼저 소스 서비스 화면을 연다" */
Given('소스 서비스 화면을 연다', async ({ page }) => {
  await new SourceServicesPage(page).goto();
});

/** "만약 \"e2e-src\" 이름으로 소스그룹을 생성하면" — 연결정보 없이 그룹만 */
When(
  '{string} 이름으로 소스그룹을 생성하면',
  async ({ page }, name: string) => {
    await new SourceServicesPage(page).createSourceGroup(uniqueName(name));
  },
);

/** "만약 \"e2e-src\" 소스그룹에 \"e2e-conn\" 연결정보를 등록하면" — 그룹+연결정보 동시 등록 */
When(
  '{string} 소스그룹에 {string} 연결정보를 등록하면',
  async ({ page }, groupName: string, connName: string) => {
    const source = new SourceServicesPage(page);
    await source.goto();
    await source.createSourceGroupWithConnection(
      uniqueName(groupName),
      connectionFromFixture(connName),
    );
  },
);

/** "그리고 \"e2e-src\" 소스그룹을 선택한다" */
Given('{string} 소스그룹을 선택한다', async ({ page }, name: string) => {
  await new SourceServicesPage(page).selectGroup(uniqueName(name));
});

/** "그리고 \"e2e-conn\" 연결정보를 선택한다" (연결 탭 진입 포함) */
Given('{string} 연결정보를 선택한다', async ({ page }, connName: string) => {
  await new SourceServicesPage(page).openConnection(uniqueName(connName));
});

// ───────────────────────── 연결정보 익스포트 ─────────────────────────

/** "만약 \"e2e-group\" 소스그룹에 \"a\",\"b\" 연결정보를 대량 등록하면" (CSV 대량 임포트로 여러 건) */
When(
  '{string} 소스그룹에 {string} 연결정보를 대량 등록하면',
  async ({ page }, groupName: string, connCsv: string) => {
    const names = connCsv.split(',').map(n => uniqueName(n.trim()));
    await new SourceServicesPage(page).createSourceGroupWithBulkImport(
      uniqueName(groupName),
      names,
    );
  },
);

/** "그리고 \"e2e-conn\" 연결정보를 체크한다" (목록 체크박스 선택) */
Given('{string} 연결정보를 체크한다', async ({ page }, connName: string) => {
  await new SourceServicesPage(page).checkConnection(uniqueName(connName));
});

/** "그리고 연결정보를 모두 체크한다" (헤더 체크박스로 전체 선택) */
Given('연결정보를 모두 체크한다', async ({ page }) => {
  await new SourceServicesPage(page).checkAllConnections();
});

/** "그리고 익스포트 형식을 \"엑셀\"로 고른다" (기본 CSV, 엑셀만 명시) */
When('익스포트 형식을 {string} 로 고른다', async ({ page }, label: string) => {
  const format = /엑셀|excel|xlsx/i.test(label) ? 'xlsx' : 'csv';
  await new SourceServicesPage(page).selectExportFormat(format);
});

/** "그러면 익스포트 버튼이 비활성이다" */
Then('익스포트 버튼이 비활성이다', async ({ page }) => {
  await new SourceServicesPage(page).expectExportDisabled();
});

/** "그러면 익스포트 버튼이 활성이다" */
Then('익스포트 버튼이 활성이다', async ({ page }) => {
  await new SourceServicesPage(page).expectExportEnabled();
});

/** "만약 익스포트를 누르면" — 확인 모달이 열리는 데까지 */
When('익스포트를 누르면', async ({ page }) => {
  await new SourceServicesPage(page).openExportConfirm();
});

/** "그러면 암호화 컬럼 안내가 보인다" — 모달 열림은 내용물로 판정한다 */
Then('암호화 컬럼 안내가 보인다', async ({ page }) => {
  await new SourceServicesPage(page).expectExportNoticeVisible();
});

/** "만약 익스포트를 확인하면" — 실제 다운로드까지 받아 파일명·내용을 기억해 둔다 */
When('익스포트를 확인하면', async ({ page }) => {
  const { fileName, content } = await new SourceServicesPage(
    page,
  ).confirmExportAndDownload();
  scenarioState.exportedFileName = fileName;
  scenarioState.exportedFileContent = content;
});

/** "만약 익스포트를 취소하면" */
When('익스포트를 취소하면', async ({ page }) => {
  await new SourceServicesPage(page).cancelExport();
});

/** "그러면 \"e2e-conn\" 이름으로 시작하는 파일이 내려받아진다" */
Then(
  '{string} 이름으로 시작하는 파일이 내려받아진다',
  async ({}, baseName: string) => {
    const fileName = scenarioState.exportedFileName ?? '';
    expect(fileName).toContain(uniqueName(baseName));
    // 같은 대상을 다시 내보내도 겹치지 않도록 타임스탬프가 붙는다(형식은 csv·xlsx 공통).
    expect(fileName).toMatch(/-\d{8}-\d{6}\.(csv|xlsx)$/);
  },
);

/** "그러면 내려받은 파일 확장자가 \"xlsx\"다" */
Then('내려받은 파일 확장자가 {string} 다', async ({}, ext: string) => {
  const fileName = scenarioState.exportedFileName ?? '';
  expect(fileName.endsWith(`.${ext}`)).toBe(true);
});

/** "그러면 익스포트 파일에 데이터가 2행 있다" (CSV 내용 기준 — 여러 건이 다 담겼는지) */
Then('익스포트 파일에 데이터가 {int} 행 있다', async ({}, count: number) => {
  const content = scenarioState.exportedFileContent ?? '';
  const lines = content.trim().split(/\r?\n/);
  // 헤더 한 줄을 뺀 나머지가 데이터 행이다.
  expect(lines.length - 1).toBe(count);
});

/** "그러면 익스포트 파일이 임포트 양식과 같고 암호화 컬럼이 비어 있다"
 *  이 기능의 핵심 약속 두 가지 — 임포트 양식 그대로일 것, 암호화 값은 나가지 않을 것. */
Then('익스포트 파일이 임포트 양식과 같고 암호화 컬럼이 비어 있다', async () => {
  const content = scenarioState.exportedFileContent ?? '';
  const lines = content.trim().split(/\r?\n/);

  const headers = lines[0].split(',');
  expect(headers).toEqual([
    'name',
    'description',
    'ip_address',
    'ssh_port',
    'user',
    'password',
    'private_key',
  ]);

  // 데이터가 최소 한 행 있어야 검증이 의미를 갖는다.
  expect(lines.length).toBeGreaterThan(1);

  // user·password·private_key는 마지막 세 컬럼이고 항상 비어 있어야 한다.
  for (const line of lines.slice(1)) {
    const cells = line.split(',');
    expect(cells.slice(-3)).toEqual(['', '', '']);
  }
});

/** "만약 인프라 수집을 실행하면" (현재 선택된 연결정보 기준) */
When('인프라 수집을 실행하면', async ({ page }) => {
  await new SourceServicesPage(page).collectInfra();
});

// ───────────────────────── 검증 스텝 ─────────────────────────

/** "그러면 소스그룹 목록에 \"e2e-src\" 이\\(가\\) 보인다" */
Then(
  '소스그룹 목록에 {string} 이\\(가\\) 보인다',
  async ({ page }, name: string) => {
    // 생성은 uniqueName으로 하는데 확인은 원래 이름으로 하고 있었다 — 같은 이름으로 맞춘다.
    await new SourceServicesPage(page).expectGroupListed(uniqueName(name));
  },
);

/** "그러면 연결정보 목록에 \"e2e-conn\" 이\\(가\\) 보인다" */
Then(
  '연결정보 목록에 {string} 이\\(가\\) 보인다',
  async ({ page }, connName: string) => {
    await new SourceServicesPage(page).expectConnectionListed(
      uniqueName(connName),
    );
  },
);

/** "그러면 인프라 수집 결과가 조회된다" (정제 결과 링크 노출) */
Then('인프라 수집 결과가 조회된다', async ({ page }) => {
  await new SourceServicesPage(page).expectInfraCollected();
});
