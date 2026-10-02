FROM node:22-alpine AS base
WORKDIR /workspace
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/api-client/package.json packages/api-client/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @montelingo/web build

FROM node:22-alpine AS dev
WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/api-client/package.json packages/api-client/package.json
RUN pnpm install --frozen-lockfile
COPY . .
CMD ["pnpm", "--filter", "@montelingo/web", "dev", "--hostname", "0.0.0.0", "--port", "3001"]

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Docker sets HOSTNAME to the container ID, and the standalone server binds to
# it, so it would only listen on the container's network address and the
# in-container healthcheck on 127.0.0.1 would be refused. Bind all interfaces.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Apply the latest Alpine security patches so the runtime image does not
# carry known OS-package CVEs.
RUN apk update && apk upgrade --no-cache

# The standalone server only needs node. Drop the package managers bundled in
# the base image so their dependencies do not ship (or get scanned) at runtime.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-* \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    chown -R nextjs:nodejs /app

COPY --from=build --chown=nextjs:nodejs /workspace/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /workspace/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=nextjs:nodejs /workspace/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
