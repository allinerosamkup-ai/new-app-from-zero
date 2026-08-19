#!/usr/bin/env sh
set -eu
# Recebe por stdin um tar com as imagens `airia-backend:deploy` e
# `airia-web:deploy`, troca as tags para `:current` e sobe os containers.
#
# Quem constrói a imagem é o GitHub Actions (código garantidamente
# versionado). A VPS só carrega e roda — não faz build, não faz checkout.
PROJECT_DIR="${1:-/opt/airia/app}"
COMPOSE_FILE="$PROJECT_DIR/deploy/airia/compose.yml"
ENV_FILE="$PROJECT_DIR/deploy/airia/.env.web.build"
MIGRATION_FILES="
$PROJECT_DIR/supabase/migrations/20260731120000_unify_checkin_signals.sql
$PROJECT_DIR/supabase/migrations/20260801002000_ensure_auth_profiles.sql
$PROJECT_DIR/supabase/migrations/20260801163000_add_objective_action_recovery_claims.sql
$PROJECT_DIR/supabase/migrations/20260801190000_add_onboarding_biological_sex.sql
$PROJECT_DIR/supabase/migrations/20260810130000_add_billing_trials_and_professional_partners.sql
$PROJECT_DIR/supabase/migrations/20260811120000_add_objective_intelligence.sql
$PROJECT_DIR/supabase/migrations/20260813133000_add_airia_readings_and_decisions.sql
$PROJECT_DIR/supabase/migrations/20260813143000_add_provider_neutral_billing.sql
$PROJECT_DIR/supabase/migrations/20260817233000_add_product_event_governance.sql
$PROJECT_DIR/supabase/migrations/20260817234500_harden_internal_tables_and_views.sql
$PROJECT_DIR/supabase/migrations/20260818004000_harden_function_search_path_and_execution.sql
$PROJECT_DIR/supabase/migrations/20260818005000_move_vector_extension_to_extensions.sql
"

PREVIOUS_WEB_IMAGE="$(docker inspect --format '{{.Image}}' airia_web 2>/dev/null || true)"
if [ -z "$PREVIOUS_WEB_IMAGE" ]; then
  echo "ERRO: não foi possível capturar a imagem atual para rollback"
  exit 1
fi

docker image tag "$PREVIOUS_WEB_IMAGE" airia-web:rollback 2>/dev/null || true
rollback_on_error() {
  STATUS="$?"
  trap - EXIT
  set +e
  echo "== Rollback automático =="
  docker image tag airia-web:rollback airia-web:current 2>/dev/null
  docker image tag airia-backend:rollback airia-backend:current 2>/dev/null
  export DEPLOYED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-build --force-recreate
  ROLLBACK_CODE="000"
  ROLLBACK_ATTEMPT=1
  while [ "$ROLLBACK_ATTEMPT" -le 10 ]; do
    ROLLBACK_CODE="$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 'https://airia.pro/api/health' 2>/dev/null)" || ROLLBACK_CODE="000"
    [ "$ROLLBACK_CODE" = "200" ] && break
    ROLLBACK_ATTEMPT=$((ROLLBACK_ATTEMPT + 1))
    sleep 3
  done
  if [ "$ROLLBACK_CODE" = "200" ]; then
    echo "Rollback concluído e healthcheck anterior restaurado"
  else
    echo "FALHA CRÍTICA: imagens anteriores restauradas, mas healthcheck retornou HTTP $ROLLBACK_CODE"
  fi
  exit "$STATUS"
}
trap rollback_on_error EXIT

echo "== Load =="
docker load

echo "== Swap tags =="
# A imagem enviada pelo runner vem com a tag :deploy; troca para :current.
for NAME in airia-web airia-backend; do
  if docker image inspect "${NAME}:deploy" >/dev/null 2>&1; then
    docker image tag "${NAME}:deploy" "${NAME}:current"
    echo "${NAME}:deploy -> ${NAME}:current"
  else
    echo "AVISO: ${NAME}:deploy não encontrada; mantendo a imagem atual"
  fi
done

echo "== Stop backend before migration =="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" stop airia_backend >/dev/null 2>&1 || true

echo "== Database migration =="
for MIGRATION_FILE in $MIGRATION_FILES; do
  if [ -f "$MIGRATION_FILE" ]; then
    echo "Aplicando $(basename "$MIGRATION_FILE")"
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm --no-deps -T airia_backend \
      sh -lc 'npx prisma db execute --url="$DIRECT_URL" --stdin' \
      < "$MIGRATION_FILE"
  fi
done

echo "== Deploy =="
export DEPLOYED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-build --force-recreate

echo "== Health =="
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
WEB_RELEASE="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' airia-web:current 2>/dev/null || true)"
echo "Web container release: $WEB_RELEASE"
