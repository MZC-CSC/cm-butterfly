import { test, expect } from '@playwright/test';
import { getUser } from '../fixtures/test-data';
import { LoginPage } from '../pages/login.page';
import { ModelsPage } from '../pages/models.page';
import { JsonEditorPage } from '../pages/jsonEditor.page';
import { describe as writeDescription } from '../support/describe';

/**
 * Does the description actually get written, and can it be read?
 *
 * A quick check against a front served straight from source, so a change to the save form can be
 * tried without waiting on an image build. It saves nothing - it opens the save dialog, fills the
 * description, and looks at whether the box grew to fit.
 *
 * Not tagged, so no project picks it up. Run it deliberately:
 *
 *   BASE_URL=http://localhost:5173 npx playwright test \
 *     --config=tests/e2e/playwright.config.ts --project=integration \
 *     tests/e2e/specs/description-field.spec.ts --grep-invert @nothing
 */
test('the description is written and made readable @integration', async ({
  page,
}) => {
  test.setTimeout(5 * 60_000);

  const user = getUser('cmiguser');
  const login = new LoginPage(page);
  await login.goto();
  await login.login(user.id, user.password);
  await login.expectLoggedIn();

  // Any source model will do - we are looking at the save form, not at what is being saved.
  const models = new ModelsPage(page);
  await models.gotoSourceModels();
  const name = await models.selectFirstModel();
  expect(
    name,
    '소스 모델이 하나도 없다 — 앞선 시나리오가 남긴 것이 있어야 한다',
  ).toBeTruthy();

  const editor = new JsonEditorPage(page);
  await editor.openFromSourceModel();

  // Open the save dialog the same way saveAsCustom does.
  await page
    .getByTestId('target-custom-save')
    .or(page.getByTestId('create-form-save'))
    .first()
    .click();

  const description = page.getByTestId('model-description-input').first();
  await expect(
    description,
    '설명란에 식별자가 없다 — 프론트가 새 코드로 떠 있는지 확인한다',
  ).toBeVisible({ timeout: 15_000 });

  const long =
    '커스텀 소스 모델 시험 — 수집한 정보에 5555 포트를 더해 저장한다. ' +
    '여기에 넣은 값은 타깃 모델과 워크플로우에 그대로 이어져, 별도로 다시 넣지 않아도 ' +
    '그 설정대로 인프라가 만들어진다.';

  const before = await description.evaluate(
    (el: HTMLTextAreaElement) => el.clientHeight,
  );
  await writeDescription(page, description, long);

  // The text is there …
  await expect(description).toHaveValue(long);

  // … and it is not hidden behind a scrollbar.
  const after = await description.evaluate((el: HTMLTextAreaElement) => ({
    clientHeight: el.clientHeight,
    scrollHeight: el.scrollHeight,
  }));
  console.log(
    `[desc] 높이 ${before} → ${after.clientHeight} (내용 ${after.scrollHeight})`,
  );
  expect(
    after.scrollHeight,
    '설명이 상자를 넘쳐 화면에서 잘린다 — 높이 조절이 듣지 않았다',
  ).toBeLessThanOrEqual(after.clientHeight + 4);
});
