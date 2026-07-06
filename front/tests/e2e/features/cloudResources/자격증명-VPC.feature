# language: ko
@cloudResources
기능: 클라우드 리소스 — CSP 자격증명·VPC
  cm-butterfly가 cb-spider(자격증명)·cb-tumblebug(VPC)을 통해
  클라우드 리소스를 등록·조회·삭제한다. 자격증명은 이후 마이그레이션의 전제조건이다.

  배경:
    먼저 "cmiguser"로 로그인한다

  @unit
  시나리오: CSP 자격증명 목록 조회
    만약 CSP 자격증명 화면을 열면
    그러면 CSP 자격증명 목록이 보인다

  @unit
  시나리오: CSP 자격증명 등록
    그리고 "aws" CSP 자격증명을 등록한다
    그러면 "aws" 자격증명이 목록에 있다

  @unit
  시나리오: CSP 자격증명 해제
    그리고 "aws" CSP 자격증명을 등록한다
    만약 "aws" CSP 자격증명을 해제하면
    그러면 "aws" 자격증명이 목록에서 사라진다

  @unit
  시나리오: VPC 목록 조회
    먼저 VPC 화면을 연다
    그러면 VPC 목록이 보인다

  @unit
  시나리오: VPC 삭제
    먼저 VPC 화면을 연다
    만약 "e2e-vpc" VPC를 삭제하면
    그러면 "e2e-vpc" VPC가 목록에서 사라진다
