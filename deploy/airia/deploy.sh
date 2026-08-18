#!/usr/bin/env sh
set -eu

PROJECT_DIR="${1:-/opt/airia/app}"
COMPOSE_FILE="$PROJECT_DIR/deploy/airia/compose.yml"
ENV_FILE=".env.web.build"
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

DESTRUCTIVE_MIGRATION_PATTERN='drop[[:space:]]+(table|column)|truncate[[:space:]]+|delete[[:space:]]+from|alter[[:space:]]+column[^;]*[[:space:]]type[[:space:]]|rename[[:space:]]+(to|column)'
for MIGRATION_FILE in $MIGRATION_FILES; do
  if [ ! -f "$MIGRATION_FILE" ]; then
    echo "ERRO: migration não encontrada em $MIGRATION_FILE"
    exit 1
  fi
  # Rollback só é seguro porque estas migrations mantêm o contrato do backend
  # anterior: adições são opcionais/idempotentes e nenhuma operação destrói dados.
  # O corpo de uma função é instalado, mas não é executado durante a migração.
  # Filtrá-lo evita confundir uma rotina de retenção futura com `DELETE` rodando
  # agora, sem deixar de bloquear comandos destrutivos no nível da migração.
  MIGRATION_STATEMENTS="$(awk '
    {
      line = tolower($0)
      if (line ~ /^[[:space:]]*create[[:space:]]+(or[[:space:]]+replace[[:space:]]+)?function[[:space:]]/) {
        in_function = 1
        next
      }
      if (in_function && $0 ~ /^[[:space:]]*\$[[:alnum:]_]*\$;[[:space:]]*$/) {
        in_function = 0
        next
      }
      if (!in_function) print
    }
  ' "$MIGRATION_FILE")"
  if printf '%s\n' "$MIGRATION_STATEMENTS" | grep -Eiq "$DESTRUCTIVE_MIGRATION_PATTERN"; then
    echo "ERRO: migration incompatível com rollback automático em $MIGRATION_FILE"
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
trap rollback_on_error EXIT
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

echo "== Public routes =="
# `/?lang=en`, robots e sitemap entram aqui porque o deploy anterior passou
# inteiro com a página em inglês devolvendo 404: o Dockerfile chamava o binário
# do Vite direto e pulava o gerador do HTML em inglês. Rota que o buscador e a
# prévia de link consomem precisa ser verificada como qualquer outra.
for PUBLIC_PATH in /home /aura /sw.js /robots.txt /sitemap.xml "/?lang=en"; do
  CODE="$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 "https://airia.pro${PUBLIC_PATH}" 2>/dev/null)" || CODE="000"
  if [ "$CODE" != "200" ]; then
    echo "FALHA: ${PUBLIC_PATH} retornou HTTP ${CODE}"
    exit 1
  fi
  echo "${PUBLIC_PATH}: HTTP 200"
done

# 200 não basta: o SPA devolve index.html para quase tudo. A página em inglês
# tem que estar realmente em inglês.
# O www precisa continuar SERVINDO o app, não redirecionando: o PWA está
# instalado nesse host. Um 301 aqui quebra a API (POST vira 301, `Authorization`
# some entre origens) e deixa a sessão presa na origem antiga. A consolidação de
# busca é feita por `rel=canonical`, não por redirecionamento.
WWW_CODE="$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 'https://www.airia.pro/api/health' 2>/dev/null)" || WWW_CODE="000"
if [ "$WWW_CODE" != "200" ]; then
  echo "FALHA: https://www.airia.pro/api/health retornou HTTP ${WWW_CODE}; o PWA instalado nesse host depende dele"
  exit 1
fi
echo "www: API respondendo 200 (PWA instalado nesse host preservado)"

# Como os dois hosts servem 200 de propósito, `rel=canonical` é o ÚNICO sinal
# que diz ao buscador qual URL é a verdadeira. Canônica ausente numa página faz
# aquela URL existir em dois hosts sem nada os ligando, e o host que o Google
# eleger pode ser o `www` — que não está na propriedade do Search Console
# (`https://airia.pro/`), então a página some do relatório e não dá para pedir
# indexação dela. Foi exatamente o que aconteceu com `/privacy` e `/terms`, que
# são arquivos estáticos e não passam pelo `<head>` da SPA.
# A checagem roda nos DOIS hosts: é a versão do `www` que precisa apontar para
# o host sem `www`, e é justamente ela que ninguém abre para conferir.
for CANONICAL_ENTRY in "/=https://airia.pro/" "/privacy=https://airia.pro/privacy" "/terms=https://airia.pro/terms"; do
  CANONICAL_PATH="${CANONICAL_ENTRY%%=*}"
  CANONICAL_URL="${CANONICAL_ENTRY#*=}"
  for CANONICAL_HOST in airia.pro www.airia.pro; do
    CANONICAL_BODY="$(curl -fsS --max-time 10 "https://${CANONICAL_HOST}${CANONICAL_PATH}" 2>/dev/null)" || CANONICAL_BODY=""
    case "$CANONICAL_BODY" in
      *"rel=\"canonical\" href=\"${CANONICAL_URL}\""*) ;;
      *)
        echo "FALHA: https://${CANONICAL_HOST}${CANONICAL_PATH} não declara canônica ${CANONICAL_URL}"
        exit 1
        ;;
    esac
  done
  echo "canônica ${CANONICAL_PATH}: ${CANONICAL_URL} nos dois hosts"
done

PUBLIC_EN="$(curl -fsS --max-time 10 'https://airia.pro/?lang=en')"
case "$PUBLIC_EN" in
  *'<html lang="en-US"'*) echo "/?lang=en: head em inglês confirmado" ;;
  *)
    echo "FALHA: /?lang=en respondeu 200 mas sem o head em inglês"
    exit 1
    ;;
esac

PUBLIC_SW="$(curl -fsS --max-time 10 'https://airia.pro/sw.js')"
case "$PUBLIC_SW" in
  *"$AIRIA_RELEASE"*) echo "sw.js contém a release $AIRIA_RELEASE" ;;
  *)
    echo "FALHA: sw.js público não contém a release $AIRIA_RELEASE"
    exit 1
    ;;
esac

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

trap - EXIT
