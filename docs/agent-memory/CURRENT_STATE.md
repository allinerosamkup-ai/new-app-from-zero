# CURRENT_STATE — trabalho em andamento

## Status

`BLOQUEADO EXTERNAMENTE — código da Cakto meta-verificado e integrado na branch
claude/codex-session-finalize-n3oeqy; falta a titular concluir os dados
legais/financeiros no painel Cakto e a autorização de produção`

## Sprint Contract — Cakto

- **Implementar:** Cakto como provedor principal dos planos mensal, anual e
  vitalício de R$ 99; Checkout real; confirmação no servidor; webhooks
  idempotentes; sincronização de acesso; gestão/cancelamento adaptada às
  capacidades da Cakto; configuração segura e publicação validada.
- **Não alterar:** fluxos de Objetivos, Planner, Aura, Check-in e mobile; regra
  de acesso já comprada; histórico Stripe; preços mensal/anual já aprovados.
- **Aceite:** a mesma UI de cobrança oferece os três planos; o backend cria
  Checkout Cakto live; nenhum parâmetro de URL libera acesso; assinatura e
  vitalício convergem no estado canônico; falhas aparecem sem sucesso simulado;
  segredos não entram no Git; testes, builds, deploy, SHA e fluxo autenticado
  passam com evidência.
- **Busca/reuso:** fluxo Stripe e rotas genéricas atuais; documentação oficial
  Cakto; SDKs/pacotes oficiais quando existirem; candidatos, adaptação e
  rejeições serão registrados antes de código novo.
- **Papéis:** coordenador nesta sessão; pesquisa e arquitetura em agentes
  horizontais; executor, verificador, verificador de integração e
  meta-verificador com handoffs persistidos e notas mínimas de 8/10.

## Execução e handoffs — 2026-08-13

- **Busca/reuso registrada:** foram inspecionados o provedor Stripe, as rotas
  genéricas `/api/billing/*`, `BillingAccessService`, `/comecar`, a tela única
  `/billing`, schema, migrações, deploy e histórico/worktrees. Foram consultados
  os contratos oficiais Cakto de autenticação, produtos, ofertas, pedidos,
  assinaturas, cancelamento e webhooks. Não existe SDK oficial necessário para
  este fluxo; foi mantido `fetch` nativo, sem dependência nova.
- **Escolha:** preservar a superfície genérica e trocar somente o adaptador de
  pagamento. Cakto é principal por `BILLING_PROVIDER=cakto`; Stripe só pode ser
  selecionado explicitamente e eventos Stripe não substituem uma conta Cakto.
- **Configuração externa criada:** produtos de assinatura e vitalício, ofertas
  mensal R$ 29,90, anual R$ 249 e vitalícia R$ 99, checkout hospedado e webhook
  de produção para os dois produtos. Nenhuma credencial real foi gravada no Git.
- **EXECUTOR → VERIFICADOR:** primeira implementação passou testes focados e
  builds, mas o verificador independente reprovou com **4/10**. Ele encontrou
  incompatibilidade com o pedido oficial, assinatura tratada como objeto,
  evento Stripe ativo capaz de sobrescrever Cakto e renovação recusada ignorada.
- **CORREÇÃO:** validação passou a usar `baseAmount`, produto, tipo, `checkoutUrl`
  e `sck` do pedido oficial; assinaturas são reconsultadas pelo ID oficial antes
  de ativar/cancelar; cancelamento e renovação recusada exigem a assinatura
  atualmente ligada à conta; evento Stripe nunca rebaixa a posse da Cakto;
  tentativas idempotentes não podem trocar de plano. Descontos permanecem
  compatíveis porque a validação usa o valor-base da oferta, não o total com
  taxas ou desconto.
- **VERIFICADOR → CORREÇÃO 2:** a reverificação subiu para **5/10**, mas ainda
  reprovou ao encontrar Checkout vitalício Stripe sobrescrevendo Cakto,
  cancelamento concorrente atualizando uma assinatura nova e chave de tentativa
  mantida após troca de plano. Todos os caminhos vitalícios Stripe agora
  preservam contas Cakto; a atualização pós-cancelamento exige o mesmo provedor
  e ID de assinatura; a UI gera nova chave somente quando o plano muda e reutiliza
  a anterior em retentativa do mesmo plano. Os três casos viraram regressões
  automatizadas e passaram.
