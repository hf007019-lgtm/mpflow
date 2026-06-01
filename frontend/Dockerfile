# 阶段 1：安装依赖（仅下载包，禁用一切 postinstall 防挂死）
FROM node:22-slim AS deps
WORKDIR /app
ENV NODE_OPTIONS="--max-old-space-size=4096"
COPY package.json package-lock.json* ./
RUN npm ci \
    --ignore-scripts \
    --prefer-offline \
    --no-audit \
    --no-fund \
    --loglevel=error \
    --fetch-timeout=120000 \
    --fetch-retries=2

# 阶段 2：编译构建
FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

# Prisma 引擎下载专属环境变量：镜像源 + 跳过校验缺失 + 超时
ENV PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
ENV PRISMA_ENGINES_DOWNLOAD_TIMEOUT=180

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL

ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV DATABASE_URL=file:./prisma/dev.db

# 手动执行 Prisma 生成（postinstall 已在 deps 阶段被跳过，在此显式完成）
RUN npx prisma generate
RUN npm run build
# Build the database schema into the image at build time (root user — no EACCES)
RUN npx prisma db push --accept-data-loss

# 阶段 3：生产运行环境
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Copy Prisma directory (includes pre-built dev.db with all tables)
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
