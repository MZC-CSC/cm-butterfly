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
FROM debian:buster-slim AS deploy

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

EXPOSE 4000

CMD ["/app/butterfly"]
