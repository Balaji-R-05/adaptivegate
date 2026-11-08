# Build context is the monorepo root (pnpm workspace needs the root lockfile).
FROM node:22-slim

RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/server/package.json apps/server/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/db/package.json packages/db/package.json

# Installing the whole monorepo also installs apps/server's dependencies,
# which would otherwise try to download GPU binaries we never use - skip
# that, since it's wasted bandwidth and has caused real build failures.
ENV ONNXRUNTIME_NODE_INSTALL_CUDA=skip
RUN pnpm install --frozen-lockfile

COPY . .

# VITE_GATEWAY_URL (the server's address) is baked in at build time, with a
# default so no args are required. The Supabase URL/anon key are NOT baked
# in here - the dashboard fetches those from the server at runtime instead
# (see apps/dashboard/src/lib/supabase.ts), so this same image works for
# any deployer's Supabase project.
ARG VITE_GATEWAY_URL=http://localhost:3000
ENV VITE_GATEWAY_URL=$VITE_GATEWAY_URL

RUN pnpm --filter @adaptivegate/dashboard run build

EXPOSE 4173
CMD ["pnpm", "--filter", "@adaptivegate/dashboard", "exec", "vite", "preview", "--host", "0.0.0.0", "--port", "4173"]