- **VERIFICADOR final → INTEGRAÇÃO:** terceira rodada independente aprovou com
  **9/10**, sem falha crítica ou alta. Foram reproduzidos os contratos oficiais,
  todos os caminhos stale Stripe, cancelamento concorrente, troca de plano,
  renovação recusada, reembolso/chargeback e rejeição de segredo inválido.
- **INTEGRAÇÃO → CORREÇÃO 3:** o gate integral executou 109 suítes backend e
  57 arquivos/435 testes web com sucesso, mas reprovou com **7/10** porque uma
  confirmação Cakto positiva antiga ainda podia substituir uma compra Cakto
  nova. A ativação agora só mantém a mesma compra/assinatura ou aceita uma
  tentativa criada estritamente depois do estado atual; vitalício nunca é
  rebaixado por assinatura recorrente. Eventos positivos antigos e transição
  nova válida ganharam regressões e passaram, junto do build backend.
- **INTEGRAÇÃO final → META-VERIFICAÇÃO:** reverificação aprovada com **9/10**,
  sem falha crítica ou alta. Evidência integral preservada: 109 suítes backend,
  57 arquivos/435 testes web, Prisma/database/backend/web builds, typecheck,
  schema, migração, RLS, privacidade e ausência de credenciais literais.
- **Evidência na branch limpa:** o commit funcional foi isolado sobre
  `origin/master` em `codex/cakto-billing`; 109 suítes backend e 57 arquivos/435
  testes web passaram novamente. Prisma generate, database build, backend
  build, web typecheck e build/PWA também passaram. Seguem pendentes
  meta-verificação, publicação, segredo seguro em produção, webhook real e E2E
  autenticado.
- **Bloqueio externo conhecido:** a Cakto ainda exige que a titular conclua os
  dados legais/financeiros sensíveis no painel. Esses dados não podem ser
  inferidos pelo agente e a capacidade real de receber/repassar valores não será
  declarada pronta antes dessa conclusão.

## Meta-verificação independente — 2026-08-14 (Claude Code, sessão remota)

Retomada do trabalho iniciado no Codex (`codex/cakto-billing`, commit `39b3813`).
A branch foi trazida sem rebase para `claude/codex-session-finalize-n3oeqy`, que
partia exatamente de `2eeb1c9` (`origin/master`).

- **Baseline reproduzido do zero, em container Linux limpo:** backend 109 suítes
  PASS, web 57 arquivos / 435 testes PASS, `generate`/build do database, build do
  backend, typecheck e build do web PASS. Os números do handoff do Codex
  bateram — o relatório dele era honesto.
- **Defeito P1 encontrado fora do escopo declarado, com evidência em produção:**
  `supabase/migrations/20260811120000_add_objective_intelligence.sql`, mergeada
  no master pelo PR #10, **nunca entrou na lista `MIGRATION_FILES` do
  `deploy/airia/deploy.sh`**. O deploy aplica exatamente o que está listado, e o
  banco público confirmou: 0 das colunas de objetivo inteligente, 42 objetivos
  reais, `billing_checkout_attempts` e `billing_webhook_events` inexistentes.
  A release pública ainda era `1014696`, anterior ao merge — ou seja, o estrago
  aconteceria no **próximo** deploy, com build verde e Objetivos quebrando em
  produção. Corrigido, e a trava agora é genérica em
  `migration-chain-safety.test.ts`: a partir do primeiro arquivo que o deploy
  aplica, nenhuma migração posterior pode faltar nem sair de ordem. A trava foi
  provada por mutação (remover a linha faz o teste falhar).
- **Defeito P2 no retorno do checkout:** a tentativa gravada em `sessionStorage`
  só era apagada quando o pagamento confirmava. Quem abrisse o checkout e
  desistisse reencontraria "Confirmando seu pagamento" em toda visita a
  `/billing` — aviso sobre uma compra que não existe. Agora a tentativa vale 30
  minutos; perder o aviso não perde compra, porque a liberação vem do webhook.
