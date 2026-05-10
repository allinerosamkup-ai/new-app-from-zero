#!/usr/bin/env sh
set -eu

PROJECT_DIR="${1:-/opt/airia/app}"
COMPOSE_FILE="$PROJECT_DIR/deploy/airia/compose.yml"
ENV_FILE=".env.web.build"
export DEPLOYED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
export COMPOSE_PARALLEL_LIMIT="${COMPOSE_PARALLEL_LIMIT:-1}"

cd "$PROJECT_DIR/deploy/airia"

echo "== Pre-check =="

# Valida que o env file existe e tem as vars obrigatórias do frontend
if [ ! -f "$ENV_FILE" ]; then
  echo "ERRO: $ENV_FILE não encontrado em $(pwd)"
  echo "Crie o arquivo com VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY e VITE_API_URL"
  exit 1
fi

for VAR in VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY; do
  if ! grep -q "^${VAR}=." "$ENV_FILE"; then
    echo "ERRO: $VAR está ausente ou vazio em $ENV_FILE"
    exit 1
  fi
done

docker network inspect easypanel >/dev/null

echo "== Deploy =="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build

echo "== Validate =="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
docker logs --tail 20 airia_backend || true
docker logs --tail 20 airia_web || true

echo "== Health =="
if command -v curl >/dev/null 2>&1; then
  curl -sS -o /dev/null -w "HTTP %{http_code}\n" --max-time 15 https://airia.pro/api/health || true
fi
