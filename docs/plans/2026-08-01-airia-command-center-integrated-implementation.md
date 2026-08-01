# Airia Command Center Integrated Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fazer a Airia executar pedidos reais a partir do contexto integrado de humor, energia, check-in, diário, Planner e metas, sem repetição de voz, perguntas genéricas ou sugestões inventadas.

**Architecture:** A captura de voz e o check-in passam a produzir um único retrato de sinais reais; o mesmo retrato alimenta resultado, Airia, Planner, Insights e notificações. O Comando Central mantém um único executor idempotente para mutações, metas evoluem por ação ativa persistida, e notificações/relatórios consomem evidência calculada pelo backend em vez de estado local ou inferência livre.

**Tech Stack:** React 18, TypeScript, Vite/Vitest, Express, Prisma/PostgreSQL, Zod, Supabase, OpenAI.

---

### Task 1: Travar a captura de voz por sessão

**Files:**
- Create: `apps/web/src/features/voice/transcript-session.ts`
- Test: `apps/web/src/features/voice/transcript-session.test.ts`
- Modify: `apps/web/src/routes/checkin-page.tsx`, `apps/web/src/routes/aura-chat-page.tsx`, `apps/web/src/routes/journal-page.tsx`, `apps/web/src/routes/planner-page.tsx`

1. Escrever eventos cumulativos com interim, final, pausa, correcao e reinicio; cada final deve aparecer uma unica vez.
2. Implementar acumulador por indice: final imutavel, interim substituivel e limpeza no fim/cancelamento.
3. Migrar os quatro consumidores sem anexar texto cumulativo no estado da interface.
4. Rodar a suite da nova unidade e os testes das telas afetadas.

**Prova:** dizer uma frase com pausa no check-in deve deixar a transcricao integral uma vez, sem repeticao e sem perder fatores mencionados.

### Task 2: Unificar o rascunho e a persistencia do check-in

**Files:**
- Modify: `apps/web/src/routes/checkin-page.tsx`, `apps/web/src/features/aura/store.tsx`, `apps/web/src/features/aura/types.ts`
- Modify: `apps/backend/src/index.ts`, `apps/backend/src/contracts/checkin.contract.ts`, `apps/backend/src/services/checkin-application.service.ts`
- Test: `apps/web/src/features/aura/checkin-submission.test.ts`, `apps/backend/src/services/checkin-application.service.test.ts`

1. Escrever testes que falham para campos ausentes preservados como ausentes, sem diario antigo como nota e sem valores artificiais 3/5.
2. Fazer a voz preencher o rascunho editavel; emocao rotula o relato e nunca substitui humor/energia extraidos.
3. Reunir humor, energia, emocao e fatores de influencia na mesma sessao de check-in; detalhes expandem sem abrir fluxo fragmentado.
4. Hidratar todos os sinais persistidos em Home, Airia e Insights.

**Prova:** `humor 3`, `energia 7`, `irritada`, sono e fatores registrados reaparecem iguais apos recarregar e explicam a proxima leitura, sem criar outro check-in.

### Task 3: Fazer a Airia executar sem interrogatorio

**Files:**
- Modify: `apps/backend/src/lib/aura-prompt.ts`, `apps/backend/src/services/aura-command.service.ts`
- Modify: `apps/backend/src/services/aura-command-recovery.service.ts`, `apps/backend/src/services/aura-command-plan-builder.service.ts`, `apps/backend/src/services/aura-command-executor.service.ts`, `apps/backend/src/index.ts`
- Modify: `apps/web/src/routes/aura-chat-page.tsx`, `apps/web/src/components/aura/CommandPlanCard.tsx`
- Test: `apps/backend/src/services/aura-command.service.test.ts`, `apps/backend/src/services/aura-command-plan-builder.service.test.ts`, `apps/backend/src/services/aura-command-executor.service.test.ts`, `apps/web/src/routes/aura-chat-page.test.tsx`

1. Substituir regras de provocacao e “modo zero contexto” por decisao/executar quando houver alvo ou contexto atual; perguntar somente para alvo destrutivo ambíguo ou dado impossível de inferir.
2. Mapear todas as acoes anunciadas pelo contrato e encaminhar relato emocional ao resolvedor canônico com procedencia, sem preencher nota neutra.
3. Nao devolver/renderizar plano sem operacoes; para operacao autoaplicada, exibir confirmacao curta e desfazer quando cabivel.
4. Para agendamento sem hora, resolver slot futuro livre pela agenda e estado atual; manter confirmacao para ancora protegida.

**Prova:** “estou cansada e tenho praia com a Erica” registra contexto; “agenda reuniao com Carol” escolhe slot livre real; desabafo sem acao nao mostra cartao de 0 acoes; duas acoes na mesma fala persistem uma vez cada.

