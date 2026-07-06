# language: ko
@workload
기능: 워크로드 운영 (인프라 MCI · 노드 VM · 부하테스트)
  사용자가 마이그레이션된 인프라(cm-beetle 경유 조회)와 그 노드를 조회하고,
  cm-ant 부하테스트로 성능을 평가한다.
  (현행화: 조회 ListInfra·상세 cm-beetle/GetInfra·삭제 DeleteInfra, 식별자 infraId/nodeId)

  배경:
    먼저 "cmiguser"로 로그인한다

  @unit @smoke
  시나리오: 인프라(MCI) 목록 조회
    먼저 워크로드 인프라 목록을 연다
    그러면 인프라 목록이 조회된다

  @unit
  시나리오: 인프라 상세 및 서버(노드) 목록 조회
    먼저 워크로드 인프라 목록을 연다
    만약 "e2e-target-infra" 인프라를 선택한다
    그러면 인프라 상세 정보가 보인다
    만약 "e2e-target-infra" 인프라의 서버 목록을 연다
    그러면 "e2e-target-node" 노드가 서버 목록에 보인다

  @unit @costly
  시나리오: 노드 부하테스트 실행 및 결과 확인
    먼저 워크로드 인프라 목록을 연다
    만약 "e2e-target-infra" 인프라의 서버 목록을 연다
    만약 "e2e-target-node" 노드로 부하테스트를 실행한다
    그러면 부하테스트 결과가 표시된다

  @unit
  시나리오: 부하테스트 시나리오 템플릿(카탈로그) 저장
    먼저 워크로드 인프라 목록을 연다
    만약 "e2e-target-infra" 인프라의 서버 목록을 연다
    그리고 "e2e-target-node" 노드를 선택한다
    만약 부하테스트 시나리오 템플릿 "e2e-template"을 저장한다
    그러면 시나리오 템플릿 "e2e-template"이 카탈로그에 보인다

  @unit @costly
  시나리오: 인프라(MCI) 삭제
    먼저 워크로드 인프라 목록을 연다
    만약 "e2e-target-infra" 인프라를 삭제한다
    그러면 "e2e-target-infra" 인프라가 목록에서 사라진다