- **Risco avaliado e descartado com dado real:** conta Stripe legada ficaria com
  `billing_provider` nulo e sem botão de gerenciar. `select count(*) from
  billing_accounts` retornou **0** — não existe assinante legado, e todo caminho
  Stripe novo já grava `'stripe'`. Nada a corrigir; fica registrado para não ser
  redescoberto.
- **Segredos:** varredura do diff não achou credencial literal (só `whsec_test`
  em fixture de teste).

## Configuração da Cakto conferida contra a API — 2026-08-14

A conta já tem tudo criado pela sessão do Codex, e a API confirma. **Nada aqui é
segredo** — IDs de produto e de oferta aparecem na URL do checkout:

| Variável | Valor |
|---|---|
| `CAKTO_SUBSCRIPTION_PRODUCT_ID` | `8816118c-9fa1-4732-a90a-ba214bd40c1f` (Airia Pro, `subscription`) |
| `CAKTO_LIFETIME_PRODUCT_ID` | `63e1d874-5c3a-46c7-9859-addcd95a7c5f` (Airia Pro Vitalício, `unique`) |
| `CAKTO_MONTHLY_OFFER_ID` | `ry3yceb` — R$ 29,90 |
| `CAKTO_ANNUAL_OFFER_ID` | `znf5ego` — R$ 249,00 |
| `CAKTO_LIFETIME_OFFER_ID` | `39opwma` — R$ 99,00 |

Os três preços batem exatamente com o que `cakto.service.ts` valida (2990, 24900
e 9900 centavos) e as três páginas `pay.cakto.com.br/<offerId>` respondem 200.

O webhook "Airia Production Billing" (id 61100) está ativo, apontando para
`https://airia.pro/api/billing/webhook/cakto`, ligado aos dois produtos, com os
**8 eventos que o código trata** e nenhum a mais: `purchase_approved`,
`purchase_refused`, `refund`, `chargeback`, `subscription_canceled`,
`subscription_renewed`, `subscription_created` e `subscription_renewal_refused`.

Rotas úteis da API (`https://api.cakto.com.br`, token por `client_id`/
`client_secret` em `POST /public_api/token/`): `/public_api/products/`,
`/public_api/offers/` e **`/public_api/webhook/` no singular** — o plural
`/webhooks/` devolve 404. O segredo do webhook vive em `fields.secret` do
registro, não em campo de topo.

## Passo de segredos no deploy — 2026-08-14

`.github/workflows/deploy.yml` ganhou o passo "Sincronizar segredos de cobrança",
que grava `BILLING_PROVIDER` e as sete chaves `CAKTO_*` no `.env.backend` da VPS
a partir dos segredos do repositório. Existe porque nem todo ambiente que precisa
publicar tem a porta 22 — o container do Claude Code na nuvem não tem.

Verificado por simulação local do trecho remoto: linha alheia preservada, valor
com `=` no meio intacto, chave antiga substituída sem duplicar, última linha sem
quebra final não se perde, backup datado criado e arquivo final em 600. YAML do
workflow validado. Faltando qualquer uma das oito chaves, o passo não escreve
nada e avisa — meia configuração deixaria `isConfigured()` falso do mesmo jeito.

## Limites medidos deste ambiente — 2026-08-14

- **SSH continua impossível daqui.** Remedido hoje: `195.35.17.102:22` e
  `github.com:22` dão timeout, `~/.ssh` está vazio e não há chave versionada no
  repositório (só arquivos `*.example`). O bloqueio é na saída do container;
  ter a chave não muda o resultado. A skill `.agents/skills/deploy-airia`
  descreve a máquina Windows da titular, não este ambiente.
- **O classificador de permissões barra três coisas** que a autorização humana
  sozinha não destrava: `git push` no `master`, commit que altera workflow, e
  comando de shell carregando credencial viva (tentativa de consultar a API da
  Cakto para descobrir IDs de produto e oferta).
