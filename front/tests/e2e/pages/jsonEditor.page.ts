import { Page, Locator, expect } from '@playwright/test';
import { humanClick, humanFill } from '../support/humanize';
import { describe as writeDescription } from '../support/describe';

/**
 * JsonEditorPage — the model JSON editor (Custom & View).
 *
 * The integration scenario opens a firewall port twice: once on the source model and once on the
 * target model. Both edits happen here, so the "where" of it lives in one place and the Korean
 * scenario keeps saying only what it wants.
 *
 * ★ Table mode is *our* property grid, not the library's. Every document these editors handle is an
 *   object at the root, so the library's table mode has no table to draw; the grid flattens the
 *   document to key/value rows and takes its place. That is why the row and search controls below
 *   are our own data-testid values rather than anything from vanilla-jsoneditor.
 *
 * ★ Read DESIGN-MIRINAE before touching selectors here. Half of the traps in this UI fail silently:
 *   isChecked()/isEnabled() answer wrongly on mirinae controls, so judge by *result* - the value in
 *   the document, the row that appears - not by the state of a control.
 */
export class JsonEditorPage {
  constructor(private readonly page: Page) {}

  // ── entry points ───────────────────────────────────────────────────────

  /** True when the editor is already on screen - opening it again would time out on the link. */
  private async isOpen(): Promise<boolean> {
    return this.page
      .locator('.jse-main')
      .first()
      .isVisible()
      .catch(() => false);
  }

  /**
   * Open the editor from a source model detail.
   *
   * Does nothing if it is already open. Steps that edit the document each open it for themselves,
   * so that they can be run on their own, and consecutive edits would otherwise have the second one
   * clicking a link that is no longer on screen.
   */
  async openFromSourceModel(): Promise<void> {
    if (await this.isOpen()) return;
    await humanClick(this.page.getByTestId('source-detail-custom-view'));
    await this.expectOpen();
  }

  /** Open the editor from a target model detail. */
  async openFromTargetModel(): Promise<void> {
    if (await this.isOpen()) return;
    await humanClick(this.page.getByTestId('target-detail-custom-view'));
    await this.expectOpen();
  }

  async expectOpen(): Promise<void> {
    await expect(this.page.locator('.jse-main').first()).toBeVisible({
      timeout: 30_000,
    });
  }

  // ── modes ──────────────────────────────────────────────────────────────

  /**
   * Switch to table mode (the property grid).
   *
   * The mode buttons are the three labelled `text` / `tree` / `table` at the left of the menu, and
   * they are matched by that label. Matching on the title instead picked up the search toggle - the
   * editor then stayed in text mode with find-and-replace open, and everything after it looked for
   * grid rows that were never drawn.
   *
   * Which mode it opens in is not fixed, so this is not a formality: the same screen has been seen
   * opening in table mode and in text mode.
   */
  async switchToTable(): Promise<void> {
    await this.switchMode('table');
    // Confirm by the grid itself rather than by a control that exists in more than one mode.
    await expect(this.page.locator('.pg-table').first()).toBeVisible({
      timeout: 15_000,
    });
  }

  async switchToTree(): Promise<void> {
    await this.switchMode('tree');
  }

  private async switchMode(mode: 'text' | 'tree' | 'table'): Promise<void> {
    const button = this.page
      .locator('.jse-menu button')
      .filter({ hasText: new RegExp(`^\\s*${mode}\\s*$`) })
      .first();
    await expect(button).toBeVisible({ timeout: 15_000 });
    await humanClick(button);
  }

  // ── search (table mode) ────────────────────────────────────────────────

  /** Type a query into the grid search. Opens the search bar if it is not showing. */
  async search(query: string): Promise<void> {
    const input = this.page.getByTestId('json-grid-search-input');
    if (!(await input.isVisible().catch(() => false))) {
      await humanClick(
        this.page.locator('.jse-menu button[title^="Search"]').first(),
      );
    }
    await humanFill(input, query);
  }

  /** Narrow the grid to matching rows rather than only highlighting them. */
  async enableFilter(): Promise<void> {
    await humanClick(this.page.getByTestId('json-grid-search-filter'));
  }

