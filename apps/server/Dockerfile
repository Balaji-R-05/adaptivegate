# Build context is the monorepo root (pnpm workspace needs the root lockfile).
FROM node:22-slim

RUN corepack enable
WORKDIR /app

# Copy just the package.json files first so `pnpm install` is cached across
# builds unless a dependency actually changed.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/server/package.json apps/server/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/db/package.json packages/db/package.json

RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @adaptivegate/server run build

EXPOSE 3000
CMD ["node", "apps/server/dist/index.js"]
