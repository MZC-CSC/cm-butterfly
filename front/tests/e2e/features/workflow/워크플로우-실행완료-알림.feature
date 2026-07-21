# language: ko
@workflow @mock @notify
기능: 워크플로우 실행 완료 알림 (BAR-1545 · 알림 배지 3단계)
  워크플로우 실행은 몇 분이 걸리고, 끝나는 순간 사용자는 보통 다른 화면에 있다. 그 결과를 배지로
  알리는 것이 이 기능이다. 삭제·부하 테스트와 달리 워크플로우는 진행 중 실행을 한 번에 조회하는
  API 가 없어, 시작할 때 우리가 추적 레코드를 남기고 실행 목록으로 끝을 판정한다.

  # 여기서 검증하는 것은 tracker 의 상태 기계다 — 로그인 시 재개(resume), 실행 해석, 완료 판정,
  # 동작(run/rerun/rerun-failed)별 문구, 중복 제거, 완료 후 레코드 정리. cm-cicada 실제 응답 파싱은
  # mock 으로 확인하지 않는다(우리 가정으로 우리 파서를 검증하는 셈) — 그 몫은 실 데이터 검증이 맡는다.
  #
  # 완료는 "브라우저가 로그인해 서버 레코드를 재개하는 순간" 잡힌다. 그래서 실제 실행을 몇 분 기다리는
  # 대신, 각 시나리오는 (이미 시작됐던 것처럼) 추적 레코드 하나와 엔진이 보고할 실행을 seed 한 뒤
  # 로그인한다. 배지가 관측 지점이다.

  @notify
  시나리오: 실행이 성공하면 완료 알림이 뜬다
    먼저 추적에 남은 워크플로우 작업을 준비한다: 이름 "order-service", 동작 "run", 결과 "success"
    그리고 "cmiguser"로 로그인한다
    그러면 알림 배지에 "정보" 수준의 "Workflow \"order-service\" finished." 알림이 뜬다

  @notify
  시나리오: 실행이 실패하면 실패 알림이 뜬다
    먼저 추적에 남은 워크플로우 작업을 준비한다: 이름 "billing-service", 동작 "run", 결과 "failed"
    그리고 "cmiguser"로 로그인한다
    그러면 알림 배지에 "오류" 수준의 "Workflow \"billing-service\" failed." 알림이 뜬다

  @notify
  시나리오: 전체 재실행이 끝나면 재실행 문구로 알린다
    먼저 추적에 남은 워크플로우 작업을 준비한다: 이름 "order-service", 동작 "rerun", 결과 "success"
    그리고 "cmiguser"로 로그인한다
    그러면 알림 배지에 "정보" 수준의 "Re-run of workflow \"order-service\" finished." 알림이 뜬다

  @notify
  시나리오: 실패 태스크만 재실행했다가 다시 실패하면 그 문구로 알린다
    먼저 추적에 남은 워크플로우 작업을 준비한다: 이름 "billing-service", 동작 "rerun-failed", 결과 "failed"
    그리고 "cmiguser"로 로그인한다
    그러면 알림 배지에 "오류" 수준의 "Re-run of failed tasks in \"billing-service\" failed." 알림이 뜬다

  @notify
  시나리오: 워크플로우 화면을 열지 않아도 완료가 잡힌다
    먼저 추적에 남은 워크플로우 작업을 준비한다: 이름 "order-service", 동작 "run", 결과 "success"
    그리고 "cmiguser"로 로그인한다
    그러면 현재 화면은 워크플로우 화면이 아니다
    그리고 알림 배지에 "정보" 수준의 "Workflow \"order-service\" finished." 알림이 뜬다

  @notify
  시나리오: 실행 id 를 시작 시 몰라도 목록에서 해석해 완료를 알린다
    # 엔진이 실행 중을 먼저 보고하고 다음에 성공을 보고한다 — 그 사이 tracker 가 실행 id 를 해석해
    # 레코드를 그 실행에 고정(retag)한 뒤 완료를 판정한다.
    먼저 추적에 남은 워크플로우 작업을 준비한다: 이름 "order-service", 동작 "run", 결과 "running-then-success"
    그리고 "cmiguser"로 로그인한다
    그러면 알림 배지에 "정보" 수준의 "Workflow \"order-service\" finished." 알림이 뜬다

  @notify
  시나리오: 같은 완료를 두 번 알리지 않는다
    먼저 추적에 남은 워크플로우 작업을 준비한다: 이름 "order-service", 동작 "run", 결과 "success"
    그리고 "cmiguser"로 로그인한다
    그러면 알림 배지에 "정보" 수준의 "Workflow \"order-service\" finished." 알림이 뜬다
    그리고 잠시 뒤에도 워크플로우 알림은 하나뿐이다
