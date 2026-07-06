# language: ko
@workflow
기능: 워크플로우 관리
  cm-butterfly 콘솔에서 cm-cicada 워크플로우를 조회·생성·실행한다.
  cm-cicada는 TaskComponent를 type/spec 스키마(http · http_xcom · bash · ssh · trigger_workflow)로 정의한다.

  배경:
    먼저 "cmiguser"로 로그인한다

  @unit
  시나리오: 워크플로우 목록 조회
    만약 워크플로우 목록 화면을 연다
    그러면 워크플로우 목록이 조회된다

  @unit
  시나리오: 워크플로우 템플릿 목록 조회
    만약 워크플로우 템플릿 화면을 연다
    그러면 워크플로우 템플릿 목록이 조회된다

  @unit
  시나리오: Task Component 목록 조회 (type/spec 스키마)
    만약 Task Component 화면을 연다
    그러면 Task Component 목록이 조회된다

  @unit
  시나리오: 워크플로우 디자이너(에디터) 열기
    먼저 워크플로우 목록 화면을 연다
    만약 워크플로우 디자이너를 연다
    그러면 워크플로우 디자이너가 표시된다

  # ⚠️ 요금 안전(cost-safe): 반드시 실제 인프라를 만들지 않는 예제 워크플로우
  #   (기본값 e2e-sample-bash-workflow, bash echo 등)로만 실행한다.
  #   마이그레이션 워크플로우는 EC2를 프로비저닝하므로 @unit 실행 금지 → @scenario에서만.
  @unit @run
  시나리오: 워크플로우 실행 및 상태 확인 (요금 안전 예제)
    만약 "e2e-sample-bash-workflow" 워크플로우를 실행하면
    그러면 워크플로우 실행 이력이 생성된다
    그리고 워크플로우 실행이 정상 완료된다
