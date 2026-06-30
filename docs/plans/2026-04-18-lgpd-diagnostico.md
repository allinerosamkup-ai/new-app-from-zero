# Diagnóstico LGPD — Mood Energy (fase 0)

Data: 2026-04-18  
Status: concluído (diagnóstico inicial técnico)  
Escopo: `apps/web`, `apps/backend`, `apps/mobile`, `packages/database`, `supabase/migrations`

## 1) Resumo executivo

O projeto já tem uma base boa de privacidade por arquitetura: autenticação via Supabase JWT, RLS no banco e `userId` obrigatório na API.  
O principal risco LGPD hoje não é acesso indevido entre usuários, e sim governança de direitos do titular e ciclo de vida de dados.

### Maturidade atual
- **Controle de acesso e isolamento**: bom.
- **Consentimento e transparência**: parcial.
- **Direitos do titular (exportar/excluir/revogar)**: insuficiente.
- **Retenção, descarte e trilha de auditoria**: insuficiente.

## 2) Evidências técnicas mapeadas

### 2.1 Fontes de dados pessoais (banco)
- `profiles`, `onboarding_responses`, `user_preferences`, `consents`, `daily_checkins`, `journal_sessions`, `journal_messages`, `timeline_blocks`, `objectives`, `habits`, `habit_completions`, `weekly_insights`, `memory_embeddings`, `push_subscriptions`.
- Evidência: `packages/database/prisma/schema.prisma`.

### 2.2 Dados sensíveis/relevantes por categoria
- **Identificação**: nome e e-mail (e-mail vem do Auth Supabase, nome em `profiles.full_name`).
- **Saúde e bem-estar**: humor, energia, sono, sintomas menstruais, notas emocionais (`daily_checkins`, `onboarding_responses`, `journal_messages`).
- **Perfil comportamental inferido por IA**: `ai_profile_summary`, `ai_profile_payload`, `memory_embeddings`.
- **Integrações externas**: tokens Google Calendar em `user_preferences.gcal_access_token` e `gcal_refresh_token`.
- **Dispositivo/notificação**: `push_subscriptions.endpoint`, `user_agent`.

### 2.3 Coleta no produto
- Onboarding coleta dados pessoais e de saúde mental/rotina no backend.
  - Evidência: `apps/backend/src/contracts/onboarding.contract.ts`.
- Check-in coleta dados de estado emocional e sintomas físicos.
  - Evidência: `apps/backend/src/contracts/checkin.contract.ts`.
- Diário aceita texto livre longo (até 30k chars), portanto pode conter dados altamente sensíveis.
  - Evidência: `apps/backend/src/contracts/journal.contract.ts`.

### 2.4 Fluxo de autenticação e acesso
- API protege `/api/*` com `requireAuth` (exceto health e chave VAPID pública).
  - Evidência: `apps/backend/src/index.ts` (`app.use('/api', requireAuth)`).
- Validação do token pelo Supabase com `auth.getUser(token)`.
  - Evidência: `apps/backend/src/middleware/auth.ts`.

### 2.5 Compartilhamento com terceiros
- **OpenAI** para geração de respostas, sumarização e embeddings.
  - Evidência: `apps/backend/src/services/ai.service.ts`, `apps/backend/src/services/memory.service.ts`.
- **Google Calendar API** para ler/criar/editar/excluir eventos.
  - Evidência: `apps/backend/src/services/gcal.service.ts` e rotas `/api/gcal/*` em `apps/backend/src/index.ts`.

### 2.6 Armazenamento local cliente
- Web/PWA usa `localStorage` para itens com potencial dado pessoal (ex.: email lembrado e conteúdo de produtividade).
  - Evidência: `apps/web/src/routes/login-page.tsx`, `apps/web/src/routes/goals-page.tsx`, `apps/web/src/routes/planner-page.tsx`.
- Mobile usa `AsyncStorage` para sessão Supabase e payload de widget.
  - Evidência: `apps/mobile/src/lib/supabase.ts`, `apps/mobile/src/widgets/todayWidgetData.ts`.

## 3) Estado de conformidade por pilar LGPD

