# 三个平台分别构建；镜像仅包含前端，不打包数据库或后端。
FROM node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
ARG PLATFORM=student
# 服务协议为公开配置；必须由运营方提供实际地址和版本，空值保持注册关闭。
ARG VITE_TERMS_URL=
ARG VITE_TERMS_VERSION=
ENV VITE_TERMS_URL=$VITE_TERMS_URL
ENV VITE_TERMS_VERSION=$VITE_TERMS_VERSION
RUN case "$PLATFORM" in student|admin|partner) ;; *) exit 1 ;; esac \
    && npm run build -- --mode "$PLATFORM"

FROM nginxinc/nginx-unprivileged:stable-alpine@sha256:f5116ed4606f3eb015dd4a8e28cb9b351476dc0ad4bc6e9f93b19cec130cdf03
COPY deploy/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
ENV API_UPSTREAM=http://api:8080
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
