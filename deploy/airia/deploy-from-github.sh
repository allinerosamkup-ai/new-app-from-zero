#!/usr/bin/env sh
set -eu
# Deploy executado pela VPS com código clonado DIRETAMENTE do GitHub
# (https autenticado com o GITHUB_TOKEN do workflow), eliminando de vez o
# risco de buildar um working tree local desatualizado ou modificado.
#
# Uso: sh deploy-from-github.sh <REPO_URL_AUTENTICADO> [COMMIT_SHA]
#
# O checkout é feito numa cópia limpa (/opt/airia/app-src), então o código
# buildado é exatamente o que está no GitHub, sem interferência de arquivos
# locais. A cópia operacional em /opt/airia/app continua sendo o diretório
# do compose, mas o build usa o código novo.
TOKEN_URL="${1:?uso: deploy-from-github.sh <URL_AUTENTICADO> [SHA]}"
WANTED_SHA="${2:-}"
PROJECT_DIR="/opt/airia/app"
SRC_DIR="/opt/airia/app-src"
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
export DEPLOYED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
export COMPOSE_PARALLEL_LIMIT="${COMPOSE_PARALLEL_LIMIT:-1}"

echo "== Checkout do GitHub =="
if [ -d "$SRC_DIR/.git" ]; then
  git -C "$SRC_DIR" fetch --quiet origin master
else
  rm -rf "$SRC_DIR"
  git clone --quiet --depth 1 --single-branch -b master "$TOKEN_URL" "$SRC_DIR"
fi
if [ -n "$WANTED_SHA" ]; then
  # Se um SHA específico foi pedido, busca o commit exato (depth infalível:
  # fetch por SHA não existe em shallow, então clona a profundidade completa).
  if ! git -C "$SRC_DIR" rev-parse --verify "$WANTED_SHA" >/dev/null 2>&1; then
    git -C "$SRC_DIR" fetch --quiet --unshallow origin 2>/dev/null || git -C "$SRC_DIR" fetch --quiet origin
  fi
  git -C "$SRC_DIR" checkout --quiet "$WANTED_SHA"
fi
SRC_SHA="$(git -C "$SRC_DIR" rev-parse HEAD)"
echo "Código versionado conferido: $SRC_SHA"
export AIRIA_RELEASE="$SRC_SHA"

echo "== Pre-check =="
if [ ! -f "$ENV_FILE" ]; then
  echo "ERRO: $ENV_FILE não encontrado em $PROJECT_DIR/deploy/airia"
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

PREVIOUS_BACKEND_IMAGE="$(docker inspect --format '{{.Image}}' airia_backend 2>/dev/null || true)"
PREVIOUS_WEB_IMAGE="$(docker inspect --format '{{.Image}}' airia_web 2>/dev/null || true)"
if [ -z "$PREVIOUS_BACKEND_IMAGE" ] || [ -z "$PREVIOUS_WEB_IMAGE" ]; then
  echo "ERRO: não foi possível capturar as imagens atuais para rollback"
  exit 1
fi
PREVIOUS_RELEASE="$(docker image inspect "$PREVIOUS_WEB_IMAGE" --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' 2>/dev/null || true)"
case "$PREVIOUS_RELEASE" in
  ""|"<no value>") PREVIOUS_RELEASE="previous" ;;
esac
docker image tag "$PREVIOUS_BACKEND_IMAGE" airia-backend:rollback
docker image tag "$PREVIOUS_WEB_IMAGE" airia-web:rollback

rollback_on_error() {
  STATUS="$?"
  trap - EXIT
  set +e
  echo "== Rollback automático =="
  docker image tag airia-backend:rollback airia-backend:current
  docker image tag airia-web:rollback airia-web:current
  export AIRIA_RELEASE="${PREVIOUS_RELEASE:-previous}"
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-build --force-recreate
  ROLLBACK_STATUS="$?"
  if [ "$ROLLBACK_STATUS" -eq 0 ]; then
    ROLLBACK_CODE="000"
    ROLLBACK_ATTEMPT=1
    while [ "$ROLLBACK_ATTEMPT" -le 10 ]; do
      ROLLBACK_CODE="$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 'https://airia.pro/api/health' 2>/dev/null)" || ROLLBACK_CODE="000"
      if [ "$ROLLBACK_CODE" = "200" ]; then
        break
      fi
      ROLLBACK_ATTEMPT=$((ROLLBACK_ATTEMPT + 1))
      sleep 3
    done
    if [ "$ROLLBACK_CODE" = "200" ]; then
      echo "Rollback concluído e healthcheck anterior restaurado"
    else
      echo "FALHA CRÍTICA: imagens anteriores restauradas, mas healthcheck retornou HTTP $ROLLBACK_CODE"
    fi
  else
    echo "FALHA CRÍTICA: rollback dos contêineres não concluiu"
  fi
  exit "$STATUS"
}
trap rollback_on_error EXIT

