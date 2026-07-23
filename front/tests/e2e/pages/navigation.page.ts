import { Page, expect } from '@playwright/test';

/**
 * NavigationPage — the "where to go / what to verify" layer for the routing smoke test of the
 * five top menu categories.
 *
 * Each category's parent route renders only `<router-view/>`, so we navigate to the *first
 * landing child route* that actually shows a screen (per the router definition). If routing
 * changes, only this file needs editing.
 *
 * Categories (parent → landing child):
 *  - Source Computing     → /main/source-computing/source-services
 *  - Models               → /main/models/source-models
 *  - Workflow Management   → /main/workflow-management/workflows
 *  - Workload Operations   → /main/workload-operations/workloads
 *  - Cloud Resources       → /main/cloud-resources/cloud-credentials
 */
interface NavTarget {
  /** Landing URL to navigate to */
  path: string;
  /** URL regex for judging a successful load (based on the parent route) */
  urlPattern: RegExp;
}

const CATEGORY_ALIASES: Record<string, NavTarget> = {};

function register(target: NavTarget, ...names: string[]) {
  for (const n of names) CATEGORY_ALIASES[n.toLowerCase()] = target;
}

register(
  {
    path: '/main/source-computing/source-services',
    urlPattern: /\/main\/source-computing/,
  },
  'Source Computing',
  '소스 컴퓨팅',
  'sourcecomputing',
  'source',
);
register(
  { path: '/main/models/source-models', urlPattern: /\/main\/models/ },
  'Models',
  '모델',
  'models',
  '소스 모델',
);
register(
  {
    path: '/main/workflow-management/workflows',
    urlPattern: /\/main\/workflow-management/,
  },
  'Workflow Management',
  '워크플로우 관리',
  'workflowmanagement',
  'workflow',
  '워크플로우',
);
register(
  {
    path: '/main/workload-operations/workloads',
    urlPattern: /\/main\/workload-operations/,
  },
  'Workload Operations',
  '워크로드 운영',
  'workloadoperations',
  'workload',
  '워크로드',
);
register(
  {
    path: '/main/cloud-resources/cloud-credentials',
    urlPattern: /\/main\/cloud-resources/,
  },
  'Cloud Resources',
  '클라우드 리소스',
  'cloudresources',
  'cloud',
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

  /** Navigate to the category's landing screen */
  async gotoCategory(name: string): Promise<void> {
    await this.page.goto(this.resolve(name).path);
  }

  /** Verify the category screen loaded correctly (URL entered + not NotFound) */
  async expectCategoryLoaded(name: string): Promise<void> {
    const target = this.resolve(name);
    await expect(this.page).toHaveURL(target.urlPattern, { timeout: 15_000 });
    // Verify we weren't bounced to the 404 route — look at the NotFound component itself.
    //
    // We used to scan the whole body text for /not found|404/, but UUIDs printed in lists
    // matched that pattern (e.g. the "404" in 1e7ff6d3-ea66-4044-..., or in a8904046355e).
    // That was a false positive that failed just because data was present even though the
    // screen was fine, so we narrow it to the NotFound screen, the only valid basis for
    // judging a routing failure.
    await expect(this.page.getByTestId('not-found-page')).toHaveCount(0);
  }
}
