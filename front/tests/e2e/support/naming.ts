/**
 * 런별 고유 이름 — 실 백엔드(@seed/@unit/@scenario)에서 동명 리소스 재등록 충돌을 피한다.
 *
 * honeybee(소스그룹)·cicada(워크플로우) 등은 이름에 UNIQUE 제약이 있어, 같은 이름으로 다시 등록하면
 * 거부되고 에러 모달이 열린 채 남아 후속 조작을 가린다. 실행마다 고유 접미사를 붙여 항상 신규 등록되게 한다.
 *
 * ★ RUN_ID는 *프로세스 사이에서도 같아야* 한다.
 *   seed·functional·scenario는 서로 다른 worker 프로세스에서 돈다. 모듈 로드 시점의 Date.now()를 쓰면
 *   프로젝트마다 값이 달라져서, seed가 만든 `e2e-nano-source-123456` 을 functional이
 *   `e2e-nano-source-789012` 로 찾다가 못 찾는다.
 *   그래서 globalSetup이 메인 프로세스에서 E2E_RUN_ID를 심어 두고(worker가 상속), 여기서 그 값을 읽는다.
 */
const RUN_ID = process.env.E2E_RUN_ID || String(Date.now()).slice(-6);

export function uniqueName(base: string): string {
  return `${base}-${RUN_ID}`;
}

export { RUN_ID };