  /**
   * 일치 지점을 하나씩 짚어 간다.
   *
   * ★ 검색만 하면 표가 첫 일치로 *스스로 옮겨 간다*. 보는 사람에게는 누른 것도 없이 화면이
   *   좁혀진 것처럼 보여, 걸지도 않은 필터가 걸린 줄로 읽힌다(2026-08-19 사용자 지적).
   *
   *   여기서 필터를 켜지 않는 데에는 이유가 있다 — 켜면 규칙의 갈래를 말해 주는 `dstCIDR` 행이
   *   사라져 IPv4 와 IPv6 를 가릴 수 없다. 그러니 필터를 켜는 대신 *다음 일치* 를 눌러 옮겨
   *   간다. 화면이 왜 움직였는지가 그 동작으로 설명된다.
   */
  async stepThroughMatches(times = 1): Promise<void> {
    const next = this.page.getByTestId('json-grid-search-next');
    for (let i = 0; i < times; i++) {
      if (!(await next.count())) return;
      await humanClick(next, { pauseBeforeMs: 500 });
      await this.page.waitForTimeout(900);
    }
  }

  /**
   * Leave the editor without saving.
   *
   * ★ The editor is an overlay on the model's own route, so the address does not change when it
   *   opens. Anything that decides "am I on the models screen" by the URL says yes while this is
   *   covering it, and the buttons underneath resolve but never become clickable - the step then
   *   times out on an element that was there all along. Playwright counts an element behind an
   *   overlay as visible, so a marker check does not catch it either. The editor has to be closed.
   *   (2026-07-31)
   */
  async close(): Promise<void> {
    // 타깃·소스 두 편집기가 같은 자리를 쓴다. 열려 있는 쪽 하나만 화면에 있으므로 둘을 함께 잡는다.
    const cancel = this.page
      .locator(
        '[data-testid="target-custom-cancel"], [data-testid="source-custom-cancel"]',
      )
      .first();
    if (await cancel.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await humanClick(cancel);
      await expect(cancel).toBeHidden({ timeout: 15_000 });
    }
  }

  async closeSearch(): Promise<void> {
    await humanClick(this.page.getByTestId('json-grid-search-close'));
  }

  /** Rows currently drawn in the grid. */
  private get gridRows(): Locator {
    return this.page.locator('.pg-table tbody tr.pg-row');
  }

  /**
   * The row whose value is *exactly* this.
   *
   * Matching on a substring is no good here: a document full of addresses and ports contains "22"
   * inside `224.0.0.251/32` and inside any port in the twenties, so a loose match picks a different
   * row than the one meant - and a rule gets edited that nobody looked at.
   */
  row(value: string): Locator {
    return this.rowsMatching(value).first();
  }

  /** Every row whose value is exactly this - used to tell an original from the copy made of it. */
  rowsMatching(value: string): Locator {
    const exact = new RegExp(
      `^\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`,
    );
    return this.gridRows.filter({
      has: this.page.locator('.pg-value').filter({ hasText: exact }),
    });
  }

  /**
   * Open every folded node so the whole document is on screen as rows.
   *
   * A folded node's children are not rows at all - they are absent from the DOM, not merely hidden.
   * Anything that reads the grid without doing this reads whatever happens to be open, which is a
   * different set on the source model and on the target model.
   */
  async expandAll(): Promise<void> {
    await humanClick(
      this.page.locator('.jse-menu button[title="Expand all"]').first(),
    );
    await this.page.waitForTimeout(500);
  }

  /**
   * The port row of a rule with an IPv4 address.
   *
   * ★ A collected firewall carries both families, so a port appears twice - `firewallTable.6` with
   *   `0.0.0.0/0` and `firewallTable.18` with `::/0`. cm-beetle drops IPv6 rules on the way into a
   *   recommendation, so a copy taken from the wrong one leaves the port in the source model and
   *   nowhere else, while every step reports success. (2026-08-14)
   *
   *   Each row carries its own `data-path`, so the rule a port belongs to is known rather than
   *   guessed: take the field off the path and ask that rule for its `dstCIDR`. Reading the
   *   neighbouring rows instead means deciding where a rule begins and ends, which the document
   *   already answers.
   */
  async ipv4PortRow(value: string): Promise<Locator> {
    const rule = await this.ruleWithPort(value, 'ipv4');
    if (!rule) {
      throw new Error(
        `IPv4 규칙에서 포트가 "${value}" 인 행을 찾지 못했다 — 표가 접혀 있으면 그 행이 아예 ` +
          `없으므로 expandAll 을 먼저 부른다. 행에 data-path 가 없으면 규칙을 짚을 수 없다.`,
      );
    }
    return this.portRowOf(rule);
  }

