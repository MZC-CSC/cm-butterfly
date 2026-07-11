import type { Page, Route, Request } from '@playwright/test';

/**
 * operationId 기반 API mock/계약 검증 레이어.
 *
 * 설계 의도(2026-07 현행화 기준):
 *  - cm-butterfly front는 REST를 직접 부르지 않고 `POST /api/{operationId}` (body: {pathParams,queryParams,request})
 *    형태로만 호출하고, 백엔드(api)가 api.yaml로 실제 서비스에 프록시한다(DESIGN-ARCH §3).
 *  - 따라서 e2e 유닛(@unit)은 브라우저 단에서 `**\/api/**` 를 가로채 (1) 연계 프레임워크 없이도 화면 흐름을
 *    완결시키고(hermetic), (2) 이번 릴리스가 바꾼 *계약*(opId·요청 키)을 기록해 검증한다.
 *  - @scenario(실 통합환경)에서는 mock을 설치하지 않아 실제 백엔드로 나간다.
 *
 * operationId는 슬래시를 포함할 수 있다(예: `cm-honeybee/register-source-group`). URL의 `/api/` 뒤 전체를
 * operationId로 본다(쿼리스트링 제외).
 */

export type MockContext = {
  /** 요청 body(파싱). {pathParams, queryParams, request} 래퍼 형태가 일반적 */
  body: any;
  /** 원본 요청 */
  request: Request;
  /** 매칭된 operationId */
  operationId: string;
};

export type MockHandler = (ctx: MockContext) => unknown;

/** 기록된 outbound 요청(계약 검증용) */
export type RecordedCall = { operationId: string; url: string; body: any };

export class ApiMock {
  private handlers = new Map<string, MockHandler>();
  readonly calls: RecordedCall[] = [];

  /** operationId → 응답 핸들러 등록. 반환값이 그대로 JSON body가 된다(자동 래핑 없음). */
  on(operationId: string, handler: MockHandler): this {
    this.handlers.set(operationId, handler);
    return this;
  }

  /** 여러 handler 일괄 등록 */
  use(map: Record<string, MockHandler>): this {
    for (const [op, h] of Object.entries(map)) this.on(op, h);
    return this;
  }

  /** page에 라우트 설치. 매칭되면 fulfill, 아니면 실제 백엔드로 통과(continue).
   *  ★ 개발(vite) 모드는 소스 모듈을 `/src/.../api/index.ts`처럼 서빙하므로 경로가 `/api/`로
   *    *시작*하는 실제 API 호출만 가로챈다(중간에 /api/ 를 포함하는 모듈 요청 제외). */
  async install(page: Page): Promise<void> {
    const isApiCall = (url: string) => {
      try {
        return new URL(url).pathname.startsWith('/api/');
      } catch {
        return false;
      }
    };
    await page.route(isApiCall, async (route: Route) => {
      const req = route.request();
      const operationId = extractOperationId(req.url());
      const handler = this.handlers.get(operationId);
      let body: any = undefined;
      try {
        body = req.postDataJSON();
      } catch {
        body = req.postData();
      }
      this.calls.push({ operationId, url: req.url(), body });
      if (!handler) {
        // 매칭 안 된 opId는 실제 백엔드로 통과(로그인·메뉴 등 로컬 api가 처리)
        return route.fallback();
      }
      const result = handler({ body, request: req, operationId });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(result ?? {}),
      });
    });
  }

  /** 특정 operationId로 나간 마지막 요청 반환(계약 검증용) */
  lastCall(operationId: string): RecordedCall | undefined {
    for (let i = this.calls.length - 1; i >= 0; i--) {
      if (this.calls[i].operationId === operationId) return this.calls[i];
    }
    return undefined;
  }
}

/** URL에서 operationId 추출: `.../api/<operationId>?...` → `<operationId>` (슬래시 포함 가능) */
export function extractOperationId(url: string): string {
  const u = new URL(url);
  const idx = u.pathname.indexOf('/api/');
  if (idx === -1) return u.pathname.replace(/^\//, '');
  return u.pathname.slice(idx + '/api/'.length);
}

/** cm-butterfly 표준 성공 응답 래퍼 */
export function ok(responseData: unknown, code = 200) {
  return { status: { code, message: 'success' }, responseData };
}
