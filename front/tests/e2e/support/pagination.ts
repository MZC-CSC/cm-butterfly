import { Locator, Page, expect } from '@playwright/test';

/**
 * 목록 테이블 페이지네이션(mirinae PToolboxTable) 헬퍼.
 *
 * ★ 왜 필요한가 — 방금 만든 데이터가 1페이지에 있으리라는 보장이 없다.
 *   목록은 15행씩 끊기고(text-pagination "1 / 2"), 상단 검색창은 query 태그 방식이라 이 테이블들에는
 *   필터가 붙어 있지 않다. 그래서 데이터가 쌓이면 새로 만든 행이 2페이지 뒤로 밀리고, 1페이지만 보던
 *   테스트는 "행이 없다"며 죽는다. 실제로 소스그룹 생성 테스트가 그렇게 실패했다.
 *
 *   그러니 *페이지를 넘겨 가며* 찾고, **몇 페이지에서 찾았는지도 돌려준다**. 페이지네이션 자체가
 *   동작하는지(넘어가는지·마지막 페이지에서 멈추는지)도 이 과정에서 함께 검증된다.
 */
export class TablePagination {
  constructor(
    private readonly page: Page,
    /** 대상 테이블의 루트(테이블마다 페이지네이션이 따로 있어 반드시 스코프를 준다) */
    private readonly root: Locator,
  ) {}

  /** 페이지네이션 nav (없으면 단일 페이지) */
  private get nav(): Locator {
    return this.root.locator('nav.text-pagination').first();
  }

  /** "1 / 2" → { current: 1, total: 2 }. nav가 없으면 1/1로 본다. */
  async status(): Promise<{ current: number; total: number }> {
    if ((await this.nav.count()) === 0) return { current: 1, total: 1 };
    const text = (await this.nav.innerText().catch(() => '')) || '';
    const m = text.match(/(\d+)\s*\/\s*(\d+)/);
    if (!m) return { current: 1, total: 1 };
    return { current: Number(m[1]), total: Number(m[2]) };
  }

  /** 다음 페이지로. 더 갈 곳이 없으면 false. */
  async next(): Promise<boolean> {
    const { current, total } = await this.status();
    if (current >= total) return false;
    // text-pagination의 오른쪽 화살표(마지막 버튼)
    await this.nav.locator('button').last().click();
    await expect
      .poll(async () => (await this.status()).current, { timeout: 10_000 })
      .toBe(current + 1);
    return true;
  }

  /**
   * 목록이 실제로 채워질 때까지 기다린다.
   *
   * 화면에 막 들어온 직후에는 테이블 껍데기만 있고 행이 아직 없다. 그 상태에서 바로 페이지를 넘기면
   * "1페이지에도 없고 2페이지에도 없다"며 *데이터가 오기도 전에* 없다고 단정해 버린다.
   * (실제로 소스 모델이 목록에 멀쩡히 있는데도 못 찾는 경우가 이 레이스였다.)
   */
  private async waitForRows(): Promise<void> {
    await expect
      .poll(async () => this.root.locator('tbody tr').count(), {
        timeout: 20_000,
        message: '목록에 행이 하나도 렌더되지 않았다',
      })
      .toBeGreaterThan(0);
  }

  /**
   * 행을 찾을 때까지 페이지를 넘긴다.
   * @returns 찾은 페이지 번호(1-base). 끝까지 없으면 null.
   */
  async findRow(row: Locator): Promise<number | null> {
    await this.waitForRows();
    for (;;) {
      // 이 페이지에 있나? (없으면 짧게 끊고 다음 페이지로 — 페이지마다 15초씩 기다리면 한없이 느려진다)
      if (await row.first().isVisible({ timeout: 2_000 }).catch(() => false)) {
        return (await this.status()).current;
      }
      if (!(await this.next())) return null;
    }
  }

  /**
   * 행이 *어느 페이지엔가* 있어야 한다. 찾으면 그 페이지 번호를 로그로 남긴다.
   * 못 찾으면 전체 페이지 수와 함께 실패시킨다(1페이지만 보고 없다고 단정하지 않는다).
   */
  async expectRowSomewhere(row: Locator, label: string): Promise<number> {
    const found = await this.findRow(row);
    const { total } = await this.status();
    expect(
      found,
      `"${label}" 이(가) 목록 어디에도 없다 (전체 ${total}페이지를 모두 확인했다)`,
    ).not.toBeNull();
    console.log(`[pagination] "${label}" → ${found}/${total} 페이지에서 확인`);
    return found as number;
  }
}
