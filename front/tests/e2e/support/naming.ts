/**
 * 런별 고유 이름 — 실 백엔드(@unit/@scenario)에서 동명 리소스 재등록 충돌을 피한다.
 *
 * 실 honeybee/damselfly 등은 이름 UNIQUE 제약이 있어, 같은 이름으로 다시 등록하면 거부되고
 * 에러 모달이 열린 채 남아 후속 선택 조작을 가린다. 각 실행마다 고유 접미사를 붙여 항상 신규 등록되게 한다.
 * (@mock 은 매 테스트 새 저장소라 무해)
 */
const RUN_ID = String(Date.now()).slice(-6);

export function uniqueName(base: string): string {
  return `${base}-${RUN_ID}`;
}

export { RUN_ID };
