FROM node:24-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY mock/package.json mock/
RUN pnpm --filter green-api-mock deploy --prod --ignore-scripts /out

FROM node:24-alpine AS runner
WORKDIR /app
ENV HOST=0.0.0.0 PORT=3100 NODE_ENV=production
COPY --from=deps /out ./
COPY mock/*.ts ./
USER node
EXPOSE 3100
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3100/').then((r) => process.exit(r.status < 500 ? 0 : 1), () => process.exit(1))"
CMD ["node", "server.ts"]
