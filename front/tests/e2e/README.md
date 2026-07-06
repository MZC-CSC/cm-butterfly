# cm-butterfly E2E 테스트 프레임워크 — 설계 문서 (Playwright + BDD/Gherkin, 한국어)

> **목적**: 특정 기능이 추가·변경될 때 그 동작을 **한국어로 정의**하면, 그 정의가 **그대로 자동 테스트로 실행**되는 구조. 소스가 바뀌어도 시나리오(한국어)는 유지하고 *구현 계층 한 곳*만 고치면 되도록 설계한다.
>
> | 항목 | 내용 |
> |------|------|
> | 프레임워크 | Playwright + [playwright-bdd](https://vitalets.github.io/playwright-bdd/) (Gherkin) |
> | 정의 언어 | 한국어 Gherkin (`# language: ko`) |
> | 대상 | cm-butterfly front (FSD, Vue 2) — 배포된 웹 콘솔 |
> | 테스트 종류 | 기능(유닛) 테스트 + 시나리오(E2E) 테스트 |
> | 작성 | 2026-07-05 (테스트 자동화 · BAR-875·BAR-879·BAR-880) |

---

## 1. 철학 — 왜 BDD(Gherkin)인가

우리 요구는 "① 사람이 한국어로 동작을 정의 → ② 자동 실행 → ③ 소스 변경 시 유지보수 쉬움"이다. 이것은 **BDD(행위 주도 개발)** 가 정확히 푸는 문제다.

- Gherkin `.feature` 파일은 **한국어를 정식 지원**한다(`기능`, `배경`, `시나리오`, `시나리오 개요`, `먼저/만약/그러면/그리고/하지만`).
- `playwright-bdd`가 `.feature`(한국어) → Playwright 테스트로 **자동 변환·실행**한다.
- 시나리오 문장은 *의도(무엇을)* 만 담고, *구현(어디서/어떻게)* 는 **스텝 정의 + Page Object**에 둔다. → 화면이 바뀌어도 시나리오는 그대로, 구현 1곳만 수정.

---

## 2. ★ 핵심 — 3계층 분리 ("로그인한다"가 어느 화면인지 어떻게 아는가)

시나리오 문장에는 화면 위치가 없다. **위치·요소는 아래 2·3계층에 명시적으로** 있다. 이 분리가 유지보수성의 핵심이다.

```
① 시나리오 (.feature, 한국어)   ← 사람이 읽고 쓰는 "의도"
     먼저 "cmiguser"로 로그인한다
              │  (문장 패턴으로 매칭)
              ▼
② 스텝 정의 (steps/*.ts)        ← 문장 ↔ 액션 연결. "어느 화면인지"를 여기서 연결
     Given('{string}로 로그인한다', async ({ page }, id) => {
       const login = new LoginPage(page);
       await login.goto();          // ← 로그인 화면으로 이동
       await login.login(id, pw);
     });
              │
              ▼
③ Page Object (pages/*.ts)      ← "어디(URL)/어떻게(셀렉터)"를 명시. 소스 변경 시 여기만 수정
     class LoginPage {
       static path = '/auth/login';                 // ★ 화면 위치(어디)
       idInput = getByTestId('login-id') || placeholder('id');  // ★ 요소(어떻게)
     }
```

- **"일반 단어 vs 화면 위치"의 구분**: 시나리오는 일반 단어(의도)만. 화면 위치(URL)와 요소(셀렉터)는 **Page Object가 유일한 출처**. 그래서 시나리오는 안정적이고, 화면 변경의 충격은 Page Object 한 곳에 격리된다.
- 필요하면 시나리오 문장에 **화면 이름을 명시**해 가독성을 높인다: `소스 서비스 화면에서 nano 소스서버를 등록한다` — 사람에겐 "어디"가 보이고, 스텝 정의가 그 화면의 Page Object로 연결한다.

---

## 3. 기능(유닛) 테스트 vs 시나리오(E2E) 테스트

둘 다 지원하며 **같은 스텝을 재사용**한다.

| 구분 | 정의 위치 | 태그 | 성격 | 예 |
|------|----------|------|------|-----|
| **기능(유닛) 테스트** | `features/{도메인}/*.feature` | `@unit` | 한 기능만 독립 검증(다른 기능 의존 최소) | "로그인 성공/실패", "소스그룹 생성", "VPC 삭제" |
| **시나리오(E2E) 테스트** | `features/scenarios/*.feature` | `@scenario @e2e` | 여러 기능을 실제 사용 흐름으로 조립 | "인프라 마이그레이션 전체(로그인→수집→추천→워크플로우→EC2)" |

- **관계**: 시나리오는 기능 스텝을 **재사용**해 조립한다(중복 구현 없음). 기능 테스트가 통과하면 그 스텝은 시나리오에서도 신뢰할 수 있다.
- **선택 실행**: 태그로 부분 실행. 전부 돌릴 필요 없음.
  - `@smoke` — 릴리스 전 최소 확인
  - `@unit` — 기능 단위 회귀
  - `@scenario`/`@e2e` — 전체 흐름
  - 도메인 태그: `@auth @source @models @workflow @workload @cloudResources @migration`

---

## 4. 디렉토리 구조

```
front/tests/e2e/
├─ README.md                     ← (이 문서) 설계 정본
├─ playwright.config.ts          ← playwright-bdd 통합 설정
├─ features/                     ← ★ 한국어 Gherkin (사람이 정의)
│   ├─ auth/로그인.feature          @unit @smoke @auth
│   ├─ source/소스서비스.feature      @unit @source @migration
│   ├─ models/소스모델.feature        @unit @models @migration
│   ├─ models/추천-타깃모델.feature    @unit @models @migration
│   ├─ workflow/워크플로우.feature      @unit @workflow
│   ├─ workload/워크로드-MCI.feature    @unit @workload
│   ├─ cloudResources/자격증명-VPC.feature @unit @cloudResources
│   ├─ navigation/네비게이션.feature    @unit @smoke
│   └─ scenarios/인프라마이그레이션.feature  @scenario @e2e @migration
├─ steps/                        ← 한국어 스텝 → 액션 (도메인별, 재사용)
│   ├─ common.steps.ts             공통(로그인/네비/공용 확인)
│   ├─ auth.steps.ts
│   ├─ source.steps.ts
│   ├─ models.steps.ts
│   ├─ workflow.steps.ts
│   ├─ workload.steps.ts
│   └─ cloudResources.steps.ts
├─ pages/                        ← Page Object (URL + data-testid 셀렉터 중앙화)
│   ├─ login.page.ts
│   ├─ sourceServices.page.ts
│   ├─ models.page.ts
│   ├─ workflow.page.ts
│   ├─ workload.page.ts
│   └─ cloudResources.page.ts
├─ fixtures/
│   └─ test-data.ts               ← 계정·네임스페이스·소스/타깃 스펙 등 데이터
└─ support/
    ├─ fixtures.ts                ← playwright-bdd test 확장
    └─ world.ts (선택)            ← 시나리오 전역 상태(생성된 리소스 ID 등)
```

---

## 5. 컨벤션 (유지보수 규칙)

1. **한국어 Gherkin** — `# language: ko` 첫 줄 필수. 키워드: `기능`/`시나리오`/`시나리오 개요`/`배경`/`먼저`/`만약`/`그러면`/`그리고`/`하지만`.
2. **셀렉터는 data-testid 우선** — 프론트 요소에 `data-testid`를 부여(BAR-880)하고 Page Object는 `getByTestId(...)`를 쓴다. 미부여 구간은 `.or(placeholder/role)` fallback으로 두되, 부여 후 fallback 제거. **텍스트·클래스·nth 셀렉터 지양**(다국어·소스 변경에 취약).
3. **Page Object가 화면 위치의 유일 출처** — URL/셀렉터는 `pages/`에만. 스텝·시나리오에 URL·CSS 셀렉터 하드코딩 금지.
4. **스텝은 재사용 가능하게** — `"{string}로 로그인한다"`처럼 파라미터화. 도메인별 파일로 분리. 시나리오는 기능 스텝을 조립.
5. **데이터는 fixtures/test-data.ts + 환경변수** — 계정·리소스명·스펙은 코드에 흩지 말고 한곳에. 민감정보(키·비밀번호)는 env.
6. **생성 리소스는 정리(teardown)** — 시나리오가 만든 소스서비스·워크플로우·EC2는 `@scenario` 종료 시 삭제/중지(요금 방지). 전역 상태는 `support/world.ts`.
7. **API 검증 스텝(선택)** — UI 확인에 더해 백엔드 응답을 검증하려면 `request` 픽스처로 operationId 응답을 확인(예: `ListInfra` 200·응답 키). 서브프레임워크 소스 기준.

---

## 6. 새 기능 추가 시 절차 (개발자 워크플로우)

1. `features/{도메인}/{기능}.feature`에 **한국어로 동작 정의**(적절한 태그).
2. 새로 필요한 문장이 있으면 `steps/{도메인}.steps.ts`에 **스텝 정의 추가**(기존 스텝 최대 재사용).
3. 새 화면·요소면 `pages/{도메인}.page.ts`에 **URL·셀렉터 추가**(+ 프론트에 `data-testid` 부여).
4. `npx bddgen && npx playwright test --grep @{도메인}` 로 확인.
5. 시나리오에 편입할 기능이면 `features/scenarios/*.feature`에서 그 스텝을 조립.

→ 소스가 바뀌면 대개 **3(Page Object)** 만 수정. 시나리오(1)는 그대로.

---

## 7. 실행 방법

```bash
# 준비 (최초 1회)
npm install --legacy-peer-deps          # playwright-bdd·@playwright/test 포함
npx playwright install --with-deps chromium

# .feature → 테스트 생성 후 실행
npx bddgen                              # Gherkin → Playwright 스펙 생성(.features-gen)
npx playwright test                     # 전체
npx playwright test --grep @smoke       # 스모크만
npx playwright test --grep @migration   # 마이그레이션 도메인
npx playwright test --grep "@scenario"  # 전체 시나리오
BASE_URL=http://<your-cm-mayfly-server> npx playwright test   # 대상 서버 지정(cm-mayfly로 기동한 인프라 서버 주소)
```

환경변수(`fixtures/test-data.ts`가 읽음): `BASE_URL`(기본 `http://localhost`), `TEST_USERNAME`/`TEST_PASSWORD`(기본 cmiguser), 소스/타깃 스펙 등.

---

## 8. 대상 환경

| 환경 | BASE_URL | 용도 |
|------|----------|------|
| 로컬 dev | `http://localhost:5173` (vite) | 개발 중 빠른 확인 |
| 로컬 docker | `http://localhost` (nginx) | 배포 형태 확인 |
| 배포 서버 | `http://<your-cm-mayfly-server>` | cm-mayfly로 기동한 인프라 서버의 butterfly 회귀 |

> Playwright는 원격 서버에서 headless로도, 로컬에서 headed(UI 모드)로도 실행 가능. UI 모드(`--ui`)·디버깅은 로컬 권장.

---

## 9. 기존 자산 활용·이관

- **테스트 계획서의 TC 목록** → 기능 `.feature`로 이관(TC-AUTH·프로젝트·워크플로우·클라우드리소스·모델).
- **기존 spec 기반 e2e**(`feature/add-e2e-test-jsyoo`: login·source·models·target·workflows·navigation) → 스텝/Page Object로 재구성. 로그인의 과도한 세부 케이스는 `@smoke` 최소만 남기고 생략.
- **릴리스 테스트 시나리오·md 문서** → 시나리오 `.feature` 근거.
- **서브프레임워크 소스**(cm-honeybee·cm-beetle·cb-tumblebug·cm-ant·cm-cicada) → API 검증 스텝의 응답 키 기준.
- **공식 v0.6.0 시나리오**(cloud-migrator `docs/v0.6.0-user-scenario-*`) → 마이그레이션 시나리오의 단계 순서 근거.

---

## 10. 플래그십 시나리오 — 인프라 마이그레이션 (워크플로우 실행→EC2, 신규)

기존 e2e에 없던 **워크플로우 실행·EC2 프로비저닝**을 최종 시나리오로 추가한다. 현행화(MCI→Infra·beetle 라우팅·cicada type/spec) 반영.

```gherkin
# language: ko
기능: 인프라 마이그레이션 (전체 흐름)

  @scenario @e2e @migration
  시나리오: 온프렘 소스를 저비용 클라우드 인프라로 마이그레이션하고 인스턴스 생성 확인
    먼저 "cmiguser"로 로그인한다
    그리고 소스 서비스에 nano 소스서버를 등록한다
    그리고 소스 인프라를 수집한다
    그리고 수집된 정보를 소스 모델로 저장한다
    만약 타깃 인프라를 "small급 저비용"으로 추천받아 타깃 모델로 저장하면
    그리고 마이그레이션 워크플로우를 생성하고 실행하면
    그러면 타깃 EC2 인스턴스가 정상 생성된다
    그리고 생성된 인스턴스를 중지한다
    그리고 생성된 리소스를 정리한다
```

> 비용 보호: 타깃 스펙은 nano/small급으로 강제하고, 생성 인스턴스는 시나리오 종료 시 **중지(stop)**. `terminate`는 금지, 정리 스텝에서 명시적으로 처리.

---

## 11. (별도 레이어) 백엔드 단위 테스트

프론트 BDD와 별개로, 순수 로직/API 단위는 표준 도구로 둔다(계획서 "백엔드 테스트 자동화"):
- Go(api): `go test ./...` — 핸들러·프록시(api_proxy)·auth 단위.
- front util/컴포저블: Vitest — operationId 봉투 빌더·응답 언래핑 등 순수 함수.

BDD(e2e)는 *사용자 행위·통합 흐름*을, 단위 테스트는 *내부 로직*을 담당하는 2층 구조.