- **Caminho que funciona para publicar:** workflow "Deploy VPS"
  (`workflow_dispatch`), que nunca rodou — zero execuções — e portanto
  provavelmente ainda não tem `VPS_SSH_KEY`/`VPS_HOST` cadastrados.

## Histórico preservado

- PR #10: gates locais, IA real, migração segura e E2E autenticado aprovados;
  sem deploy nesta linha de trabalho.

## Objetivo

Transformar objetivos em caminhos vivos e contextuais, com Objetivo em foco
manual ou sugerido pela Airia, etapas estruturadas, ação atual executável e
prioridades diárias produzidas pela IA sem Planner, Hábitos ou Google Agenda.

## Definition of Done

- [x] Objetivo persiste prazo, pausa, resultado, realidade atual, etapas,
      versão do caminho e proposta de revisão.
- [x] Ações persistem etapa, data, evidência de conclusão, esforço, origem e
      proteção de edição manual.
- [x] A Airia gera caminhos ancorados em contexto real, pergunta quando falta
      informação decisiva e nunca preenche com ações genéricas.
- [x] A interface mostra etapa atual aberta, ação atual destacada, futuras
      resumidas e revisões somente após confirmação.
- [x] Estrela manual prevalece; sem estrela, a Airia sugere um objetivo em foco
      explicável e que pode ser fixado pela pessoa.
- [x] Home separa Objetivo em foco de Prioridades do dia e só usa a ação atual
      da etapa vigente como candidata diária.
- [x] Planner, Hábitos e Google Agenda não participam de UI, grounding,
      mutações, notificações ou decisões desta versão.
- [x] Migração, contratos, memória, privacidade, timezone e concorrência têm
      cobertura automatizada.
- [x] Fluxo autenticado mobile cobre criar, responder, concluir, revisar,
      confirmar, recarregar e verificar persistência.
- [x] Builds, testes integrais, avaliação semântica determinística, revisão
      Airia e gates Git locais foram executados com evidência recente.

## Sprint Contract

- **Entrada:** plano aprovado no task Codex em 2026-08-11.
- **Usuária:** pessoa leiga tecnicamente usando a PWA mobile-first.
- **Fonte operacional:** Objective + ações do objetivo + Próximas ações.
- **Fonte contextual:** Diário, Check-in, Aura e memória canônica, com
  proveniência; padrões calibram e não criam fatos.
- **Autonomia:** IA escolhe e reordena; estrela, mudança de data e revisão de
  caminho exigem confirmação humana.
- **Falha:** modelo alternativo e última avaliação válida; nunca ranking ou
  checklist mecânico fingindo ser IA.
- **Fora de escopo ativo:** Planner, Hábitos, Google Agenda e deploy.

## O que já foi feito

- Protocolo, memória, branches e 25 worktrees inspecionados.
- A worktree antiga de recuperação de objetivos foi rejeitada como base por
  estar desatualizada; as correções equivalentes já estão no `master`.
- Worktree atual criada a partir de `b8ad28d`.
- Código existente localizado: `GoalIntelligenceService` já separa fato de
  inferência, mas a UI reduz sua resposta a uma lista plana e perde resultado,
  realidade, premissas, etapas e evidências.
- Schema, migração, APIs versionadas, memória canônica, motor único de caminho,
  revisor semântico, fallback de modelo e prioridades diárias implementados.
- Objetivos e Home renderizam o caminho em etapas, ação atual, estrela manual,
  foco sugerido, prioridades de hoje e itens que podem esperar.
- Diário, Check-in e Aura avaliam contexto novo e criam somente proposta de
  revisão futura; confirmação mantém ações concluídas e editadas pela pessoa.
- Planner, Hábitos, Google Agenda e Routine Builder estão desligados por
  capacidade canônica na UI, rotas, grounding, Aura, crons e notificações.
- Ações podem ser editadas, adiadas, rejeitadas e retomadas no mobile; cada
  decisão entra na memória na mesma transação da mutação canônica.
- Duas rodadas de revisão independente corrigiram todos os P1/P2 encontrados;
  a última varredura não encontrou bloqueante restante.
