# Node 버전은 front/.nvmrc 가 단일 출처다. 아래 기본값은 .nvmrc 와 **같아야 하며**,
# 다르면 이미지 빌드가 차단된다(cm-butterfly 의 Front E2E Gate, onecloud-ci 의 빌드 전 검사).
# .nvmrc 를 올리면 이 기본값도 함께 올린다.
#
# 기본값을 두는 이유: 업스트림(cloud-barista) CD 와 일반 `docker build` 는 build-arg 를
# 넘기지 않으므로, 기본값이 없으면 그쪽 빌드가 깨진다.
ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./

# lock 이 고정한 트리를 그대로 설치한다. npm install 은 lock 을 재해석·갱신할 수 있어
# 이미지가 개발·CI 와 다른 패키지로 빌드될 수 있다 — lock 을 복사해 놓고 무시하는 셈이 된다.
# devDependencies 도 함께 깔린다(아래 npm run build 의 vite 가 devDependency 다).
RUN npm ci

COPY . .

ARG VITE_BACKEND_URL=http://localhost:3000
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}
ENV VITE_BACKEND_ENDPOINT=/api
ENV VITE_PROJECT_NAME=MIGRATOR
ENV VITE_LANGUAGE='en'

RUN npm run build

## Stage 2: Run Build Application
FROM nginx:stable-alpine AS deploy

WORKDIR /app

COPY --from=build /app/nginx.conf /etc/nginx/conf.d
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /app/entrypoint.sh /app/entrypoint.sh
RUN rm /etc/nginx/conf.d/default.conf

RUN chmod +x /app/entrypoint.sh

EXPOSE 80

ENTRYPOINT ["./entrypoint.sh"]
