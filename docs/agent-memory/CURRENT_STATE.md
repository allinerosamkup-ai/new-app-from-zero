# CURRENT_STATE — trabalho em andamento

## Status

`IN PROGRESS — migração da cobrança para Cakto, com Stripe preservado como contingência`

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

Sem bloqueio técnico conhecido. A migração pública, merge e deploy continuam
intencionalmente não executados porque exigem autorização explícita de produção.

## Próxima melhor ação

Revisar e integrar o PR #10 quando houver autorização. No deploy autorizado,
reconciliar o histórico remoto antes de aplicar a migração; não usar `db push`
automaticamente e não publicar a partir desta worktree.
