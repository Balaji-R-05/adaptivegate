#!/bin/bash
# Updates an existing self-hosted install to the latest release - pulls the
# newest images (compose.selfhosted.yml always points at `:latest`),
# applies any new database migrations, then restarts with the new images.
# Safe to re-run anytime; it never touches .env or regenerates secrets.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

COMPOSE="docker compose -f compose.selfhosted.yml"

if [ ! -f .env ]; then
  echo ".env not found - run ./setup.sh first." >&2
  exit 1
fi

get_env() {
  grep "^$1=" .env 2>/dev/null | cut -d= -f2- || true
}

echo "Pulling latest images..."
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

echo "Applying any new database schema changes..."
docker run --rm --network "$NETWORK" \
  -e DATABASE_URL="postgresql://postgres:$(get_env POSTGRES_PASSWORD)@db:5432/postgres" \
  ghcr.io/balaji-r-05/adaptivegate-server:latest \
  pnpm --filter @adaptivegate/db run db:migrate

echo "Starting server and dashboard with the new images..."
$COMPOSE up -d server dashboard

echo ""
echo "Updated to the latest release."
