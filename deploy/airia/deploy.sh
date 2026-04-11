#!/usr/bin/env sh
set -eu

PROJECT_DIR="${1:-/opt/airia/app}"
COMPOSE_FILE="$PROJECT_DIR/deploy/airia/compose.yml"
ENV_FILE=".env.web.build"
export DEPLOYED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

cd "$PROJECT_DIR/deploy/airia"

echo "== Pre-check =="
docker network inspect easypanel >/dev/null

echo "== Deploy =="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build

echo "== Validate =="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
docker logs --tail 20 airia_backend || true
docker logs --tail 20 airia_web || true

echo "== Health =="
if command -v curl >/dev/null 2>&1; then
  curl -sS -o /dev/null -w "HTTP %{http_code}\n" --max-time 15 https://airia.pro || true
fi
