#!/bin/bash
# One-command setup for the self-hosted stack. Needs only Docker — no
# Node/pnpm on your machine, since every step below runs inside a container.
# Because server/dashboard run as Docker services here (not `pnpm dev`), the
# addresses written into .env use Docker's internal service names (db, auth,
# gateway) instead of localhost. See docs/self-hosting.md for details.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

COMPOSE="docker compose -f compose.selfhosted.yml"

if [ ! -f .env ]; then
  echo "Creating .env from .env.example..."
  cp .env.example .env
fi

get_env() {
  grep "^$1=" .env 2>/dev/null | cut -d= -f2- || true
}

set_env() {
  if grep -q "^$1=" .env; then
    sed -i.bak "s#^$1=.*#$1=$2#" .env && rm -f .env.bak
  else
    echo "$1=$2" >> .env
  fi
}

random_hex() {
  docker run --rm node:22-alpine node -e "console.log(require('crypto').randomBytes($1).toString('hex'))"
}

[ -z "$(get_env JWT_SECRET)" ] && { echo "Generating JWT_SECRET..."; set_env JWT_SECRET "$(random_hex 32)"; }
[ -z "$(get_env POSTGRES_PASSWORD)" ] && { echo "Generating POSTGRES_PASSWORD..."; set_env POSTGRES_PASSWORD "$(random_hex 16)"; }

[ -z "$(get_env SITE_URL)" ] && set_env SITE_URL "http://localhost:5173"
# The server runs as a Docker container here, so it reaches the gateway by its container name (gateway:8000), not localhost.
set_env SUPABASE_URL "http://gateway:8000"
set_env DATABASE_URL "postgresql://postgres:$(get_env POSTGRES_PASSWORD)@db:5432/postgres"

JWT_SECRET="$(get_env JWT_SECRET)"
POSTGRES_PASSWORD="$(get_env POSTGRES_PASSWORD)"
export JWT_SECRET POSTGRES_PASSWORD SITE_URL="$(get_env SITE_URL)" SUPABASE_URL="$(get_env SUPABASE_URL)"

echo "Pulling images..."
$COMPOSE pull

echo "Starting db, auth, gateway..."
$COMPOSE up -d db auth gateway

echo "Waiting for db, auth, gateway to report healthy..."
wait_healthy() {
  local service="$1"
  while true; do
    local id
    id="$($COMPOSE ps -q "$service")"
    if [ -z "$id" ]; then
      echo ""
      echo "$service failed to start. Logs:"
      $COMPOSE logs "$service"
      echo "" >&2
      echo "If this looks like a credential or schema mismatch and you've run setup before in" >&2
      echo "this directory, a leftover database volume may still have the old password. Fix:" >&2
      echo "  docker compose -f compose.selfhosted.yml down -v" >&2
      echo "  ./setup.sh" >&2
      echo "" >&2
      echo "$service container is not running - see logs above." >&2
      exit 1
    fi
    [ "$(docker inspect -f '{{.State.Health.Status}}' "$id")" = "healthy" ] && return
    sleep 2
  done
}
wait_healthy db
wait_healthy auth

PROJECT_NAME="$(basename "$(pwd)")"
NETWORK="${PROJECT_NAME}_default"

if [ -z "$(get_env SUPABASE_ANON_KEY)" ]; then
  echo "Generating Supabase keys..."
  # Using "pnpm --filter ... exec" instead of "npx" - npx can't find tsx
  # from the image's root folder, only pnpm knows where it's installed.
  KEYS_OUTPUT="$(docker run --rm --network "$NETWORK" ghcr.io/balaji-r-05/adaptivegate-server:latest \
    pnpm --filter @adaptivegate/server exec tsx scripts/generate-supabase-keys.ts -- "$JWT_SECRET")"
  ANON_KEY="$(echo "$KEYS_OUTPUT" | grep '^SUPABASE_ANON_KEY=' | cut -d= -f2-)"
  SERVICE_ROLE_KEY="$(echo "$KEYS_OUTPUT" | grep '^SUPABASE_SERVICE_ROLE_KEY=' | cut -d= -f2-)"
  set_env SUPABASE_ANON_KEY "$ANON_KEY"
  set_env SUPABASE_SERVICE_ROLE_KEY "$SERVICE_ROLE_KEY"
fi

echo "Applying database schema..."
docker run --rm --network "$NETWORK" \
  -e DATABASE_URL="postgresql://postgres:${POSTGRES_PASSWORD}@db:5432/postgres" \
  ghcr.io/balaji-r-05/adaptivegate-server:latest \
  pnpm --filter @adaptivegate/db run db:migrate

echo "Starting server and dashboard..."
$COMPOSE up -d server dashboard

echo ""
echo "Done. Open http://localhost:5173 and sign up with email/password."
command -v open >/dev/null 2>&1 && open http://localhost:5173 || true
command -v xdg-open >/dev/null 2>&1 && xdg-open http://localhost:5173 || true