  /** The port row of this rule, whichever name this layer gives the field. */
  portRowOf(rulePath: string): Locator {
    return this.page.locator(
      `[data-path="${rulePath}.dstPorts"], [data-path="${rulePath}.Ports"]`,
    );
  }

  /** Which address family the rule holding this port belongs to. */
  async familyOfRuleContaining(
    value: string,
  ): Promise<'ipv4' | 'ipv6' | 'unknown'> {
    if (await this.ruleWithPort(value, 'ipv4')) return 'ipv4';
    if (await this.ruleWithPort(value, 'ipv6')) return 'ipv6';
    return 'unknown';
  }

  /** The path of the firewall rule whose port is this, in the family asked for. */
  private async ruleWithPort(
    port: string,
    family: 'ipv4' | 'ipv6',
  ): Promise<string | null> {
    return this.page.evaluate(
      ({ wanted, want }) => {
        const rows = Array.from(
          document.querySelectorAll<HTMLElement>('.pg-table tbody tr.pg-row'),
        );
        const read = (path: string) => {
          const row = rows.find(r => r.dataset.path === path);
          return (row?.querySelector('.pg-value')?.textContent ?? '').trim();
        };

        /*
          The field names differ by layer. An on-prem model writes `dstPorts` / `dstCIDR`; a target
          model writes `Ports` / `CIDR`. Both are looked for rather than assumed - asking for one
          name against the other document finds nothing, which reads as the rule not being there.
        */
        for (const row of rows) {
          const path = row.dataset.path ?? '';
          const field = ['.dstPorts', '.Ports'].find(f => path.endsWith(f));
          if (!field) continue;
          if (
            (row.querySelector('.pg-value')?.textContent ?? '').trim() !==
            wanted
          )
            continue;

          const rule = path.slice(0, -field.length);
          const cidr = read(`${rule}.dstCIDR`) || read(`${rule}.CIDR`);
          if (!cidr) continue;
          if ((want === 'ipv6') === cidr.includes('::/')) return rule;
        }
        return null;
      },
      { wanted: port, want: family },
    );
  }

  /** The row at this document path. */
  rowAt(path: string): Locator {
    return this.page.locator(`[data-path="${path}"]`);
  }

  /**
   * The path of the array item this field belongs to.
   *
   * ★ Not worked out by walking up until the indentation shallows - that is a guess about where one
   *   item ends and the next begins, and it kept landing one rule over. A row carrying
   *   `$.0.firewallTable.6.dstPorts` says outright that its item is `$.0.firewallTable.6`.
   */
  async rulePathOf(row: Locator): Promise<string> {
    const path = await row.getAttribute('data-path');
    if (!path) {
      throw new Error(
        '행에 data-path 가 없다 — 이 판이 오래된 이미지다. 경로 없이는 어느 규칙인지 짚을 수 없다.',
      );
    }
    return path.replace(/\.[^.]+$/, '');
  }

  /**
   * The paths of every firewall rule currently in the document.
   *
   * Taken before and after a duplication so the new one can be found by comparison. The alternative
   * - assuming the copy lands at the next index - is a guess about what the editor does, and the
   * index of any rule depends entirely on how the document was collected.
   */
  async rulePaths(): Promise<string[]> {
    return this.page.evaluate(() =>
      Array.from(
        document.querySelectorAll<HTMLElement>('.pg-table tbody tr.pg-row'),
      )
        .map(r => r.dataset.path ?? '')
        .filter(p => /\.dstPorts$/.test(p))
        .map(p => p.replace(/\.dstPorts$/, '')),
    );
  }

