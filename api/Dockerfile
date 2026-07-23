## Stage 1 - Go Build Env
FROM golang:1.26-alpine AS build

RUN apk add --no-cache gcc libc-dev musl-dev

ENV GOPROXY=http://proxy.golang.org
ENV CGO_ENABLED=0

RUN mkdir -p /src/cm-butterfly
WORKDIR /src/cm-butterfly
# ADD does more than copy local files — it also downloads URLs and auto-extracts
# archives — so for a spot where you just need to drop the source in as-is, use COPY
# (only what you intend happens).
COPY . .

RUN go mod download
RUN go build -ldflags="-s -w" -o /src/cm-butterfly/butterfly ./cmd/app/main.go

## Stage 2 - Application Deploy
#
# It's a static binary (CGO_ENABLED=0), so the runtime base has no libc dependency.
# The build stage is already alpine, and cb-tumblebug, cm-honeybee, and cm-butterfly
# front use alpine too. The previously used debian:buster-slim is Debian 10, which is
# EOL — its apt repositories have gone down, so even installing packages no longer works.
FROM alpine:3.20 AS deploy

# Root certificates are needed for outbound TLS calls (a static binary does not bundle these).
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
# POSTGRES_PASSWORD has no default. If set here, the value gets baked into the image
# metadata, visible as-is via `docker inspect`, and left behind in public repositories.
# Inject the value at runtime (compose's environment / env_file). If it isn't injected,
# the app fails to connect and the problem surfaces.
ENV POSTGRES_DATABASE_HOST=${POSTGRES_DATABASE_HOST:-cm-butterfly-db}
ENV POSTGRES_PORT=${POSTGRES_PORT:-5432}
ENV POSTGRES_DB=${POSTGRES_DB:-butterfly-db}

# Do not run as root. The app creates user.dat under conf/ at startup, so hand over
# ownership of /app. Port 4000 is an unprivileged port, so no extra port-related setup is needed.
RUN addgroup -S butterfly && adduser -S -G butterfly butterfly \
 && chown -R butterfly:butterfly /app

USER butterfly

EXPOSE 4000

CMD ["/app/butterfly"]
