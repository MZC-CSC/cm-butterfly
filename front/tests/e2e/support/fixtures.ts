// Workers load this file for every generated spec — pull `e2e.config` in here too.
import './loadConfig';

import { test as base } from 'playwright-bdd';
import { ApiMock } from './apiMock';
import { registerHoneybeeMocks } from './mocks/honeybee';
import { registerMciMocks } from './mocks/mci';
import { isDemoPace } from './humanize';
import { installCursor, expectCursorPresent } from './cursor';

/**
 * Common test fixtures.
 * - Extend playwright-bdd's test to inject data/helpers used across the scenario.
 * - Page Objects are created per step from `page` (no central registration → independent per-domain maintenance).
 *
 * ★ Three test tiers:
 *   - @mock  : intercept `**\/api/**` and complete the screen flow without the linked frameworks (hermetic). Front-only regression, fast CI.
 *              It cannot detect contract changes in the linked frameworks.
 *   - @unit  : no mock installed → calls the real lineup. Detects *contract changes in the linked frameworks* per screen (the core of this release).
 *   - @scenario: end-to-end with the real lineup + cloud.
 *   So mocks are installed only for the @mock tag, and @unit/@scenario go to the real backend.
 */
let currentMock: ApiMock | null = null;

/** Record of the requests the console sent to the backend during the scenario (for contract regression checks) */
export interface SentRequest {
  method: string;
  url: string;
  body: string;
}
let sentRequests: SentRequest[] = [];

export const test = base.extend<{ mockApi: ApiMock | null; screens: boolean }>({
  mockApi: [
    async ({ page }, use, testInfo) => {
      let mock: ApiMock | null = null;
      if (testInfo.tags.includes('@mock')) {
        mock = new ApiMock();
        registerHoneybeeMocks(mock);
        registerMciMocks(mock);
        await mock.install(page);
      }
      currentMock = mock;
      await use(mock);
      currentMock = null;
    },
    { auto: true },
  ],

  /**
   * Screen capture + request recording fixture.
   *
   * - Collect the requests the console sends to the proxy (`/api/**`). Used in steps for
   *   *contract* checks like "does not send an old-schema payload". Even if the screen
   *   looks fine, it catches outgoing requests that use the old schema.
   * - When the scenario ends, capture the last screen and attach it to the report. On the
   *   web, what is shown can break even when the contract matches, so we keep the run's
   *   result screen as evidence for comparison/analysis.
   */
  screens: [
    async ({ page }, use, testInfo) => {
      // A pointer that can actually be seen.
      //
      // The browser's own pointer is drawn by the operating system, outside the page, so a
      // recording never contains it - the screen appears to click itself. This draws one inside
      // the page and follows the same mouse moves.
      //
      // It used to be installed only by the takes under `demos/`, which is where it was first
      // needed. The integration segments never got it, and a whole set of takes came out with no
      // pointer at all before anyone noticed.
      if (isDemoPace()) {
        await installCursor(page);
      }

      sentRequests = [];
      page.on('request', req => {
        if (req.url().includes('/api/') && req.method() !== 'GET') {
          sentRequests.push({
            method: req.method(),
            url: req.url(),
            body: req.postData() ?? '',
          });
        }
      });

      const { captureScreen } = await import('./screenshot');

      // ★ Starting screen — record "what was visible before the test".
      //   Keeping it regardless of pass/fail lets a person compare before/after and judge
      //   whether it *really* worked. (The first screen is usually about:blank, so ignore failures.)
      try {
        await captureScreen(page, testInfo, '01-before');
      } catch {
        // If the page isn't open yet, there's nothing to capture — ignore.
      }

      await use(true);

      // The pointer has to have been there. Nothing fails when it is missing - the run passes and
      // the take only looks wrong once someone watches it - so it is checked at the end, when
      // there has certainly been a screen to draw into.
      if (isDemoPace()) await expectCursorPresent(page);

      // ★ Ending screen — "what state the screen was in when the test ended".
      try {
        await captureScreen(page, testInfo, '99-after');
      } catch {
        // Don't let a capture failure break the test (preserving evidence is a secondary goal).
      }
      sentRequests = [];
    },
    { auto: true },
  ],
});

/** The requests the console sent to the backend in this scenario */
export function getSentRequests(): SentRequest[] {
  return sentRequests;
}

export const expect = test.expect;

/** The mock installed for the current scenario (for contract checks). null if not @unit. */
export function getMock(): ApiMock | null {
  return currentMock;
}
