import { Page } from '@playwright/test';

/**
 * A cursor you can see in the recording.
 *
 * The browser's own pointer is drawn by the operating system, not by the page, so a
 * recorded run shows things being clicked with nothing visibly doing the clicking -
 * which is exactly how the earlier demo videos came out. Playwright's synthetic mouse
 * does dispatch real pointer events, so a small element that follows those events puts
 * the pointer back on screen.
 *
 * Injected as an init script so it survives navigation, and again on demand for a page
 * that is already open.
 */
const CURSOR_SCRIPT = `
(() => {
  if (window.__e2eCursorInstalled) return;
  window.__e2eCursorInstalled = true;

  const draw = () => {
    if (!document.body || document.getElementById('e2e-cursor')) return;

    const style = document.createElement('style');
    style.textContent = \`
      #e2e-cursor {
        position: fixed;
        left: 0;
        top: 0;
        z-index: 2147483647;
        width: 17px;
        height: 27px;
        margin: -1px 0 0 -1px;
        pointer-events: none;
        transition: transform 60ms linear;
        will-change: transform;
      }
      #e2e-cursor svg { display: block; }
      #e2e-cursor.is-down svg { transform: scale(.82); }
      #e2e-cursor-ring {
        position: fixed;
        left: 0;
        top: 0;
        z-index: 2147483646;
        width: 34px;
        height: 34px;
        margin: -17px 0 0 -17px;
        border: 2px solid rgba(37, 99, 235, .9);
        border-radius: 50%;
        opacity: 0;
        pointer-events: none;
      }
      #e2e-cursor-ring.is-firing { animation: e2e-ring 450ms ease-out; }
      @keyframes e2e-ring {
        0%   { opacity: .9; transform: scale(.35); }
        100% { opacity: 0;  transform: scale(1.15); }
      }
    \`;
    document.head.appendChild(style);

    const cursor = document.createElement('div');
    cursor.id = 'e2e-cursor';
    cursor.innerHTML =
      // ★ 운영체제 기본 화살표와 같은 모양으로 둔다.
      //
      //   보는 사람은 이 커서를 자기 것과 견준다. 모양이 다르면 "저건 뭐지" 라는 질문이 먼저 나오고,
      //   나중에 화면 전체를 찍는 촬영(운영체제 커서가 그대로 찍힌다)과 이어 붙일 때도 그 장면만
      //   따로 논다. 흔한 left_ptr 윤곽 그대로 — 검은 채움에 흰 테두리. (2026-07-31)
      '<svg viewBox="0 0 12 19" width="17" height="27">' +
      '<path d="M1 1 L1 15.2 L4.6 11.9 L7 17.6 L9.4 16.6 L7 11 L11.2 11 Z" ' +
      'fill="#000000" stroke="#ffffff" stroke-width="1.1" stroke-linejoin="round"/>' +
      '</svg>';

    const ring = document.createElement('div');
    ring.id = 'e2e-cursor-ring';

    document.body.appendChild(cursor);
    document.body.appendChild(ring);

    const place = (x, y) => {
      cursor.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      ring.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    };
    place(window.innerWidth / 2, window.innerHeight / 2);

    document.addEventListener('mousemove', e => place(e.clientX, e.clientY), true);
    document.addEventListener('mousedown', () => {
      cursor.classList.add('is-down');
      ring.classList.remove('is-firing');
      // reflow, so the same animation can play again on the next click
      void ring.offsetWidth;
      ring.classList.add('is-firing');
    }, true);
    document.addEventListener('mouseup', () => cursor.classList.remove('is-down'), true);
  };

  if (document.body) draw();
  else document.addEventListener('DOMContentLoaded', draw);
})();
`;

/** Install for this page and everything it navigates to afterwards. */
export async function installCursor(page: Page): Promise<void> {
  await page.addInitScript(CURSOR_SCRIPT);
  await page.evaluate(CURSOR_SCRIPT).catch(() => {});
}

/**
 * Confirm the pointer really is on the page.
 *
 * Worth checking, because when it is missing nothing fails - the run passes, the take looks fine
 * until someone watches it, and the screen appears to click itself. A whole set of takes was
 * recorded that way before anyone noticed, and every one of them had to be shot again.
 *
 * Called once the first screen is up, since there is nothing to draw into before that.
 */
export async function expectCursorPresent(page: Page): Promise<void> {
  const drawn = await page
    .locator('#e2e-cursor')
    .count()
    .catch(() => 0);
  if (drawn === 0) {
    throw new Error(
      '녹화용 커서가 화면에 없다. 이대로 찍으면 화면이 저절로 눌리는 것처럼 보인다 — ' +
        'support/cursor.ts 의 installCursor 가 이 페이지에 걸렸는지 확인한다.',
    );
  }
}
