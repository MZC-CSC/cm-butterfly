import type { Page, Route, Request } from '@playwright/test';

/**
 * operationId-based API mock / contract verification layer.
 *
 * Design intent (as of the 2026-07 update):
 *  - cm-butterfly front never calls REST directly; it only calls `POST /api/{operationId}` (body: {pathParams,queryParams,request}),
 *    and the backend (api) proxies to the real service via api.yaml (DESIGN-ARCH §3).
 *  - So e2e units (@unit) intercept `**\/api/**` in the browser to (1) complete the screen flow even without
 *    the linked frameworks (hermetic), and (2) record and verify the *contract* (opId, request keys) this release changed.
 *  - In @scenario (real integration environment), no mock is installed, so requests go to the real backend.
 *
 * An operationId can contain slashes (e.g. `cm-honeybee/register-source-group`). Everything after `/api/` in the URL
 * is treated as the operationId (excluding the query string).
 */

export type MockContext = {
  /** parsed request body. Usually the {pathParams, queryParams, request} wrapper form */
  body: any;
  /** the original request */
  request: Request;
  /** the matched operationId */
  operationId: string;
};

/**
 * Response handler. **It may return a Promise** — needed to mimic a slow API.
 * (e.g. deletion actually holds the response until completion, so responding immediately makes the
 *  screen jump straight to done without passing through the "in progress" state.)
 */
export type MockHandler = (ctx: MockContext) => unknown | Promise<unknown>;

/** a recorded outbound request (for contract verification) */
export type RecordedCall = { operationId: string; url: string; body: any };

export class ApiMock {
  private handlers = new Map<string, MockHandler>();
  readonly calls: RecordedCall[] = [];

  /** register operationId → response handler. The return value becomes the JSON body as-is (no auto wrapping). */
  on(operationId: string, handler: MockHandler): this {
    this.handlers.set(operationId, handler);
    return this;
  }

  /** register multiple handlers at once */
  use(map: Record<string, MockHandler>): this {
    for (const [op, h] of Object.entries(map)) this.on(op, h);
    return this;
  }

  /** install the route on the page. On a match, fulfill; otherwise pass through to the real backend (continue).
   *  ★ In dev (vite) mode, source modules are served like `/src/.../api/index.ts`, so only intercept real API calls
   *    whose path *starts* with `/api/` (excluding module requests that merely contain /api/ in the middle). */
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
        // an unmatched opId passes through to the real backend (login, menu, etc. handled by the local api)
        return route.fallback();
      }
      const result = await handler({ body, request: req, operationId });

      // A handler may ask for a non-200 status (see `fail`). Everything else answers 200, which
      // is what the console's own responses look like — errors carried inside a 200 envelope.
      // Some paths, though, hand the underlying status straight through: the backend proxy
      // passes cm-beetle's status as-is when cm-beetle answered, and substitutes 500 when it
      // could not be reached. Code that tells those apart cannot be exercised without this.
      const httpStatus =
        (result as { __httpStatus?: number })?.__httpStatus ?? 200;
      await route.fulfill({
        status: httpStatus,
        contentType: 'application/json',
        body: JSON.stringify(result ?? {}),
      });
    });
  }

  /** return the last request sent for a specific operationId (for contract verification) */
  lastCall(operationId: string): RecordedCall | undefined {
    for (let i = this.calls.length - 1; i >= 0; i--) {
      if (this.calls[i].operationId === operationId) return this.calls[i];
    }
    return undefined;
  }
}

/** extract the operationId from a URL: `.../api/<operationId>?...` → `<operationId>` (slashes allowed) */
export function extractOperationId(url: string): string {
  const u = new URL(url);
  const idx = u.pathname.indexOf('/api/');
  if (idx === -1) return u.pathname.replace(/^\//, '');
  return u.pathname.slice(idx + '/api/'.length);
}

/** cm-butterfly standard success response wrapper */
export function ok(responseData: unknown, code = 200) {
  return { status: { code, message: 'success' }, responseData };
}

/**
 * A response that arrives with a real HTTP error status, not an error inside a 200.
 *
 * Needed where the code branches on the status itself. Delete tracking is the case: 404 means
 * cm-beetle answered and does not know that request id, while 500 means it could not be reached
 * — one ends the tracking, the other holds off on a verdict. Wrapping both in a 200 would make
 * the two indistinguishable and the branch untestable.
 */
export function fail(code: number, message: string) {
  return {
    __httpStatus: code,
    status: { code, message },
    responseData: message,
  };
}
