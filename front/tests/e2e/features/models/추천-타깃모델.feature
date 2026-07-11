# language: ko
@models @migration
기능: 추천·타깃 모델
  소스 모델을 기준으로 저비용 클라우드 타깃 인프라를 추천받아 타깃 모델(cm-beetle 추천)로 저장한다.
  operationId: RecommendVmInfraCandidates · Updateandgetestimatecost · GetProviderList/GetRegions · CreateCloudModel
  비용 보호: 추천 결과 중 월 예상비용이 가장 낮은 후보를 선택하고 스펙 급을 small 이하로 검증한다.

  @unit
  시나리오: 저비용 타깃 인프라 추천
    먼저 "cmiguser"로 로그인한다
    그리고 소스 모델 화면을 연다
    그리고 "e2e-nano-source" 소스 모델을 선택한다
    만약 저비용 타깃 인프라를 추천받으면
    그러면 추천 스펙이 "small" 급 이하이다

  @unit
  시나리오: 추천 결과를 저비용 타깃 모델로 저장
    먼저 "cmiguser"로 로그인한다
    그리고 소스 모델 화면을 연다
    그리고 "e2e-nano-source" 소스 모델을 선택한다
    그리고 저비용 타깃 인프라를 추천받는다
    만약 추천 결과 중 가장 저렴한 스펙을 "e2e-lowcost-target" 타깃 모델로 저장하면
    그러면 타깃 모델 목록에 "e2e-lowcost-target" 이 보인다
