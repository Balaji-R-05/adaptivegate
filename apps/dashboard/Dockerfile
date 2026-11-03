# Build context is the monorepo root (pnpm workspace needs the root lockfile).
FROM node:22-slim

RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/server/package.json apps/server/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/db/package.json packages/db/package.json

RUN pnpm install --frozen-lockfile

COPY . .

# Vite inlines VITE_-prefixed vars into the built bundle at build time, not
# runtime, so these have to arrive as build args (see compose.yml).
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN pnpm --filter @adaptivegate/dashboard run build

EXPOSE 4173
CMD ["pnpm", "--filter", "@adaptivegate/dashboard", "exec", "vite", "preview", "--host", "0.0.0.0", "--port", "4173"]
