# cm-butterfly E2E 테스트

한국어로 동작을 정의하면 그 정의가 **그대로 자동 테스트로 실행**된다.
(Playwright + [playwright-bdd](https://vitalets.github.io/playwright-bdd/), 한국어 Gherkin)

```gherkin
# language: ko
시나리오: 온프렘 소스를 저비용 클라우드로 마이그레이션하고 소프트웨어까지 옮겨 부하테스트를 확인
  먼저 "cmiguser"로 로그인한다
  그리고 소스 서비스에 "e2e-scn-source" 소스서버를 등록한다
  그리고 소스 인프라를 수집한다
  ...
  만약 "e2e-scn-sw-target" 타깃 SW 모델로 소프트웨어 마이그레이션 워크플로우를 생성하고 실행하면
  그러면 소스의 소프트웨어가 타깃 노드에 설치된다
```

---

## 빠른 시작

```bash
cd front
nvm install && nvm use                               # node 버전은 .nvmrc 가 정본 (셸마다 nvm use)
npm ci
npx playwright install --with-deps chromium

export BASE_URL=http://cmig.dev.cscmzc.com           # 대상 콘솔
export TEST_SOURCE_IP=<소스 VM 공인 IP>               # ★ 실제 SSH 가능한 VM 이어야 한다
export TEST_SOURCE_PRIVATE_KEY="$(cat e2e-source-key)"

npx bddgen --config tests/e2e/playwright.config.ts    # .feature → 테스트 생성
npx playwright test --config=tests/e2e/playwright.config.ts

npx playwright show-report playwright-report           # 결과·화면·영상 보기
```

기본 실행은 **seed + functional** 이다. 실제 클라우드 자원을 만드는 것은 빠져 있다.

```bash
# 전체 시나리오 — 실제 EC2를 만든다 (요금 발생)
E2E_INCLUDE_COSTLY=1 npx playwright test --config=tests/e2e/playwright.config.ts --project=scenario
```

> ⚠️ **소스 서버 VM 이 없으면 대부분 실패한다.** cm-honeybee 가 그 서버에 SSH로 붙어 수집하기 때문이다.
> 준비 방법 → [01-설치](docs/01-설치.md)
>
> ⚠️ **소스 서버에 옮길 소프트웨어가 있어야 한다.** 소프트웨어 마이그레이션은 "소스에서 돌던 것이
> 타깃으로 옮겨졌는가"를 확인하므로, 빈 서버로 돌리면 아무것도 증명하지 못한다.
> `TEST_SOURCE_IP=… TEST_SOURCE_KEY=… ./scripts/prepare-source-server.sh` (nginx 설치)

---

## 📚 문서

| 문서 | 내용 |
|------|------|
| [01-설치](docs/01-설치.md) | 의존성 · **소스 서버 VM 준비**(가장 자주 빠뜨림) · 전용 SSH 키 |
| [02-실행](docs/02-실행.md) | seed → functional / scenario 3단 구성 · 태그 · 요금 주의 |
| [03-환경설정](docs/03-환경설정.md) | 환경변수 전체 · **네임스페이스는 `mig01`** · RUN_ID |
| [04-디버깅](docs/04-디버깅.md) | 리포트 · trace · **자주 나는 실패와 원인** |
| [05-증거와리포트](docs/05-증거와리포트.md) | **성공한 테스트도 화면·영상을 남기는 이유** |
| [06-테스트작성](docs/06-테스트작성.md) | 3계층 구조 · **폴백 금지 · testid 원칙 · 거짓 통과 경계** |
| [07-설계배경](docs/07-설계배경.md) | 왜 BDD인가 · 초기 설계 정본 |
| [08-주의사항](docs/08-주의사항.md) | **3분류(더미 `@dummy`/기능/시나리오)** · 에이전트별 반복 실수(cm-beetle 인프라 이름 · cm-cicada 워크플로우 이름/request_body · **추천 후보 스펙·이미지 충전**) |

---

## 구성

```
seed ─┬─→ functional      (Playwright project dependencies 로 순서를 명시)
      └─→ scenario
```

| 프로젝트 | 무엇 | 기본 실행 |
|----------|------|:--------:|
| **seed** | 기능 테스트가 딛고 설 데이터를 실제로 만든다(소스 수집 → 소스모델 → 요금 안전 워크플로우) | ✅ |
| **functional** | 화면별 기능 검증 `@unit` | ✅ |
| **scenario** | 마이그레이션 전체 흐름. **실제 EC2 생성** `@costly` | ❌ 옵트인 |

`@unit` 은 **mock 없이 실제 연계 프레임워크를 친다.** 연계 프레임워크의 계약이 깨지는 걸 잡는 게 목적이라서다.
그래서 소스 모델·워크플로우가 *실제로 있어야* 하고, 그걸 seed 가 만든다.

---

## 3계층 — 화면이 바뀌면 어디를 고치나

```
① .feature (한국어)   ← 의도.         화면이 바뀌어도 그대로 둔다
② steps/*.ts          ← 문장 ↔ 액션
③ pages/*.ts          ← URL · 셀렉터.  화면이 바뀌면 여기만 고친다
```

---

## ★ 이 프로젝트가 지키는 것

1. **폴백 금지** — `@unit`·`@scenario` 는 mock·더미로 덮지 않는다. **실패는 실패로 드러낸다.**
   (예전엔 추천이 실패하면 더미 데이터로 채웠다. cm-grasshopper 가 죽어도 화면엔 그럴듯한 추천이 떴다.)
2. **안정성은 `data-testid` 로** — 화면 문구에 기대지 않는다. testid 가 없으면 **화면 소스에 부여한다.**
3. **거짓 통과 경계** — "행이 보인다" ≠ "이번 실행이 만들었다".
   실제로 *노드가 죽은 인프라*를 보고 "EC2 생성 성공"으로 통과하던 적이 있다.
4. **증거를 남긴다** — 성공한 테스트도 시작/종료 화면·영상·trace 를 남긴다. **PASS 한 줄은 증거가 아니다.**
5. **요금 보호** — 추천은 small급 이하 강제, 실제 자원 생성은 `@costly` 옵트인, 시나리오는 끝에 정리.