  /** The row whose *key* is this, for fields addressed by name rather than by value. */
  rowByKey(key: string): Locator {
    return this.gridRows
      .filter({ has: this.page.locator('.pg-key', { hasText: key }) })
      .first();
  }

  async expectRowVisible(text: string): Promise<void> {
    await expect(this.row(text)).toBeVisible({ timeout: 15_000 });
  }

  // ── row editing (table mode) ───────────────────────────────────────────

  /**
   * Duplicate the row that holds `text`.
   *
   * This is how the scenario opens a second port: the rule for 22 already exists, so it is copied
   * and the copy's port is changed. Writing a whole rule by hand would test the keyboard, not the
   * product.
   */
  async duplicateRow(locator: Locator): Promise<void> {
    await expect(locator).toBeVisible({ timeout: 15_000 });
    const inline = locator.getByTestId('json-grid-row-duplicate');
    if (await inline.count()) {
      await humanClick(inline.first());
      return;
    }
    // Only array items can be duplicated, so a leaf field has no button of its own - the copy has
    // to be taken of the item that contains it, through its right-click menu.
    await locator.click({ button: 'right' });
    await humanClick(this.page.getByTestId('json-grid-menu-duplicate'));
  }

  /**
   * The array item that holds a row - the thing a copy is actually taken of.
   *
   * Rows are flattened to one level of indentation per depth, so the item a field belongs to is the
   * nearest row above it that sits shallower and carries a duplicate button.
   */
  async enclosingItem(row: Locator): Promise<Locator> {
    const rows = this.gridRows;
    const depthOf = (cls: string | null) =>
      Number((cls ?? '').match(/depth-(\d+)/)?.[1] ?? '0');
    const want = depthOf(await row.getAttribute('class'));

    /*
      Where this row actually sits, asked of the row itself.

      ★ It used to find the position by scanning for the first row whose `class` string matched.
        Class carries depth, not identity - every row at the same depth has the same one - so the
        scan stopped at whichever row came first and called it the target. The walk upwards then
        started from a stranger, and the copy was taken of whatever array item happened to enclose
        *that*.

        Seen on 2026-08-14: filtering the grid to `22` also brings in the image rows, because the
        AMI id was `ami-05fa22e12f2cb12aa`. The port rule was found correctly, the position was
        not, and the duplicate landed inside the image subtree. Nothing failed at that moment -
        it surfaced fifteen seconds later as a second `22` row that was never created.
    */
    const index = await row.evaluate(el => {
      const body = el.closest('tbody');
      if (!body) return -1;
      return Array.from(body.querySelectorAll('tr.pg-row')).indexOf(el);
    });
    if (index < 0) return row;

    for (let i = index - 1; i >= 0; i--) {
      const candidate = rows.nth(i);
      if (depthOf(await candidate.getAttribute('class')) >= want) continue;
      if (await candidate.getByTestId('json-grid-row-duplicate').count()) {
        return candidate;
      }
    }
    return row;
  }

  /** Read what a row currently holds - used when a value is edited in part rather than replaced. */
  async readRowValue(key: string): Promise<string> {
    const cell = this.rowByKey(key).locator('.pg-value');
    await expect(cell).toBeVisible({ timeout: 15_000 });
    return (await cell.innerText()).trim();
  }

  /**
   * Set the value of a row.
   *
   * The grid edits in place, so the cell becomes an input once clicked. Confirm with Enter - moving
   * focus away also commits, but Enter is what a person presses.
   */
  async setRowValue(row: Locator, value: string): Promise<void> {
    // The value only becomes an input once the cell is double-clicked; until then it is text.
    await row.locator('.pg-cell-value').dblclick();

    // Look for the input on the page rather than inside the row. Rows are found by the text of
    // their value, and editing *replaces* that text with the input - so the locator that found the
    // row stops matching the moment the edit begins, and anything looked up through it comes back
    // empty. Only one cell can be in edit mode at a time, so the page-level match is unambiguous.
    const input = this.page.locator('.pg-edit-input');
    await expect(input).toBeVisible({ timeout: 10_000 });
    await humanFill(input, value);
    await input.press('Enter');
  }

