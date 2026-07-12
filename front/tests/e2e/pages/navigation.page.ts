import { Page, expect } from '@playwright/test';

/**
 * NavigationPage — 상단 5개 메뉴 카테고리 라우팅 스모크의 "어디로/무엇을 확인" 계층.
 *
 * 각 카테고리 부모 경로는 `<router-view/>`만 렌더하므로, 실제로 화면이 뜨는
 * *첫 랜딩 자식 경로*로 이동한다(router 정의 기준). 라우팅이 바뀌면 이 파일만 수정.
 *
 * 카테고리(부모 → 랜딩 자식):
 *  - Source Computing     → /main/source-computing/source-services
 *  - Models               → /main/models/source-models
 *  - Workflow Management   → /main/workflow-management/workflows
 *  - Workload Operations   → /main/workload-operations/workloads
 *  - Cloud Resources       → /main/cloud-resources/cloud-credentials
 */
interface NavTarget {
  /** 이동할 랜딩 URL */
  path: string;
  /** 로드 성공 판정용 URL 정규식(부모 경로 기준) */
  urlPattern: RegExp;
}

const CATEGORY_ALIASES: Record<string, NavTarget> = {};

function register(target: NavTarget, ...names: string[]) {
  for (const n of names) CATEGORY_ALIASES[n.toLowerCase()] = target;
}

register(
  { path: '/main/source-computing/source-services', urlPattern: /\/main\/source-computing/ },
  'Source Computing', '소스 컴퓨팅', 'sourcecomputing', 'source',
);
register(
  { path: '/main/models/source-models', urlPattern: /\/main\/models/ },
  'Models', '모델', 'models', '소스 모델',
);
register(
  { path: '/main/workflow-management/workflows', urlPattern: /\/main\/workflow-management/ },
  'Workflow Management', '워크플로우 관리', 'workflowmanagement', 'workflow', '워크플로우',
);
register(
  { path: '/main/workload-operations/workloads', urlPattern: /\/main\/workload-operations/ },
  'Workload Operations', '워크로드 운영', 'workloadoperations', 'workload', '워크로드',
);
register(
  { path: '/main/cloud-resources/cloud-credentials', urlPattern: /\/main\/cloud-resources/ },
  'Cloud Resources', '클라우드 리소스', 'cloudresources', 'cloud',
);

export class NavigationPage {
  constructor(private readonly page: Page) {}

  private resolve(name: string): NavTarget {
    const t = CATEGORY_ALIASES[name?.trim().toLowerCase()];
    if (!t) {
      throw new Error(
        `알 수 없는 메뉴 카테고리: "${name}". 등록된 카테고리: ${Object.keys(CATEGORY_ALIASES).join(', ')}`,
      );
    }
    return t;
  }

  /** 카테고리 랜딩 화면으로 이동 */
  async gotoCategory(name: string): Promise<void> {
    await this.page.goto(this.resolve(name).path);
  }

  /** 해당 카테고리 화면이 정상 로드됐는지(URL 진입 + NotFound 아님) 확인 */
  async expectCategoryLoaded(name: string): Promise<void> {
    const target = this.resolve(name);
    await expect(this.page).toHaveURL(target.urlPattern, { timeout: 15_000 });
    // 404 라우트로 튕기지 않았는지 확인 — NotFound 컴포넌트 자체를 본다.
    //
    // 예전엔 본문 전체 텍스트를 /not found|404/로 훑었는데, 목록에 찍힌 UUID가 그 패턴에 걸렸다
    // (예: 1e7ff6d3-ea66-4044-... 의 "404", a8904046355e 의 "404"). 화면은 멀쩡한데 데이터가 있다는
    // 이유만으로 실패하던 오탐이라, 라우팅 실패를 판정하는 유일한 근거인 NotFound 화면으로 좁힌다.
    await expect(this.page.getByTestId('not-found-page')).toHaveCount(0);
  }
}
