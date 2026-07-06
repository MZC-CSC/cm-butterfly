# language: ko
@navigation
기능: 상단 메뉴 네비게이션
  로그인 후 상단 5개 메뉴 카테고리 화면이 라우팅 오류 없이 정상 로드되는지 확인한다(라우팅 스모크).

  배경:
    먼저 "cmiguser"로 로그인한다

  @smoke @unit
  시나리오 개요: 각 메뉴 카테고리 화면이 정상 로드된다
    만약 "<카테고리>" 메뉴로 이동하면
    그러면 "<카테고리>" 화면이 보인다

    예:
      | 카테고리             |
      | Source Computing   |
      | Models             |
      | Workflow Management |
      | Workload Operations |
      | Cloud Resources    |
