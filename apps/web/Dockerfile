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

# Apply the latest Alpine security patches so the runtime image does not
# carry known OS-package CVEs.
RUN apk update && apk upgrade --no-cache

COPY --from=build /workspace/apps/web/.next/standalone ./
COPY --from=build /workspace/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /workspace/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
