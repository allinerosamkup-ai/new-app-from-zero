#!/usr/bin/env sh
set -eu

PROJECT_DIR="${1:-/opt/airia/app}"
COMPOSE_FILE="$PROJECT_DIR/deploy/airia/compose.yml"
ENV_FILE=".env.web.build"
MIGRATION_FILES="
$PROJECT_DIR/supabase/migrations/20260731120000_unify_checkin_signals.sql
$PROJECT_DIR/supabase/migrations/20260801002000_ensure_auth_profiles.sql
"
export DEPLOYED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
export COMPOSE_PARALLEL_LIMIT="${COMPOSE_PARALLEL_LIMIT:-1}"

if ! GIT_TERMINAL_PROMPT=0 git -C "$PROJECT_DIR" fetch --quiet origin master >/dev/null 2>&1; then
  echo "ERRO: não foi possível consultar origin/master; deploy cancelado sem validar o GitHub"
  exit 1
fi

VPS_RELEASE="$(git -C "$PROJECT_DIR" rev-parse HEAD)"
GITHUB_RELEASE="$(git -C "$PROJECT_DIR" rev-parse refs/remotes/origin/master)"
export AIRIA_RELEASE="$VPS_RELEASE"

echo "GitHub release: $GITHUB_RELEASE"
echo "VPS release:    $VPS_RELEASE"
if [ "$GITHUB_RELEASE" != "$VPS_RELEASE" ]; then
  echo "ERRO: origin/master e o checkout da VPS não apontam para o mesmo commit"
  exit 1
fi

cd "$PROJECT_DIR/deploy/airia"

echo "== Pre-check =="

if ! command -v curl >/dev/null 2>&1; then
  echo "ERRO: curl é obrigatório para validar healthcheck e identidade pública da release"
  exit 1
fi

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

for MIGRATION_FILE in $MIGRATION_FILES; do
  if [ ! -f "$MIGRATION_FILE" ]; then
    echo "ERRO: migration não encontrada em $MIGRATION_FILE"
    exit 1
  fi
done

docker network inspect easypanel >/dev/null

echo "== Build =="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build

echo "== Database migration =="
for MIGRATION_FILE in $MIGRATION_FILES; do
  echo "Aplicando $(basename "$MIGRATION_FILE")"
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm --no-deps -T airia_backend \
    sh -lc 'npx prisma db execute --url="$DIRECT_URL" --stdin' \
    < "$MIGRATION_FILE"
done

echo "== Deploy =="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-build

echo "== Validate =="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
docker logs --tail 20 airia_backend || true
docker logs --tail 20 airia_web || true

echo "== Health =="
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

echo "== Release identity =="
CONTAINER_RELEASE="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' airia_web)"
PUBLIC_RELEASE=""
i=1
while [ "$i" -le "$ATTEMPTS" ]; do
  RELEASE_JSON="$(curl -fsS --max-time 10 'https://airia.pro/release.json' 2>/dev/null)" || RELEASE_JSON=""
  PUBLIC_RELEASE="$(printf '%s' "$RELEASE_JSON" | sed -n 's/.*"release":"\([^"]*\)".*/\1/p')"
  if [ "$PUBLIC_RELEASE" = "$AIRIA_RELEASE" ]; then
    break
  fi
  echo "tentativa ${i}/${ATTEMPTS}: release pública '${PUBLIC_RELEASE:-indisponível}' — aguardando ${AIRIA_RELEASE}..."
  i=$((i + 1))
  sleep "$DELAY"
done

echo "Container release: $CONTAINER_RELEASE"
echo "Public release:    $PUBLIC_RELEASE"
if [ "$GITHUB_RELEASE" != "$VPS_RELEASE" ] || \
   [ "$VPS_RELEASE" != "$CONTAINER_RELEASE" ] || \
   [ "$CONTAINER_RELEASE" != "$PUBLIC_RELEASE" ]; then
  echo "FALHA: GitHub, VPS, contêiner e release pública não apontam para o mesmo commit"
  exit 1
fi