  /**
   * Change only the end of a value - delete the tail, type the new one.
   *
   * ★ A spec reads `aws+ap-northeast-2+t3a.medium`, and only the size at the end changes. Retyping
   *   the whole thing is what the recording was doing, and it looks like nothing anyone does: you
   *   put the caret at the end, backspace over `t3a.medium`, and type `t3a.large`.
   *
   *   This is safe because the tail is not guessed - the caller read the current value and split it,
   *   so the number of characters to remove is known exactly.
   */
  async replaceRowValueTail(
    row: Locator,
    oldTail: string,
    newTail: string,
  ): Promise<void> {
    await row.locator('.pg-cell-value').dblclick();

    const input = this.page.locator('.pg-edit-input');
    await expect(input).toBeVisible({ timeout: 10_000 });

    await input.press('End');
    for (let i = 0; i < oldTail.length; i++) {
      await input.press('Backspace');
      await this.page.waitForTimeout(28);
    }
    await input.pressSequentially(newTail, { delay: 55 });
    await input.press('Enter');
  }

  // ── saving ─────────────────────────────────────────────────────────────

  /**
   * Save what is on screen as a custom model.
   *
   * Saving from here never overwrites the original - it creates a new model under the name given.
   * That is the point of the custom pass: the collected model stays as collected.
   */
  async saveAsCustom(name: string, description?: string): Promise<string> {
    // The two custom-view screens name their save button differently - the source one has carried
    // `create-form-save` for a while, the target one had no identifier at all until now.
    await humanClick(
      this.page
        .getByTestId('target-custom-save')
        .or(this.page.getByTestId('create-form-save'))
        .first(),
    );
    await humanFill(
      this.page
        .locator(
          'input[data-testid="model-name-input"], textarea[data-testid="model-name-input"]',
        )
        .first(),
      name,
    );

    // Say what it is for. A name on its own tells a viewer nothing about why this model exists,
    // and the list they see later carries only these two fields.
    if (description) {
      await writeDescription(
        this.page,
        this.page.getByTestId('model-description-input').first(),
        description,
      );
    }

    /*
      저장 응답에서 그 모델의 **고유 ID** 를 받아 둔다.

      ★ 이름으로 고르면 화면이 따라오지 않아도 알 수 없다. 목록의 표시만 바뀌고 상세는 이전
        모델을 잡고 있는 상태가 실제로 생겼고, 그대로 추천이 나가 *원본 기준 결과*가 돌아왔다.
        규칙에 5555 가 없어 제품 결함으로 볼 뻔했다(2026-08-01, 2026-08-19 재발).
        ID 는 그 모델만 가리키므로 고르는 것도 확인하는 것도 어긋날 수 없다.
    */
    const created = this.page.waitForResponse(
      r =>
        /cm-damselfly\/(CreateOnPremModel|CreateCloudModel)/.test(r.url()) &&
        r.request().method() === 'POST',
      { timeout: 30_000 },
    );
    await humanClick(this.page.getByTestId('model-name-save'));

    let savedId = '';
    try {
      const body = await (await created).json();
      savedId =
        body?.responseData?.id ??
        body?.responseData?.data?.id ??
        body?.data?.id ??
        body?.id ??
        '';
    } catch {
      savedId = '';
    }
    console.log(`[모델저장] ${name} → id=${savedId || '(응답에서 못 읽음)'}`);

    // ★ 저장했으면 편집기를 닫고 나온다.
    //
    //   이 편집기는 화면을 덮는데 주소는 모델 화면 그대로다. 열린 채로 두면 그 아래 것들이 *보이기는
    //   하는데 눌리지 않고*, 다음 단계는 엉뚱한 데서 시간 초과가 난다 — 목록의 페이지 버튼을 기다리다
    //   멈춘 적이 있고, 오류는 그 버튼을 가리키지 덮고 있는 것을 가리키지 않는다. 같은 모양으로 네 번
    //   데였다(모델 편집기 두 번, 설치 목록 창, 복제한 워크플로우). 나가는 자리에서 닫는 것이
    //   부르는 쪽마다 기억하는 것보다 낫다. (2026-08-01)
    await this.close();
    return savedId;
  }
}
