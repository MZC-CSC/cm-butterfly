# language: ko
@models @software
기능: 소프트웨어 마이그레이션 추천·타깃 SW 모델
  소프트웨어 계획 모델을 기준으로 마이그레이션 추천을 받아 타깃 SW 모델로 저장한다.
  (인프라 추천과 동일 과정 — 소스 SW 모델 → 계획 SW 모델 → 추천 → 타깃 SW 모델)

  # "e2e-sw-source"는 시드(@seed)가 실제 소스 서버의 소프트웨어를 수집해 저장한 SW 계획 모델이다.
  # 수집 원본은 "e2e-sw-source-source" 소스 모델로 함께 저장된다.

  배경:
    먼저 "cmiguser"로 로그인한다

  @unit
  시나리오: 소프트웨어 추천을 타깃 SW 모델로 저장
    그리고 "e2e-sw-source" 소프트웨어 계획 모델을 선택한다
    만약 소프트웨어 마이그레이션을 추천받아 "e2e-unit-sw-target" 타깃 SW 모델로 저장하면
    그러면 타깃 SW 모델 목록에 "e2e-unit-sw-target" 이 보인다

  @unit
  시나리오: 수집한 소프트웨어는 소스 모델에서 파생된 계획 모델로 저장된다
    그러면 "e2e-sw-source" 모델은 "e2e-sw-source" 수집의 원본 소스 모델에서 파생된 계획 모델이다
