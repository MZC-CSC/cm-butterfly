# language: ko
@models @migration
기능: 소스 모델
  수집된 온프렘 인프라 정보를 소스 모델(cm-damselfly)로 저장·조회한다.
  operationId: GetModels · CreateOnPremModel/UpdateOnPremModel

  # 시드(@seed)가 실제 소스 서버를 수집해 소스 모델을 만들어 둔다. 이 기능 테스트는 그 위에서 돈다.
  # 저장 테스트는 시드가 만든 모델과 이름이 겹치지 않도록 자기 이름(e2e-unit-source)을 쓴다.

  @unit
  시나리오: 소스 모델 목록 조회
    먼저 "cmiguser"로 로그인한다
    만약 소스 모델 화면을 열면
    그러면 소스 모델 목록이 보인다

  @unit
  시나리오: 수집된 정보를 커스텀 소스 모델로 저장
    먼저 "cmiguser"로 로그인한다
    그리고 소스 모델 화면을 연다
    만약 수집된 정보를 "e2e-unit-source" 소스 모델로 저장하면
    그러면 소스 모델 목록에 "e2e-unit-source" 이 보인다
