# language: ko
@workflow
기능: 워크플로우 관리
  cm-butterfly 콘솔에서 cm-cicada 워크플로우를 조회·실행한다.
  cm-cicada는 TaskComponent를 type/spec 스키마(http · http_xcom · bash · ssh · trigger_workflow)로 정의한다.

  # ★ "워크플로우 디자이너 열기"는 여기(@unit)에서 뺐다.
  #   워크플로우 목록 툴박스의 Add 버튼은 소스에서 아예 `disabled`로 박혀 있다(WorkflowList.vue).
  #   즉 목록에서는 디자이너로 들어갈 수 없다. 실제 진입점은 *타깃 모델 상세*의 워크플로우 생성이라,
  #   디자이너는 타깃 모델이 있는 시나리오에서 그 경로로 검증한다.
  #   없는 진입점을 기다리다 테스트가 죽지 않도록 여기서는 걷어냈다.

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

  # ⚠️ 요금 안전(cost-safe): 시드가 예제 템플릿(_v2_example_xcom_workflow)으로 만들어 둔
  #   워크플로우만 실행한다. 마이그레이션 워크플로우는 EC2를 프로비저닝하므로 @unit 실행 금지 → @scenario에서만.
  @unit @run
  시나리오: 워크플로우 실행 및 상태 확인 (요금 안전 예제)
    만약 "e2e-sample-bash-workflow" 워크플로우를 실행하면
    그러면 워크플로우 실행 이력이 생성된다
    그리고 워크플로우 실행이 정상 완료된다

  # cm-cicada가 TaskComponent를 type/spec 스키마로 바꾼 뒤, 업스트림 패치가 다루지 않아
  # 우리가 직접 보완한 두 화면. 화면이 멀쩡해 보여도 나가는 요청이나 표시되는 값이
  # 구 스키마 기준이면 실제로는 깨진 것이라, 요청 기록과 화면 캡처를 함께 본다. (BAR-1389)

  @unit @cicada-schema
  시나리오: Task Component 화면이 신 스키마로 동작한다
    만약 Task Component 화면을 연다
    그러면 Task Component 목록이 조회된다
    그리고 콘솔이 구 스키마 요청을 보내지 않는다
    그리고 화면을 "task-components" 이름으로 캡처한다

  @unit @cicada-schema
  시나리오: 워크플로우 JSON 뷰어가 run_script를 디코드해 보여준다
    먼저 run_script 스크립트가 담긴 "e2e-runscript-wf" 워크플로우가 있다
    만약 "e2e-runscript-wf" 워크플로우의 JSON 뷰어를 연다
    그러면 JSON 뷰어에 스크립트가 디코드되어 보인다
    그리고 화면을 "workflow-json-viewer" 이름으로 캡처한다
