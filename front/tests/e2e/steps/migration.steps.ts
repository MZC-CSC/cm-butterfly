import { createBdd } from 'playwright-bdd';
import { test } from '../support/fixtures';
import { WorkloadPage } from '../pages/workload.page';
import { SourceServicesPage } from '../pages/sourceServices.page';
import { sourceServer, workload } from '../fixtures/test-data';

const { Given } = createBdd(test);

/**
 * 마이그레이션 시나리오 전용 스텝 (도메인 스텝을 조립하는 최상위 흐름 + teardown).
 * 대부분의 단계는 각 도메인 스텝(auth/source/models/workflow/workload)을 그대로 재사용하고,
 * 여기에는 시나리오 종료 정리만 둔다.
 */

/**
 * "그리고 생성된 리소스를 정리한다" — best-effort teardown.
 * ★ 요금 보호의 핵심(인스턴스 중지)은 별도 스텝(생성된 인스턴스를 중지한다)이 이미 처리.
 *   여기서는 타깃 인프라·소스그룹 레코드를 정리한다. 각 삭제는 실패해도 테스트를 깨지 않도록 무시(경고 로그).
 */
Given('생성된 리소스를 정리한다', async ({ page }) => {
  // 1) 타깃 인프라(MCI) 삭제 — 워크로드 화면 경유
  const workloadPage = new WorkloadPage(page) as unknown as Record<string, (...a: unknown[]) => Promise<void>>;
  try {
    await workloadPage.goto?.();
    await workloadPage.selectInfra?.(workload.infraName);
    await workloadPage.openDeleteModal?.();
    await workloadPage.confirmDelete?.();
    console.log(`[teardown] 타깃 인프라 정리 시도: ${workload.infraName}`);
  } catch (e) {
    console.warn('[teardown] 인프라 삭제 생략(무시):', (e as Error).message);
  }

  // 2) 소스 서비스(소스그룹) 삭제 — 소스 서비스 화면 경유
  const sourcePage = new SourceServicesPage(page) as unknown as Record<string, (...a: unknown[]) => Promise<void>>;
  try {
    await sourcePage.goto?.();
    await sourcePage.selectSourceGroup?.(sourceServer.name);
    await sourcePage.deleteSelectedGroup?.();
    console.log(`[teardown] 소스그룹 정리 시도: ${sourceServer.name}`);
  } catch (e) {
    console.warn('[teardown] 소스그룹 삭제 생략(무시):', (e as Error).message);
  }
});
