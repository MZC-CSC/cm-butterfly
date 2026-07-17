## Stage 1 - Go Build Env
FROM golang:1.26-alpine AS build

RUN apk add --no-cache gcc libc-dev musl-dev

ENV GOPROXY=http://proxy.golang.org
ENV CGO_ENABLED=0

RUN mkdir -p /src/cm-butterfly
WORKDIR /src/cm-butterfly
ADD . .

RUN go mod download
RUN go build -ldflags="-s -w" -o /src/cm-butterfly/butterfly ./cmd/app/main.go

## Stage 2 - Application Deploy
#
# 정적 바이너리(CGO_ENABLED=0)라 런타임 베이스에 libc 의존이 없다. build 스테이지가 이미
# alpine 이고, cb-tumblebug·cm-honeybee·cm-butterfly front 도 alpine 을 쓴다.
# 직전까지 쓰던 debian:buster-slim 은 Debian 10 으로 EOL 이라 apt 저장소가 내려가
# 패키지 설치조차 되지 않는 상태였다.
FROM alpine:3.20 AS deploy

# TLS 로 나가는 호출을 위해 루트 인증서가 필요하다(정적 바이너리는 이것까지 담지 않는다).
RUN apk add --no-cache ca-certificates

WORKDIR /app

COPY --from=build /src/cm-butterfly/butterfly .
COPY --from=build /src/cm-butterfly/conf ./conf/

ENV API_ADDR=${API_ADDR:-0.0.0.0}
ENV API_PORT=${API_PORT:-4000}
ENV USER_AUTH_DATA_PATH=${USER_AUTH_DATA_PATH:-conf/user.dat}
ENV USER_AUTH_CONF_PATH=${USER_AUTH_CONF_PATH:-conf/authsetting.yaml}
ENV MENU_CONF_DATA_PATH=${MENU_CONF_DATA_PATH:-conf/menu.yaml}

ENV POSTGRES_USER=${POSTGRES_USER:-butterflyadmin}
# POSTGRES_PASSWORD 는 기본값을 두지 않는다. 여기에 적으면 그 값이 이미지 메타데이터로 구워져
# `docker inspect` 로 그대로 보이고, 공개 저장소에도 남는다. 값은 실행 시점에 주입한다
# (compose 의 environment / env_file). 주입하지 않으면 앱이 연결에 실패해 문제가 드러난다.
ENV POSTGRES_DATABASE_HOST=${POSTGRES_DATABASE_HOST:-cm-butterfly-db}
ENV POSTGRES_PORT=${POSTGRES_PORT:-5432}
ENV POSTGRES_DB=${POSTGRES_DB:-butterfly-db}

# root 로 돌지 않는다. 앱이 기동 시 conf/ 에 user.dat 를 만들므로 /app 소유권을 넘긴다.
# 4000 번은 비특권 포트라 포트 관련 추가 설정은 필요 없다.
RUN addgroup -S butterfly && adduser -S -G butterfly butterfly \
 && chown -R butterfly:butterfly /app

USER butterfly

EXPOSE 4000

CMD ["/app/butterfly"]
