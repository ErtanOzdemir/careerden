# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /workspace

FROM base AS pruner

RUN pnpm add --global turbo@2.9.18

COPY . .

RUN turbo prune @careerden/documents-worker --docker --out-dir /workspace/out

FROM base AS builder

COPY --from=pruner /workspace/out/json/ ./
COPY --from=pruner /workspace/tsconfig.base.json ./tsconfig.base.json

RUN --mount=type=cache,id=careerden-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY --from=pruner /workspace/out/full/ ./

RUN pnpm turbo run build --filter=@careerden/documents-worker
RUN pnpm --filter=@careerden/documents-worker --prod deploy /prod/app

FROM node:22-bookworm-slim AS runner

ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

RUN apt-get update \
    && apt-get install --yes --no-install-recommends tini \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder --chown=node:node /prod/app ./

RUN ./node_modules/.bin/playwright install --with-deps --only-shell chromium \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

USER node

RUN node node_modules/@careerden/infrastructure/scripts/smoke-playwright-pdf.mjs

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.DOCUMENTS_WORKER_HEALTH_PORT || '3102') + '/health/ready').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1))"]

ENTRYPOINT ["tini", "--"]
CMD ["node", "dist/server.js"]
