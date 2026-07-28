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
        width: 22px;
        height: 22px;
        margin: -3px 0 0 -3px;
        pointer-events: none;
        transition: transform 60ms linear;
        will-change: transform;
      }
      #e2e-cursor svg { display: block; filter: drop-shadow(0 1px 2px rgba(0,0,0,.45)); }
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
      '<svg viewBox="0 0 24 24" width="22" height="22">' +
      '<path d="M5 2.5 19 12l-6.2 1.3L10.2 20 5 2.5Z" fill="#111827" stroke="#ffffff" stroke-width="1.4" stroke-linejoin="round"/>' +
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
