# language: ko
@source @migration
기능: 소스 서비스 (소스 컴퓨팅)
  온프렘/기존 인프라를 마이그레이션 대상으로 등록하기 위해 소스그룹·연결정보를 만들고,
  연결된 서버의 인프라 정보를 수집(cm-honeybee)한다.

  배경:
    먼저 "cmiguser"로 로그인한다

  @unit
  시나리오: 소스그룹 생성
    먼저 소스 서비스 화면을 연다
    만약 "e2e-src-group" 이름으로 소스그룹을 생성하면
    그러면 소스그룹 목록에 "e2e-src-group" 이(가) 보인다

  @unit
  시나리오: 연결정보 등록
    먼저 소스 서비스 화면을 연다
    만약 "e2e-conn-group" 소스그룹에 "e2e-conn" 연결정보를 등록하면
    그러면 소스그룹 목록에 "e2e-conn-group" 이(가) 보인다
    그리고 "e2e-conn-group" 소스그룹을 선택한다
    그리고 "e2e-conn" 연결정보를 선택한다
    그러면 연결정보 목록에 "e2e-conn" 이(가) 보인다

  @unit
  시나리오: 수집 실행 (인프라 수집 결과 확인)
    먼저 소스 서비스 화면을 연다
    만약 "e2e-collect-group" 소스그룹에 "e2e-collect-conn" 연결정보를 등록하면
    그리고 "e2e-collect-group" 소스그룹을 선택한다
    그리고 인프라 수집을 실행하면
    그러면 인프라 수집 결과가 조회된다
