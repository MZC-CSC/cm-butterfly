import { test, expect } from '@playwright/test';
import {
  buildRequestBodyTemplate,
  parseRequestBodyTemplate,
} from '../../../src/shared/utils/stringToObject';

/**
 * 저장된 본문을 읽고 다시 쓰는 경계가 어떤 모양에도 흔들리지 않는가.
 *
 * ★ 왜 따로 두나 — 이 경계가 틀리면 **화면에서는 아무 일도 일어나지 않는다.** 저장은 되고,
 *   빌드도 타입 체크도 통과하고, 다음에 그 워크플로우를 열었을 때에야 칸이 통째로
 *   사라진 것으로 드러난다. 그때는 이미 저장된 상태라 되돌릴 것도 없다.
 *
 *   브라우저가 필요 없으므로 specs 설정으로 단독 실행한다:
 *     npx playwright test --config=tests/e2e/playwright.specs.config.ts request-body-template
 */

/** `${` 를 소스에 그대로 쓰면 템플릿 리터럴로 먹히므로 나눠 붙인다. */
const ref = (path: string) => `\${${path}}`;

test.describe('요청 본문 틀 — 쓰기와 읽기', () => {
  const roundTrips: Array<[string, string]> = [
    ['빈 객체', '{}'],
    [
      '참조 없는 평범한 본문',
      JSON.stringify({ a: 1, b: 'x', c: [1, 2], d: { e: true }, f: null }),
    ],
    [
      '예전 형태 — 참조가 모두 따옴표 안',
      JSON.stringify({ name: ref('t.$.n'), count: ref('t.$.c') }),
    ],
    [
      '새 형태 — 숫자 칸만 따옴표 없음',
      `{"name":"${ref('t.$.n')}","count":${ref('t.$.c')}}`,
    ],
    ['배열 자리에 참조', `{"list":${ref('t.$.items')}}`],
    ['객체 자리에 참조', `{"spec":${ref('t.$.o')}}`],
    ['배열 원소에 참조', `{"list":["a",${ref('t.$.x')},"b"]}`],
    ['깊은 중첩', `{"a":{"b":[{"c":${ref('t.$.n')}}]}}`],
    [
      '문자열 중간에 낀 참조',
      JSON.stringify({ url: `http://x/${ref('t.$.id')}/y` }),
    ],
    [
      '같은 참조가 여러 자리에',
      `{"p":${ref('t.$.n')},"q":${ref('t.$.n')},"r":"${ref('t.$.n')}"}`,
    ],
    ['값에 따옴표', JSON.stringify({ note: 'he said "hi"' })],
    ['값에 중괄호와 달러', JSON.stringify({ s: 'cost is ${100} {}' })],
    ['값에 줄바꿈과 역슬래시', JSON.stringify({ s: 'a\nb\\c' })],
    ['한글과 이모지', JSON.stringify({ s: '한글 🚀 값' })],
    ['빈 문자열 칸', JSON.stringify({ s: '' })],
    ['숫자 0 · false · null', JSON.stringify({ z: 0, f: false, n: null })],
    [
      '줄바꿈과 들여쓰기가 있는 본문',
      `{\n  "a": 1,\n  "b": ${ref('t.$.n')}\n}`,
    ],
  ];

  for (const [label, stored] of roundTrips) {
    test(`${label} — 읽고 다시 써도 같은 내용이다`, () => {
      const first = parseRequestBodyTemplate(stored);
      expect(first, '본문으로 읽히지 않았다').not.toBeNull();

      const rewritten = buildRequestBodyTemplate(first!.model, first!.rawPaths);
      const second = parseRequestBodyTemplate(rewritten);
      expect(second, '다시 쓴 것을 읽지 못했다').not.toBeNull();
      expect(second!.model).toEqual(first!.model);
      expect(second!.rawPaths.sort()).toEqual(first!.rawPaths.sort());
    });
  }

  // 본문이 아닌 것을 본문으로 읽으면 반대편이 깨진다 — "앞선 태스크 결과 전체" 는 본문이
  // 아니라 참조 하나이고, 그것을 본문으로 읽으면 그 모드가 사라진다.
  for (const [label, notABody] of [
    ['태스크 이름만', 'infra_recommend_get'],
    ['이름과 경로', 'infra_recommend_get.$.cloudInfraModel'],
    ['빈 문자열', ''],
    ['공백만', '   '],
    ['숫자 하나', '42'],
    ['문자열 하나', '"hello"'],
  ]) {
    test(`${label} — 본문으로 읽지 않는다`, () => {
      expect(parseRequestBodyTemplate(notABody)).toBeNull();
    });
  }

  test('참조가 없으면 예전과 같은 글자를 쓴다', () => {
    // 참조를 쓰지 않는 워크플로우가 이 변경으로 달라지면 안 된다.
    const body = { note: 'he said "hi"', s: 'a\nb\\c', k: '한글 🚀', n: 0 };
    expect(buildRequestBodyTemplate(body, [])).toBe(JSON.stringify(body));
  });

  test('따옴표를 벗길 자리만 벗긴다', () => {
    const body = { name: ref('t.$.n'), count: ref('t.$.c') };
    const text = buildRequestBodyTemplate(body, ['count']);
    expect(text).toBe(`{"name":"${ref('t.$.n')}","count":${ref('t.$.c')}}`);
  });
});
