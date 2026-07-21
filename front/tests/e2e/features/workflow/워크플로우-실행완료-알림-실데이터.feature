# language: ko
@workflow @live
기능: 워크플로우 실행 완료 알림 — 실 데이터 (BAR-1545)
  mock 시나리오가 tracker 의 로직을 검증한다면, 이 시나리오는 마지막 연결을 실제로 확인한다 —
  실제 화면의 Run 클릭이 trackWorkflow 를 부르고, 실제 cm-cicada 실행이 끝나며, 실제 알림 저장소가
  배지에 그 결과를 올리는 것까지. 요금 안전 예제(bash·http echo — 클라우드 자원 없음)를 써서 비용
  없이 수초 안에 끝난다.

  시나리오: 실제 실행이 끝나면 배지에 실제 알림이 뜬다
    먼저 "cmiguser"로 로그인한다
    그리고 요금 안전 예제로 워크플로우 "notify-live-verify" 를 만든다
    그리고 워크플로우 "notify-live-verify" 를 실제로 실행한다
    그러면 실제 알림 배지에 "Workflow \"notify-live-verify\" finished." 알림이 뜬다