## 3.1 Base legal e consentimento
- **Ponto forte**: tabela de consentimentos existe (`consents`) e RLS aplicada.
- **Gap**: não há gestão unificada de consentimento no backend/web (revogação granular em runtime, versão de política ativa, histórico auditável por endpoint).
- **Gap**: consentimento está implementado de forma explícita no onboarding mobile, mas não está padronizado entre canais.
  - Evidência mobile: `apps/mobile/src/presentation/providers/onboarding_store.ts`.

## 3.2 Transparência
- **Ponto forte**: política e termos publicados.
  - Evidência: `apps/web/public/privacy.html`, `apps/web/public/terms.html`.
- **Gap**: política informa exclusão via configurações, mas não existe fluxo técnico completo de exclusão/exportação no app/backend.

## 3.3 Direitos do titular
- **Gap crítico**: ausência de endpoint dedicado para portabilidade/exportação completa.
- **Gap crítico**: ausência de endpoint único para exclusão/anonimização de conta com cobertura de todo o dataset.
- **Gap**: ausência de SLA/estado de requisição LGPD (ticket interno ou trilha formal).

## 3.4 Segurança e minimização
- **Ponto forte**: RLS e escopo por `userId`; autenticação centralizada.
- **Gap crítico**: tokens Google (`gcal_access_token`, `gcal_refresh_token`) aparentam armazenamento em texto no banco de preferências.
  - Evidência: `packages/database/prisma/schema.prisma`, `apps/backend/src/services/gcal.service.ts`.
- **Gap**: sem política explícita de retenção/descarte para dados de diário, memória vetorial e logs.

## 4) Matriz de riscos (priorização)

1. **Crítico**: inexistência de fluxo completo de direitos do titular (exportação/exclusão).  
Impacto: alto risco jurídico e de confiança.

2. **Crítico**: token de integração Google sem proteção adicional de aplicação (além da proteção de banco/infra).  
Impacto: exposição de integração em incidente de aplicação/consulta indevida.

3. **Alto**: governança de consentimento fragmentada entre mobile e backend/web.  
Impacto: inconsistência de base legal por canal.

4. **Alto**: ausência de política de retenção automatizada.  
Impacto: guarda excessiva de dados sensíveis.

5. **Médio**: `localStorage` web com dados potencialmente pessoais (email lembrado e itens do usuário).  
Impacto: exposição local em dispositivo compartilhado.

## 5) Plano de implementação (ordem de execução)

## Sprint 1 (P0, imediato)
- Implementar `GET /api/privacy/export` com pacote JSON completo por `userId`.
- Implementar `DELETE /api/privacy/account` com exclusão/anonimização transacional por `userId`.
- Criar página "Privacidade" em configurações com:
  - exportar dados
  - excluir conta
  - baixar comprovante de consentimentos vigentes.

## Sprint 2 (P0/P1)
- Criar API de consentimento:
  - `GET /api/privacy/consents`
  - `PATCH /api/privacy/consents`
- Versionar consentimento com referência de política/termos.
- Aplicar gate de recursos sensíveis (ex.: IA e health data) baseado em consentimento vigente.

## Sprint 3 (P1)
- Criptografar tokens Google em nível de aplicação (envelope encryption com chave server-side).
- Definir retenção automática:
  - diário bruto
  - memórias vetoriais
  - logs operacionais.
- Criar auditoria de ações LGPD (`privacy_audit_log`).

## 6) Backlog técnico inicial (tickets)

1. `backend`: criar módulo `privacy.controller.ts` com exportação e exclusão.
2. `backend`: criar `privacy.service.ts` com `buildUserDataExport(userId)` e `deleteUserData(userId)`.
3. `database`: migration para `privacy_audit_log`.
4. `web`: adicionar seção LGPD em `preferences-page` com botões de exportar/excluir.
5. `web/mobile`: unificar consentimento para passar sempre por backend.
6. `backend`: proteger integração Google com criptografia de tokens.

## 7) Critério de pronto do diagnóstico

- Inventário de dados mapeado: **ok**.
- Fluxos de coleta/processamento/compartilhamento mapeados: **ok**.
- Riscos priorizados e backlog de execução definido: **ok**.
- Próximo passo autorizado: **iniciar Sprint 1 (direitos do titular)**.
