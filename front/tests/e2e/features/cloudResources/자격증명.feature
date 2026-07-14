# language: ko
@cloudResources
기능: 클라우드 리소스 — CSP 자격증명
  cm-butterfly가 cb-spider를 통해 등록된 CSP 자격증명을 조회한다.

  # ⚠️ 등록·해제는 테스트하지 않는다.
  #   Cloud Credentials 등록 폼은 아직 동작하지 않는 상태다(등록 모달 미완성). 목록 조회만 확인한다.
  #
  # ⚠️ VPC 시나리오는 제거했다.
  #   cm-butterfly에는 VPC 전용 화면이 없다(/main/cloud-resources/vpc 는 실제로 404). Cloud Resources
  #   라우트는 cloud-credentials·apis 둘뿐이다. VPC는 독립 기능이 아니라 소스 모델로 타깃 모델을
  #   추천받을 때 그 추천 결과 *안에* 포함되는 정보라서, 별도로 다루는 화면·작업이 존재하지 않는다.
  #   없는 화면을 테스트가 붙들고 있지 않도록 시나리오를 걷어냈다.

  배경:
    먼저 "cmiguser"로 로그인한다

  @unit
  시나리오: CSP 자격증명 목록 조회
    만약 CSP 자격증명 화면을 열면
    그러면 CSP 자격증명 목록이 보인다
