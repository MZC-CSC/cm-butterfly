/**
 * 시나리오 전역 상태 — 스텝 간 공유(생성된 인프라·노드 식별, 추천 결과 등).
 * 마이그레이션 시나리오는 여러 화면·단계를 거치므로, 생성된 리소스 식별자를 여기에 모아
 * 후속 단계(nginx 설치·부하테스트·정리)가 참조한다.
 */
export const scenarioState: {
  /** 생성된 타깃 인프라(MCI) 이름 */
  infraName?: string;
  /** 생성된 인프라 ID(nsId 내) */
  infraId?: string;
  /** 부하/명령 대상 노드 ID */
  nodeId?: string;
  /** 노드 공인 IP (nginx 외부 접근·부하 대상 호스트) */
  nodePublicIp?: string;
  /** 마지막 추천 스펙(검증용) */
  lastRecommendedSpec?: string;
} = {};

export function resetScenarioState(): void {
  for (const k of Object.keys(scenarioState)) {
    delete (scenarioState as Record<string, unknown>)[k];
  }
}
