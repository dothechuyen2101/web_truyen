# syntax=docker/dockerfile:1.7
# Hai image: `web` (Next.js standalone) và `worker` (crawler BullMQ, cũng dùng để chạy migrate/seed).

FROM node:22-alpine AS base
# openssl: Prisma CLI (migrate) cần khi chạy trên Alpine.
# COREPACK_HOME dùng chung để user `node` (image worker) chạy được pnpm mà không phải tải lại.
ENV COREPACK_HOME=/opt/corepack CI=true NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
# (Tuỳ chọn) mạng có proxy/antivirus giải mã TLS: thêm chứng chỉ gốc của nó khi build
#   docker build --secret id=extra_ca,src=ca.pem …
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then cat /run/secrets/extra_ca >> /etc/ssl/certs/ca-certificates.crt; fi \
    && apk add --no-cache openssl \
    && corepack enable pnpm \
    && corepack prepare pnpm@12.16.1 --activate \
    && chmod -R a+rwX /opt/corepack
WORKDIR /app

# ---------- Chỉ các file khai báo dependency (để cache bước cài đặt theo lockfile) ----------
FROM base AS manifests
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/crawler/package.json packages/crawler/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/prisma.config.ts packages/db/
COPY packages/db/prisma packages/db/prisma

# postinstall của @truyen/db chạy `prisma generate` — chỉ cần một DATABASE_URL hợp lệ về cú pháp.
# Mỗi image chỉ cài dependency của chính nó (worker không cần Next/React).
FROM manifests AS deps-web
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm install --frozen-lockfile --filter "@truyen/web..."

FROM manifests AS deps-worker
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm install --frozen-lockfile --filter "@truyen/worker..."

# ---------- Build web ----------
FROM deps-web AS build
COPY . .
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm --filter @truyen/db generate
# next build prerender trang chủ/sitemap nên cần kết nối Postgres (build với network: host).
# .env được mount dạng secret (không nằm lại trong image); IMAGE_PROXY_SECRET phải trùng lúc chạy.
ARG BUILD_DATABASE_URL=""
RUN --mount=type=secret,id=dotenv,target=/app/.env \
    if [ -n "$BUILD_DATABASE_URL" ]; then export DATABASE_URL="$BUILD_DATABASE_URL"; fi; \
    pnpm --filter @truyen/web build

# ---------- Image web ----------
FROM node:22-alpine AS web
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "apps/web/server.js"]

# ---------- Image worker ----------
FROM deps-worker AS worker
COPY tsconfig.base.json ./
COPY packages packages
COPY apps/worker apps/worker
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm --filter @truyen/db generate
ENV NODE_ENV=production
# Worker không ghi gì vào /app nên chỉ cần quyền đọc — không chown (rất chậm và nhân đôi layer).
USER node
CMD ["pnpm", "--filter", "@truyen/worker", "start"]