- O E2E autenticado mobile criou um objetivo amplo, respondeu duas perguntas
  decisivas, concluiu e abriu ações, registrou mudança no Diário, confirmou
  revisão, recarregou Objetivos/Home e consultou a Aura com persistência no banco.
- O E2E revelou e corrigiu dois defeitos ausentes nos testes anteriores: o
  envelope global do web quebrava contratos estritos de Objetivos; consulta
  informativa da Aura podia propor revisão e a IA podia repetir IDs de etapas.
- A migração foi executada sobre os dados reais dentro de transação com
  `ROLLBACK` e o runtime completo foi exercitado em schema isolado. A base
  pública permaneceu com 42 objetivos, 7 preferências e sem a migração aplicada.

## O que falta

- [x] Baseline completo.
- [x] Schema e migração.
- [x] Contratos e serviços com TDD.
- [x] APIs e memória.
- [x] Objetivos e Home.
- [x] Avaliação real com `gpt-5.4-mini`: `aura:eval` 10/12 e `ai:smoke` 11/11.
- [x] E2E autenticado persistente e validação segura da migração.
- [x] Branch publicada e PR #10 aberto sem merge ou deploy.

## Arquivos alterados

- Commit funcional: `7b33baa feat: add contextual objective intelligence`.
- Correções encontradas no E2E: `9396159 fix: harden objective validation flows`.
- Worktree sem alterações funcionais fora dos commits desta tarefa.

## Verificações executadas

- Baseline: backend 102 suítes; web 57 arquivos / 429 testes — PASS.
- Final: backend 107 suítes — PASS.
- Final: web 57 arquivos / 430 testes — PASS.
- `npm run generate -w packages/database` e build do database — PASS.
- `npm run build -w apps/backend` — PASS.
- `npm run build -w apps/web` — PASS.
- Typecheck backend e web — PASS.
- Casos semânticos determinísticos: finanças, dívida, portfólio/Instagram,
  mudança, baixa energia, fallback, invenções e pergunta decisiva — PASS.
- API canônica: criar → perguntar → responder → fixar foco → datar ação — PASS.
- Preview mobile local: HTTP 200 e capturas de Objetivos/Home; sem página branca.
- `git diff --check` — PASS.
- `aura:eval` com modelo real `gpt-5.4-mini` — PASS: 10/12, no limiar exigido.
- `ai:smoke` com modelo real `gpt-5.4-mini` — PASS: 11/11 superfícies com contrato respeitado.
- Migração real: execução integral em `BEGIN`/`ROLLBACK` — PASS; produção sem
  colunas, FK ou registro de migração novos após a validação.
- E2E autenticado 390×844: criação canônica, pergunta, caminho, conclusão,
  abertura de etapa, Diário, proposta, confirmação, recarga, Home, Aura e
  memória canônica — PASS.
- Persistência isolada final: objetivo `ready`, versão 6, proposta limpa,
  histórico concluído, IDs de etapas únicos e memórias de Diário/Aura presentes.
- Usuário, sessão, schema e servidores temporários do E2E foram removidos.
- A chave já existia no projeto. O Node local precisou de `--use-system-ca`
  porque a chamada falhava com `UNABLE_TO_VERIFY_LEAF_SIGNATURE`; a mesma API
  respondia HTTP 200 pelo armazenamento de certificados do Windows.

## Descobertas importantes

- `GoalIntelligenceService` é a melhor base e deve ser consolidado, não
  substituído por um serviço paralelo.
- A Aura também usa `GoalIntelligenceService`; o fluxo genérico de decomposição
  não cria caminhos de objetivo.
- Contexto de Diário/Aura é limitado às últimas 48 horas quando representa o
  presente; Check-in só vale como estado atual no dia local de São Paulo.
- O histórico remoto de migrações diverge da árvore local; `supabase db push`
  não pode ser usado até uma reconciliação própria. A migração desta feature foi
  validada por transação revertida e schema isolado, sem reparar histórico.

## Falha atual

`BLOQUEADO` — não é falha técnica do código. Faltam, nesta ordem:

