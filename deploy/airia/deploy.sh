#!/usr/bin/env sh
set -eu

PROJECT_DIR="${1:-/opt/airia/app}"
COMPOSE_FILE="$PROJECT_DIR/deploy/airia/compose.yml"
ENV_FILE=".env.web.build"
CHECKIN_MIGRATION="$PROJECT_DIR/supabase/migrations/20260731120000_unify_checkin_signals.sql"
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

if [ ! -f "$CHECKIN_MIGRATION" ]; then
  echo "ERRO: migration de check-in não encontrada em $CHECKIN_MIGRATION"
  exit 1
fi

docker network inspect easypanel >/dev/null

echo "== Build =="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build

echo "== Database migration =="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm --no-deps -T airia_backend \
  sh -lc 'npx prisma db execute --url="$DIRECT_URL" --stdin' \
  < "$CHECKIN_MIGRATION"

echo "== Deploy =="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-build

echo "== Validate =="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
docker logs --tail 20 airia_backend || true
docker logs --tail 20 airia_web || true

echo "== Health =="
if command -v curl >/dev/null 2>&1; then
  # O backend Node leva alguns segundos pra ficar pronto após o 'up'. Sem retry,
  # o health roda cedo demais e mostra um 502 falso. Aqui fazemos polling até 200
  # (ou ~60s), e só então tratamos como falha real.
  HEALTH_URL="https://airia.pro/api/health"
  ATTEMPTS=20
  DELAY=3
  CODE="000"
  i=1
  while [ "$i" -le "$ATTEMPTS" ]; do
    CODE="$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 "$HEALTH_URL" 2>/dev/null)" || CODE="000"
    if [ "$CODE" = "200" ]; then
      echo "HTTP 200 (ok na tentativa ${i})"
      break
    fi
    echo "tentativa ${i}/${ATTEMPTS}: HTTP ${CODE} — aguardando o backend subir..."
    i=$((i + 1))
    sleep "$DELAY"
  done
  if [ "$CODE" != "200" ]; then
    echo "FALHA: health não retornou 200 após ~$((ATTEMPTS * DELAY))s (último: HTTP ${CODE})"
    exit 1
  fi
fi
