import { createBdd } from 'playwright-bdd';
import { test, expect } from '../support/fixtures';
import { humanClick } from '../support/humanize';

const { When, Then } = createBdd(test);

/**
 * 진행 안내 — 완료 조건 표시와 도움말 튜토리얼 펼치기.
 *
 * 단계 *번호* 는 그 환경에 무엇이 들어 있느냐에 따라 달라지므로 단언하지 않는다.
 * 여기서 확인하는 것은 **어느 단계에 있든 완료 조건과 현재 충족 상태가 함께 보이는가**다 —
 * 그 둘이 없어서 "소스그룹만 등록했는데 왜 안 넘어가지"가 안내 결함처럼 읽혔다.
 *
 * 식별자로만 잡는다. 문구로 잡으면 안내 문장을 다듬을 때마다 깨지고,
 * 폴백을 두면 식별자가 사라져도 통과해 버린다(tests/e2e/docs/08-주의사항 §C-1·C-2).
 */

Then('현재 단계에 완료 조건이 보인다', async ({ page }) => {
  const completion = page.locator('[data-testid$="-completion"]').first();
  await expect(completion).toBeVisible({ timeout: 15_000 });
  await expect(completion).not.toBeEmpty();
});

Then('현재 단계에 지금까지 충족한 내용이 보인다', async ({ page }) => {
  const progress = page.locator('[data-testid$="-progress"]').first();
  await expect(progress).toBeVisible({ timeout: 15_000 });
  await expect(progress).toContainText('So far');
});

Then('도움말 상단에 완료 조건이 보인다', async ({ page }) => {
  const completion = page.getByTestId('help-guided-completion');
  await expect(completion).toBeVisible({ timeout: 15_000 });
  await expect(completion).not.toBeEmpty();
});

Then('도움말 상단에 지금까지 충족한 내용이 보인다', async ({ page }) => {
  await expect(page.getByTestId('help-guided-progress')).toContainText('So far', {
    timeout: 15_000,
  });
});

/*
  펼침 여부는 *스텝 목록이 있는가*로 본다.

  토글 버튼의 aria-expanded 만 보면 속성만 바뀌고 본문은 그대로인 경우를 잡지 못한다.
  읽으려는 것은 절차이므로, 절차가 실제로 화면에 있는지로 판정한다.
*/
Then(
  '{string} 도움말 절차 {int} 은 접혀 있다',
  async ({ page }, groupId: string, index: number) => {
    await expect(
      page.getByTestId(`help-section-toggle-${groupId}-${index}`),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByTestId(`help-section-steps-${groupId}-${index}`),
    ).toHaveCount(0);
  },
);

When(
  '{string} 도움말 절차 {int} 의 제목을 누르면',
  async ({ page }, groupId: string, index: number) => {
    await humanClick(page.getByTestId(`help-section-toggle-${groupId}-${index}`));
  },
);

Then(
  '{string} 도움말 절차 {int} 이 펼쳐진다',
  async ({ page }, groupId: string, index: number) => {
    const steps = page.getByTestId(`help-section-steps-${groupId}-${index}`);
    await expect(steps).toBeVisible({ timeout: 10_000 });
    expect(await steps.locator('li').count()).toBeGreaterThan(0);
  },
);

/** 버튼 이름을 화면과 같은 모양으로 그려 둔 조각. 캡처가 아니라 마크업이라 낡지 않는다. */
Then('펼쳐진 절차에 화면 버튼 모양의 표시가 보인다', async ({ page }) => {
  const chip = page.locator('.help-chip-btn').first();
  await expect(chip).toBeVisible({ timeout: 10_000 });
  await expect(chip).not.toBeEmpty();
});
