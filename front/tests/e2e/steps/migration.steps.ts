import { createBdd } from 'playwright-bdd';
import { test } from '../support/fixtures';
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
  try {
    const wl = new WorkloadPage(page);
    await wl.gotoMci();
    await wl.expectMciListLoaded();
    await wl.selectMci(infraName);
    await wl.openDeleteModal();
    await wl.confirmDelete(infraName, 'force');
    console.log(`[teardown] 타깃 인프라 삭제: ${infraName}`);
  } catch (e) {
    console.warn(
      `[teardown] ★ 타깃 인프라(${infraName}) 삭제 실패 — 수동 확인 필요:`,
      (e as Error).message,
    );
  }

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
