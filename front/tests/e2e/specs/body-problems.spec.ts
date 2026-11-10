import { test, expect } from '@playwright/test';
import { findBodyProblems } from '../../../src/entities/workflow/lib/referenceValidation';

/**
 * 본문에서 무엇을 결함으로 셀 것인가.
 *
 * ★ 이 판정이 넓으면 *정상인 워크플로우가 열리지 않는다.* 안내가 모달이라 뒤 화면이 막히고,
 *   복제해서 고치려던 사람은 손댈 자리를 잃는다. 실제로 그렇게 막혔다 — 추천이 돌려준 인프라
 *   모델은 비워 둔 항목을 전부 null 로 채워 오는데, 그것을 타입 불일치로 세는 바람에 인프라
 *   마이그레이션 워크플로우가 통째로 걸렸다.
 *
 *   브라우저 없이 돈다:
 *     npx playwright test --config=tests/e2e/playwright.specs.config.ts body-problems
 */

const schema = {
  type: 'object',
  properties: {
    label: { type: 'object', properties: {} },
    dataDiskIds: { type: 'array', items: { type: 'string' } },
    name: { type: 'string' },
    count: { type: 'integer' },
    nested: {
      type: 'object',
      properties: { inner: { type: 'array', items: { type: 'string' } } },
    },
  },
};

const workflowWith = (body: unknown) => [
  {
    name: 'g1',
    tasks: [
      {
        name: 'infra_migration',
        task_component: 'beetle_task_infra_migration',
        dependencies: [],
        spec: { request_body: JSON.stringify(body) },
      },
    ],
  },
];

const problemsOf = (body: unknown) =>
  findBodyProblems(workflowWith(body) as any, () => schema);

test.describe('본문에서 결함으로 셀 것', () => {
  test('비워 둔 항목(null)은 결함이 아니다', () => {
    // 이 API 들은 설정하지 않은 항목을 null 로 돌려주고 받는 쪽이 기본값으로 처리한다.
    const problems = problemsOf({
      label: null,
      dataDiskIds: null,
      nested: { inner: null },
      name: 'infra01',
    });
    expect(
      problems,
      `비워 둔 항목을 결함으로 셌다: ${JSON.stringify(problems)}`,
    ).toEqual([]);
  });

  test('타입이 진짜 어긋난 것은 잡는다', () => {
    const problems = problemsOf({ name: 'infra01', count: '5' });
    expect(problems).toHaveLength(1);
    expect(problems[0].field).toBe('count');
    expect(problems[0].found).toBe('string');
    expect(problems[0].expected).toBe('integer');
  });

  test('스키마가 말하지 않는 항목은 따지지 않는다', () => {
    expect(problemsOf({ 무엇인지모를칸: 42 })).toEqual([]);
  });

  test('정수와 실수는 서로 통한다', () => {
    expect(problemsOf({ count: 5 })).toEqual([]);
  });

  test('읽지 못하는 본문은 그대로 알린다', () => {
    const groups = workflowWith({}) as any;
    groups[0].tasks[0].spec.request_body = '{"a": 1 "b": 2}';
    const problems = findBodyProblems(groups, () => schema);
    expect(problems).toHaveLength(1);
    expect(problems[0].kind).toBe('unreadable');
  });

  test('앞선 태스크 결과 전체를 가리키는 본문은 결함이 아니다', () => {
    const groups = workflowWith({}) as any;
    groups[0].tasks[0].spec.request_body = 'infra_recommend_get';
    expect(findBodyProblems(groups, () => schema)).toEqual([]);
  });
});
