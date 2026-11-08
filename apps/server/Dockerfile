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

# Skip downloading GPU binaries we never use - this app only does CPU
# embeddings, and those downloads have caused real build failures.
ENV ONNXRUNTIME_NODE_INSTALL_CUDA=skip
RUN pnpm install --frozen-lockfile

COPY . .
# This just checks the code compiles without errors - we don't actually run
# the compiled output below, see the CMD comment.
RUN pnpm --filter @adaptivegate/server run build

EXPOSE 3000
# We run the TypeScript source directly with tsx, not the compiled
# dist/index.js with plain node. Reason: other packages in this monorepo
# (like packages/db) point straight at their own .ts source files, which
# plain node can't run - tsx can.
CMD ["pnpm", "--filter", "@adaptivegate/server", "exec", "tsx", "src/index.ts"]
