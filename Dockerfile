FROM node:24-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY mock/package.json mock/
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM node:24-alpine AS build
WORKDIR /app
ARG BASE_PATH=""
ENV BASE_PATH=$BASE_PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
COPY --from=deps /app ./
COPY next.config.ts postcss.config.mjs tsconfig.json ./
COPY src src
RUN pnpm build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /app/.next/standalone ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "const { config } = require('./.next/required-server-files.json'); fetch('http://127.0.0.1:3000' + config.basePath + '/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "server.js"]