### Task 4: Transformar objetivos em execucao sequencial

**Files:**
- Modify: `packages/database/prisma/schema.prisma`, `apps/backend/src/lib/objective-subgoals.ts`, `apps/backend/src/index.ts`
- Create: `apps/backend/src/services/objective-progression.service.ts`
- Test: `apps/backend/src/services/objective-progression.service.test.ts`
- Modify: `apps/web/src/features/aura/store.tsx`, `apps/web/src/routes/goals-page.tsx`, `apps/web/src/routes/planner-page.tsx`
- Test: `apps/web/src/utils/goal-priority-actions.test.ts`

1. Escrever teste de meta ordenada, conclusao fora de ordem rejeitada, clique duplicado idempotente e conclusao final unica.
2. Persistir `id`, `title`, `done`, `order` e vinculo opcional de bloco do Planner; aceitar legado `completed` somente na leitura/migracao.
3. Criar endpoint/servico atomico de avancar a acao ativa e atualizar progresso.
4. Fazer Goals e Planner chamar o mesmo avancar; renderizar uma unica proxima acao verde e usar `RewardBurst` ao concluir.
5. Remover a aba interna quebrada de Tarefas, preservando timeline e todas as tarefas reais do Planner/Airia.

**Prova:** a meta criada por tela ou Airia recebe 2–5 acoes ordenadas; ao concluir e recarregar somente a proxima fica verde; a ultima celebra uma vez e o Planner continua operando.

### Task 5: Usar um motor unico para padroes e relatorios

**Files:**
- Modify: `packages/shared/src/mood-cycle-engine.ts`, `apps/web/src/utils/mood-cycle-engine.ts`, `apps/backend/src/services/adaptive-scheduling.service.ts`
- Modify: `apps/backend/src/services/insight.service.ts`, `apps/web/src/routes/insights-page.tsx`, `apps/backend/src/index.ts`
- Test: `packages/shared/src/mood-cycle-engine.test.ts` ou teste equivalente, `apps/backend/src/services/insight.service.test.ts`

1. Criar testes para dados insuficientes, estabilidade positiva, estabilidade negativa, oscilacao e sinal de atencao sem diagnostico.
2. Consolidar calculos de fase, baseline, estabilidade, janela, tamanho de amostra e confianca no pacote compartilhado.
3. Mostrar associacao somente com pares e janela suficientes; declarar tamanho de amostra, periodo e limite, sem causalidade.
4. Passar ao modelo apenas agregados calculados e proibicoes de diagnostico; manter protocolo de seguranca deterministico antes da IA.

**Prova:** o mesmo historico gera a mesma fase/estabilidade em todas as superficies; relatorio de 180/365 dias usa intervalo real ou informa indisponibilidade; nenhum texto rotula depressao, mania ou bipolaridade.

### Task 6: Centralizar a politica de notificacoes

**Files:**
- Modify: `apps/backend/src/lib/notification-filters.ts`, `apps/backend/src/index.ts`
- Modify: `apps/web/src/components/AutonomousAIEngine.tsx`
- Test: `apps/backend/src/lib/notification-filters.test.ts`, testes de cron/rotas afetadas

1. Escrever testes para item passado, concluido, adiado, futuro, preferencia desligada e entrega duplicada.
2. Remover a reativacao silenciosa de tarefas passadas; itens atrasados ficam para revisao, nunca viram “hoje”.
3. Aplicar politica backend unica: entidade real, horario futuro local, permissao, janela de silencio, limite diario e chave de deduplicacao persistida.
4. Fazer o motor do navegador somente apresentar decisoes do backend ou removê-lo do envio.

**Prova:** evento passado nao move nem notifica; evento futuro elegivel recebe uma entrega; concluir, adiar ou desligar preferencias cancela a elegibilidade.

### Task 7: Verificar e publicar sem tocar nos dados da usuaria

**Files:**
- Modify: `docs/product/airia-product-contract.md`, `docs/product/api-contracts.md`, `skills/_registry.md`
- Test: suites Web/Backend afetadas e fluxo autenticado de producao

1. Rodar testes de unidade, tipos e build dos dois apps.
2. Usar `allinerosakup@gmail.com` apenas como conta de validacao com dados existentes: sem seed, sem limpeza e sem remover fatores de influencia.
3. Verificar voz, check-in, Airia, objetivo, Planner, notificacoes e relatorio no navegador em viewport mobile; capturar evidencia.
4. Aplicar a checklist `skills/airia-pr-review/SKILL.md`, publicar e confirmar SHA igual em GitHub/VPS, `/api/health` e `/home`.

**Prova:** producao responde com o SHA publicado e os fluxos reais da conta preservam seus dados e fatores.
