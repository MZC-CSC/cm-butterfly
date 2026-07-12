import { createBdd } from 'playwright-bdd';
import { test, expect } from '../support/fixtures';
import { WorkloadPage } from '../pages/workload.page';
import { SourceServicesPage } from '../pages/sourceServices.page';
import { sourceServer, workload } from '../fixtures/test-data';
import { scenarioState } from '../support/world';
import { uniqueName } from '../support/naming';

const { Given } = createBdd(test);

/**
 * 마이그레이션 시나리오 전용 스텝 — 대부분의 단계는 각 도메인 스텝(auth/source/models/workflow/workload)을
 * 그대로 재사용하고, 여기에는 시나리오 종료 정리(teardown)만 둔다.
 *
 * ★ 정리는 실제로 지워야 한다.
 *   예전 구현은 Page Object를 `as unknown as Record<...>` 로 캐스팅한 뒤 `goto?.()`·`selectInfra?.()`
 *   처럼 *존재하지 않는 메서드*를 옵셔널 호출해서, 아무것도 지우지 않고 조용히 통과했다(요금 누수).
 *   타입을 그대로 두고 실제 메서드를 부른다. 컴파일러가 오타를 잡게 하는 게 요점이다.
 *
 *   각 삭제는 실패해도 테스트를 깨뜨리지 않지만(정리는 best-effort), 실패하면 반드시 로그로 남긴다 —
 *   조용히 넘어가면 리소스가 남은 걸 아무도 모른다.
 */
Given('생성된 리소스를 정리한다', async ({ page }) => {
  const infraName = scenarioState.infraName ?? workload.infraName;

  // 1) 타깃 인프라(MCI) 삭제 — 요금 보호의 핵심
  //
  // ★ 두 가지를 *따로* 판정한다.
  //    (a) 삭제 모달이 스스로 닫히는가 — 화면의 동작
  //    (b) 인프라가 실제로 사라졌는가 — 자원의 결과
  //
  //    (a)가 실패해도 (b)는 성공할 수 있다(자원은 지워졌는데 화면만 안 닫히는 경우). 실제로 그런 상태다.
  //    그래서 (a)를 눈감아 주지 않는다 — 실패는 실패로 기록하고, 그래도 (b)는 끝까지 확인한다.
  //    화면 결함을 테스트에서 우회해 통과시키면, 고쳐야 할 버그가 영영 안 보인다.
  const wl = new WorkloadPage(page);
  await wl.gotoMci();
  await wl.expectMciListLoaded();
  await wl.selectMci(infraName);
  await wl.openDeleteModal();
  await wl.confirmDelete(infraName, 'force');

  const modalClosed = await wl.deleteModalClosed();

  // (b) 자원이 실제로 지워졌는지는 목록을 다시 방문해 확인한다. 이게 요금 보호의 실질이다.
  await wl.expectInfraGone(infraName);
  console.log(`[teardown] 타깃 인프라 삭제 확인: ${infraName}`);

  // (a) 화면 결함은 여기서 드러낸다.
  expect(
    modalClosed,
    '삭제는 됐지만 삭제 모달이 스스로 닫히지 않았다 — 화면 결함이다.\n' +
      'MciDeleteModal.handleConfirm 이 삭제 요청 하나를 동기로 붙들고 기다리는데, 인프라 삭제는 수 분이 걸린다.\n' +
      '실패하면 모달을 닫지도 않아 사용자가 갇힌다. (cb-tumblebug 의 force delete 는 간헐적으로 실패한다)',
  ).toBeTruthy();

  // 2) 소스그룹 삭제 — 소스 모델까지 만들었으면 커넥션 서버는 지운다(시나리오 7단계)
  const groupName = uniqueName(sourceServer.name);
  try {
    const source = new SourceServicesPage(page);
    await source.goto();
    await source.selectGroup(groupName);
    await source.deleteSelectedGroup();
    console.log(`[teardown] 소스그룹 삭제: ${groupName}`);
  } catch (e) {
    console.warn(
      `[teardown] ★ 소스그룹(${groupName}) 삭제 실패 — 수동 확인 필요:`,
      (e as Error).message,
    );
  }
});