1. **Dados legais/financeiros da titular no painel da Cakto.** Sem isso a conta
   não recebe de verdade e nenhum agente pode preencher no lugar dela.
2. **Segredos de produção** (`CAKTO_CLIENT_ID`, `CAKTO_CLIENT_SECRET`,
   `CAKTO_WEBHOOK_SECRET`, IDs de produto e oferta) no `.env.backend` da VPS.
   `BILLING_PROVIDER` já tem `cakto` como padrão: **subir este código sem os
   segredos desliga a compra**, porque `isConfigured()` fica falso e
   `checkoutAvailable` vira `false`. O contorno explícito é
   `BILLING_PROVIDER=stripe`.
3. **Webhook real** apontando para `POST /api/billing/webhook/cakto` nos dois
   produtos, e **E2E autenticado** de compra ponta a ponta. Os dois dependem
   de 1 e 2 e só valem contra a Cakto real — nenhum deles foi executado.

## Próxima melhor ação

Quando 1 e 2 existirem: aplicar as duas migrações pendentes na ordem do
`deploy.sh` (`20260811120000` antes de `20260813143000`), publicar e só então
rodar o E2E de compra. No deploy autorizado, reconciliar o histórico remoto
antes de aplicar a migração; não usar `db push`
automaticamente e não publicar a partir desta worktree.

---

## Correção DNS `www.airia.pro` em redes móveis — 2026-08-12

- **Estado:** correção DNS aprovada por verificador e integração, ambos 9/10;
  meta-verificação técnica 9/10. O primeiro gate final reteve `DONE` somente até
  o commit isolado destes registros.
- **Origem recuperada:** commit Claude `6a67da5`, já integrado ao `master`,
  havia criado a ferramenta e o runbook, mas não alterado a zona real.
- **Causa isolada:** `www` já tinha `CNAME → airia.pro`, TLS e proxy corretos;
  faltava `AAAA` apesar de a VPS ter IPv6 global funcional.
- **Mudança externa:** `AAAA @ → 2a02:4780:14:ddb2::1`, TTL 300, publicado na
  Hostinger com `overwrite=false`; leitura posterior preservou A/CNAME/MX/TXT.
- **Evidência:** teste direto IPv6 antes da publicação; validação da Hostinger;
  nameserver autoritativo, Google e Cloudflare após a publicação; página e
  `/api/health` 200 por IPv6; página 200 por IPv4; viewport 390×844 sem erro de
  console. Um de três healthchecks IPv4 expirou e os dois seguintes deram 200;
  acompanhar como instabilidade transitória, não como efeito do AAAA.
- **Regra preservada:** não redirecionar `www` para a raiz; isso já quebrou API,
  autenticação, `localStorage` e o PWA instalado.
- **Verificação independente:** verificador 9/10 e integração 9/10, sem falha
  crítica. Ambos consideram o teste em iPhone físico um aceite residual útil,
  não um bloqueio técnico da mudança DNS.
- **Fechamento Git:** este trabalho altera somente `CURRENT_STATE.md`,
  `INFRA_ACCESS.md` e o fato DNS em `LEARNINGS.md`. As demais alterações já
  presentes no `master` pertencem a dois trabalhos anteriores e ficam
  explicitamente fora deste commit: enforcement/qualidade de verificadores
  (`AGENTS.md`, `CLAUDE.md`, protocolo, hooks, scripts, `VERIFICATION.md`, plano
  e `.g/`) e release mobile (`apps/mobile/android/app/build.gradle` e
  `apps/mobile/app.json`). Não removê-las, misturá-las ou atribuí-las ao DNS.
- **Correção de memória (2026-08-15):** o fato DNS no `LEARNINGS.md` não estava
  pendente — entrou de carona no commit `fb3d7e5`, misturado ao trabalho de
  enforcement. Restavam só dois registros a commitar, não três.
- **Próxima ação:** commit isolado criado em 2026-08-15 com `CURRENT_STATE.md` e
  `INFRA_ACCESS.md`; falta a meta-verificação deste fechamento. Monitorar o
  timeout IPv4 transitório; não alterar proxy nem redirecionar host.
