# CM-Butterfly Front 테스트 자동화 사용자 가이드

이 가이드는 cm-butterfly 프로젝트를 clone하여 E2E 테스트를 실행하고자 하는 사용자를 위한 문서입니다.

---

## 1. 사전 요구사항

### 1.1 시스템 요구사항

- **OS**: Ubuntu 20.04 이상 (또는 macOS, Windows WSL2)
- **Node.js**: v18 이상
- **Docker**: Docker Compose 포함
- **AWS CLI**: EC2 자동 생성 사용 시 필요

### 1.2 Node.js 설치 확인

```bash
node --version   # v18 이상
npm --version    # v9 이상
```

설치가 필요한 경우:
```bash
# Ubuntu
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

---

## 2. 환경 구축

### 2.1 cm-mayfly 설치 및 실행

cm-butterfly는 백엔드 마이크로서비스가 필요합니다. cm-mayfly로 한 번에 실행할 수 있습니다.

```bash
# cm-mayfly 클론
git clone https://github.com/cloud-barista/cm-mayfly.git
cd cm-mayfly

# 인프라 실행 (Docker 컨테이너 시작)
./mayfly infra run

# 실행 상태 확인
./mayfly infra info
```

실행되는 주요 서비스:
| 서비스 | 포트 | 설명 |
|--------|------|------|
| cm-butterfly | 80 | 웹 UI |
| cm-honeybee | 8081 | 소스 컴퓨팅 수집 |
| cm-beetle | 8056 | 인프라 마이그레이션 |
| cm-cicada | 8083 | 워크플로우 엔진 |

### 2.2 cm-butterfly 클론 및 테스트 환경 설정

```bash
# cm-butterfly 클론
git clone https://github.com/cloud-barista/cm-butterfly.git
cd cm-butterfly/front

# 의존성 설치
npm install

# Playwright 브라우저 설치
npx playwright install chromium

# (Ubuntu) 시스템 라이브러리 설치
npx playwright install-deps
```

---

## 3. 테스트 실행

### 3.1 기본 테스트 실행

Docker로 실행 중인 cm-butterfly(포트 80)를 대상으로 테스트합니다.

```bash
cd cm-butterfly/front

# 전체 테스트 실행
TEST_BASE_URL=http://localhost:80 npx playwright test

# 특정 테스트만 실행
TEST_BASE_URL=http://localhost:80 npx playwright test tests/e2e/auth/
TEST_BASE_URL=http://localhost:80 npx playwright test tests/e2e/migration/
```

### 3.2 EC2 서버 정보 지정

Source Services 테스트에는 SSH 접속 가능한 서버가 필요합니다.

```bash
# 기존 EC2 사용
TEST_BASE_URL=http://localhost:80 \
TEST_EC2_IP=1.2.3.4 \
TEST_EC2_USER=ec2-user \
TEST_EC2_SSH_KEY="$(cat ~/.ssh/my-key.pem)" \
npx playwright test tests/e2e/migration/
```

### 3.3 EC2 자동 생성 사용

EC2 정보를 지정하지 않으면 테스트 시작 시 자동으로 EC2를 생성하고, 종료 시 삭제합니다.

```bash
# AWS CLI 설정 확인
aws sts get-caller-identity

# EC2 자동 생성으로 테스트 실행
TEST_BASE_URL=http://localhost:80 npx playwright test tests/e2e/migration/
```

**AWS 필요 권한:**
- ec2:RunInstances, TerminateInstances
- ec2:CreateKeyPair, DeleteKeyPair
- ec2:Describe* (Instances, Images, Vpcs, Subnets, SecurityGroups)

---

## 4. 테스트 결과 확인

### 4.1 터미널 출력

테스트 실행 시 진행 상황이 터미널에 표시됩니다:
```
✓  1 [chromium] › login.spec.ts:15 › 로그인 테스트 › 정상 로그인 (3.2s)
✓  2 [chromium] › source-services.spec.ts:38 › Source Services 페이지 접속 (4.5s)
...
25 passed (2.9m)
```

### 4.2 HTML 리포트

```bash
# 리포트 열기
npx playwright show-report test-results/reports
```

### 4.3 스크린샷

테스트 중 캡처된 스크린샷은 `test-results/artifacts/` 디렉토리에 저장됩니다.

---

## 5. 테스트 시나리오

### 5.1 테스트 구성

| Phase | 테스트 파일 | 설명 |
|-------|-------------|------|
| 1 | auth/login.spec.ts | 로그인/로그아웃 |
| 2 | migration/source-services.spec.ts | Source Services, Connection, Collect |
| 3-1 | migration/source-models.spec.ts | Source Models |
| 3-2 | migration/target-models.spec.ts | Target Models |
| 4 | migration/workflows.spec.ts | Workflows (실행 제외) |

### 5.2 Cloud Migration 워크플로우

```
Source Services → Connection 추가 → Infra/SW Collect
       ↓
Source Models → Target Model 추천
       ↓
Target Models → 커스텀 설정
       ↓
Workflows → 생성 (실행은 비용 발생으로 제외)
```

---

## 6. 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| TEST_BASE_URL | http://localhost:5174 | 테스트 대상 URL |
| TEST_USERNAME | cmiguser | 로그인 사용자 |
| TEST_PASSWORD | cmiguserPassword! | 로그인 비밀번호 |
| TEST_EC2_IP | (자동 생성) | EC2 Public IP |
| TEST_EC2_USER | ec2-user | SSH 사용자 |
| TEST_EC2_SSH_KEY | (자동 생성) | SSH Private Key |

---

## 7. 문제 해결

### 7.1 브라우저 실행 실패

```bash
# Playwright 브라우저 재설치
npx playwright install chromium

# Ubuntu 시스템 라이브러리 설치
npx playwright install-deps
```

### 7.2 로그인 실패

1. cm-mayfly 실행 상태 확인: `./mayfly infra info`
2. 웹 UI 접속 확인: http://localhost:80
3. 사용자 정보 확인: TEST_USERNAME, TEST_PASSWORD

### 7.3 EC2 자동 생성 실패

```bash
# AWS CLI 설정 확인
aws sts get-caller-identity

# IAM 권한 확인
aws ec2 describe-instances --region ap-northeast-2
```

---

## 8. 종료

```bash
# cm-mayfly 인프라 중지
cd cm-mayfly
./mayfly infra stop
```

---

*마지막 업데이트: 2026-01-15*
