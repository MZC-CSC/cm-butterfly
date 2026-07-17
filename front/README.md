# 1. 프로젝트 구조
- 폴더구조
- store
# 2. 기술 스택, 라이브러리

- node — 버전은 [`.nvmrc`](.nvmrc) 가 정본이다 (아래 *3. 개발 환경 준비* 참조)
- vue 2.7
    - composition api
- pinia
- mirinae
    - https://github.com/cloudforet-io/mirinae
- postcss
- tailwind css
- vue-i18n
- vite.config

# 3. 개발 환경 준비

Node 버전은 [`.nvmrc`](.nvmrc) 하나로 관리한다. 이미지(`Dockerfile`)와 CI도 같은 값을 쓰므로, **로컬도 여기에 맞춰야 검증 결과가 어긋나지 않는다.**

```bash
cd front
nvm install   # .nvmrc 를 읽어 그 버전을 설치한다 (이미 있으면 건너뛴다)
nvm use       # 현재 셸을 그 버전으로 전환한다
npm ci        # package-lock.json 그대로 설치 (재현 가능한 설치)
```

알아 둘 점:

- **`.nvmrc` 가 있다고 node 가 자동으로 바뀌지는 않는다.** `nvm use` 를 직접 실행해야 하고, 셸을 새로 열 때마다 다시 해야 한다. (`cd` 만으로 전환되게 하려면 셸 훅을 따로 걸어야 한다)
- 더 높은 버전에서도 대체로 동작하지만, **이미지가 빌드되는 버전과 맞춰 두는 편이 안전하다.** 로컬만 다른 버전이면 로컬에서 통과한 것이 이미지에서도 통과한다고 말하기 어려워진다.
- 버전을 올릴 때는 `.nvmrc` 와 `Dockerfile` 의 `ARG NODE_VERSION` 을 **같은 값으로 함께** 고친다. 어긋나면 CI(Front E2E Gate)가 막는다.

# 4. API 연동
# 5. 공통 libs, utils
# 6. 코드 스타일 Lint, Prettier 설정

# 7. 환경변수

# 8. 빌드
