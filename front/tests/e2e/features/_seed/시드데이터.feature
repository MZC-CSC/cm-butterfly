# language: ko
@seed
기능: 기능 테스트용 시드 데이터
  기능(@unit) 테스트는 mock 없이 실 라인업을 친다. 그래서 소스 모델·워크플로우가 *실제로 있어야* 한다.
  이 시드가 그 데이터를 먼저 만들고, functional·scenario 프로젝트가 그 위에서 돈다.
  (playwright.config.ts의 project dependencies로 순서를 명시)

  전제: 실제로 접속 가능한 소스 서버가 있어야 한다(TEST_SOURCE_IP / TEST_SOURCE_PRIVATE_KEY).
  수집은 cm-honeybee가 그 서버에 SSH로 붙어 수행하므로, 더미 IP로는 수집이 끝내 실패한다.

  @seed
  시나리오: 소스 수집 → 소스 모델(인프라·소프트웨어) → 요금 안전 워크플로우
    먼저 "cmiguser"로 로그인한다
    그리고 소스 서비스에 "e2e-nano-source" 소스서버를 등록한다
    그리고 소스 인프라를 수집한다
    그리고 수집된 정보를 소스 모델로 저장한다
    그리고 소스 소프트웨어를 수집한다
    그리고 수집된 소프트웨어를 "e2e-sw-source" 소스 모델로 저장한다
    그리고 소스 모델 화면을 연다
    그러면 소스 모델 목록에 "e2e-nano-source" 이 보인다
    그리고 소스 모델 목록에 "e2e-sw-source" 이 보인다
    그리고 요금 안전 예제 워크플로우 "e2e-sample-bash-workflow" 를 준비한다
