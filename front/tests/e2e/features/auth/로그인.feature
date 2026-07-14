# language: ko
@auth
기능: 로그인
  사용자가 cm-butterfly 콘솔을 사용하기 위해 인증한다.

  @unit @smoke
  시나리오: 유효한 자격증명으로 로그인 성공
    먼저 "cmiguser"로 로그인한다
    그러면 메인 화면이 보인다

  @unit
  시나리오: 잘못된 비밀번호로 로그인 실패
    먼저 로그인 화면을 연다
    만약 "cmiguser"와 "wrong-password"로 로그인을 시도하면
    그러면 로그인에 실패하고 로그인 화면에 머문다
