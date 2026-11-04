import { Locator, Page, expect } from '@playwright/test';
import { humanClick } from '../support/humanize';

/**
 * 리전 선택 (RegionSelect) — cb-tumblebug 리전 목록에서만 고른다. 타이핑은 값을 넣지
 * 않고 목록을 좁힐 뿐이다.
 *
 * 미리내 함정(DESIGN-MIRINAE)
 *  - 검색란은 펼친 메뉴 안에 있다. 컴포넌트가 열릴 때 검색란에 포커스를 주므로
 *    클릭하지 않고 바로 타이핑한다 — 포커스가 안 가면 그 자체가 결함이다.
 *  - 항목은 role 이 없어 `.p-context-menu-item` 으로 찾는다.
 *  - 고른 값은 표시 문구가 아니라 루트의 `data-value` 로 판정한다.
 */
export class RegionSelectControl {
  constructor(
    private readonly page: Page,
    private readonly testid: string,
  ) {}

  private get root(): Locator {
    return this.page.getByTestId(this.testid);
  }

  private get items(): Locator {
    return this.root.locator('.p-context-menu-item');
  }

  private async openAndType(text: string): Promise<void> {
    await expect(this.root.locator('.dropdown-button')).not.toHaveClass(
      /disabled/,
      { timeout: 20_000 },
    );
    await humanClick(this.root.locator('.dropdown-button'));
    await expect(this.root.locator('.p-search input')).toBeFocused({
      timeout: 5_000,
    });
    await this.page.keyboard.type(text, { delay: 60 });
  }

  /** 타이핑으로 좁힌 뒤 그 리전을 고른다. */
  async pick(region: string): Promise<void> {
    await this.openAndType(region);
    const item = this.items
      .filter({ hasText: new RegExp(`^\\s*${region}(\\s|$)`) })
      .first();
    await humanClick(item);
    await expect(this.root).toHaveAttribute('data-value', region);
  }

  /** 타이핑했을 때 남는 항목의 리전 ID 들. 메뉴는 닫고 끝낸다. */
  async matchesFor(text: string): Promise<string[]> {
    await this.openAndType(text);
    // 검색은 디바운스 뒤에 걸린다. 남은 항목이 전부 그 글자를 담을 때까지 기다린다.
    const needle = text.toLowerCase();
    await expect
      .poll(async () =>
        (await this.items.allInnerTexts()).every(t =>
          t.toLowerCase().includes(needle),
        ),
      )
      .toBe(true);
    const texts = await this.items.allInnerTexts();
    // Escape 는 감싼 모달까지 닫을 수 있어 버튼을 다시 눌러 닫는다.
    await humanClick(this.root.locator('.dropdown-button'));
    return texts.map(t => t.trim().split(/\s/)[0]);
  }

  async value(): Promise<string> {
    return (await this.root.getAttribute('data-value')) ?? '';
  }
}
