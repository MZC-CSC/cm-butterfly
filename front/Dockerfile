# front/.nvmrc is the single source of truth for the Node version. The default below
# **must match** .nvmrc; if it differs, the image build is blocked (cm-butterfly's Front
# E2E Gate and onecloud-ci's pre-build check). When you bump .nvmrc, bump this default too.
#
# Why keep a default: upstream (cloud-barista) CD and a plain `docker build` do not pass
# a build-arg, so without a default those builds break.
ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./

# Install exactly the tree that lock pins. npm install can reinterpret and update the lock,
# so the image could be built with packages that differ from dev and CI — that amounts to
# copying the lock and then ignoring it. devDependencies are installed too (vite, used by
# npm run build below, is a devDependency).
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

# Do not run as root. It still listens on port 80 — Docker defaults
# net.ipv4.ip_unprivileged_port_start=0 inside the container, so an unprivileged user can
# bind 80, and thus compose's port mapping and the way it runs do not change.
#
# All that's needed is ownership of the paths nginx uses. For the pid, /var/run is a symlink
# to /run so changing ownership doesn't stick, so move it to the writable /tmp.
RUN mkdir -p /var/cache/nginx \
 && chown -R nginx:nginx /var/cache/nginx /etc/nginx/conf.d /usr/share/nginx/html /app \
 && sed -i 's|^pid .*|pid /tmp/nginx.pid;|' /etc/nginx/nginx.conf \
 && sed -i '/^user /d' /etc/nginx/nginx.conf

USER nginx

EXPOSE 80

ENTRYPOINT ["./entrypoint.sh"]