# Copia apenas o que o build precisa (código + config) para manter o contexto
# do docker limpo e sem dependência dos arquivos de runtime da VPS.
echo "== Build context =="
rm -rf "$PROJECT_DIR/deploy/airia/.build-src"
mkdir -p "$PROJECT_DIR/deploy/airia/.build-src/apps/web" "$PROJECT_DIR/deploy/airia/.build-src/apps/backend" "$PROJECT_DIR/deploy/airia/.build-src/supabase" "$PROJECT_DIR/deploy/airia/.build-src/scripts" "$PROJECT_DIR/deploy/airia/.build-src/.github"
(cd "$SRC_DIR" && tar cf - apps/web apps/backend supabase scripts .github package.json package-lock.json) | tar xf - -C "$PROJECT_DIR/deploy/airia/.build-src"

echo "== Build =="
cd "$PROJECT_DIR/deploy/airia/.build-src"
docker build --tag airia-web:current \
  --label "org.opencontainers.image.revision=$AIRIA_RELEASE" \
  --build-arg VITE_API_URL=/api \
  --build-arg "VITE_SUPABASE_URL=$(grep -m1 '^VITE_SUPABASE_URL=' "$ENV_FILE" | cut -d= -f2)" \
  --build-arg "VITE_SUPABASE_ANON_KEY=$(grep -m1 '^VITE_SUPABASE_ANON_KEY=' "$ENV_FILE" | cut -d= -f2)" \
  --build-arg "VITE_APP_RELEASE=$AIRIA_RELEASE" \
  --file "$PROJECT_DIR/deploy/airia/Dockerfile.web" .
docker build --tag airia-backend:current \
  --label "org.opencontainers.image.revision=$AIRIA_RELEASE" \
  --file "$PROJECT_DIR/deploy/airia/Dockerfile.backend" .

echo "== Validate build content =="
# O bundle no ar saiu antigo por um tempo: esta checagem garante que o
# JavaScript construído é mesmo o código versionado antes de subir.
docker create --name bundlecheck airia-web:current >/dev/null
BUNDLE_MAIN="$(docker cp bundlecheck:/usr/share/nginx/html/assets - 2>/dev/null | tar tf - | grep '^assets/main-' | head -1)"
if [ -z "$BUNDLE_MAIN" ]; then
  echo "FALHA: nenhum bundle main-*.js encontrado na imagem"
  docker rm -f bundlecheck >/dev/null
  rollback_on_error
fi
if ! docker cp bundlecheck:"$BUNDLE_MAIN" - 2>/dev/null | head -c 400000 | grep -qE 'createBrowserRouter|RouterProvider'; then
  echo "FALHA: o bundle $BUNDLE_MAIN NÃO contém o roteador de dados (createBrowserRouter/RouterProvider). O JavaScript construído não corresponde ao código versionado; deploy abortado."
  docker rm -f bundlecheck >/dev/null
  rollback_on_error
fi
echo "bundle construído contém o roteador de dados — ok"
docker rm -f bundlecheck >/dev/null

echo "== Stop backend before migration =="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" stop airia_backend

echo "== Database migration =="
cd "$PROJECT_DIR/deploy/airia/.build-src"
for MIGRATION_FILE in $MIGRATION_FILES; do
  if [ -f "$MIGRATION_FILE" ]; then
    echo "Aplicando $(basename "$MIGRATION_FILE")"
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm --no-deps -T airia_backend \
      sh -lc 'npx prisma db execute --url="$DIRECT_URL" --stdin' \
      < "$MIGRATION_FILE"
  fi
done

echo "== Deploy =="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-build

echo "== Validate =="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
docker logs --tail 20 airia_backend || true
docker logs --tail 20 airia_web || true

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
  rollback_on_error
fi

echo "== Release identity =="
WEB_RELEASE="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' airia-web:current 2>/dev/null || true)"
echo "Web container release: $WEB_RELEASE"
echo "Deploy concluído: release $AIRIA_RELEASE"

echo "== Cleanup =="
rm -rf "$PROJECT_DIR/deploy/airia/.build-src"
