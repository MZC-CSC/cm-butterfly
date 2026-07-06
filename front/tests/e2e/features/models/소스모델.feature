# language: ko
@models @migration
기능: 소스 모델
  수집된 온프렘 인프라 정보를 소스 모델(cm-damselfly)로 저장·조회한다.
  operationId: GetModels · CreateOnPremModel/UpdateOnPremModel

  @unit
  시나리오: 소스 모델 목록 조회
    먼저 "cmiguser"로 로그인한다
    만약 소스 모델 화면을 열면
    그러면 소스 모델 목록이 보인다

  @unit
  시나리오: 수집된 정보를 소스 모델로 저장
    먼저 "cmiguser"로 로그인한다
    그리고 소스 모델 화면을 연다
    만약 수집된 정보를 "e2e-nano-source" 소스 모델로 저장하면
    그러면 소스 모델 목록에 "e2e-nano-source" 이 보인다
