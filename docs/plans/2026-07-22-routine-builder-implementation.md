# Airia Routine Builder Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Construir um montador transacional que converta texto, áudio transcrito e documentos em uma semana adaptada, revisável e persistida nas entidades operacionais existentes.

**Architecture:** Uma sessão persistente coordena extração, classificação em lote, esclarecimentos bloqueantes, composição semanal e aplicação atômica. O contexto diário e o motor adaptativo existentes decidem carga e posição; fontes antigas e documentos apenas fornecem evidência, nunca autoridade silenciosa para criar tarefas.

**Tech Stack:** TypeScript, Fastify, Zod, Prisma/PostgreSQL/Supabase, React/Vite, OpenAI structured output, Node test runner.

---

### Task 1: Contratos do domínio

**Files:**
- Create: `apps/backend/src/contracts/routine-builder.contract.ts`
- Create: `apps/backend/src/contracts/routine-builder.contract.test.ts`
- Modify: `apps/backend/package.json`

**Steps:**
1. Escrever testes para tipos de item, estados da sessão, limites, fonte e transições inválidas.
2. Executar o teste isolado e confirmar falha por módulo ausente.
3. Implementar schemas Zod com `RoutineItemKind`, evidência, confiança, recorrência, duração, prazo e estado de revisão.
4. Executar o teste isolado e a suíte de contratos.
5. Commitar somente contratos e testes.

### Task 2: Sessão persistente e alinhamento LGPD

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/20260722160000_add_routine_build_sessions/migration.sql`
- Modify: `apps/backend/src/services/privacy-redaction.allowlist.ts`
- Modify: `apps/backend/src/lib/privacy-allowlist.test.ts`

**Steps:**
1. Criar teste de deriva que exija a nova entidade na lista de privacidade.
2. Confirmar a falha.
3. Adicionar `RoutineBuildSession` com JSON para itens/perguntas/plano, hash de fonte, expiração do texto bruto, status e índice por usuário.
4. Criar SQL com FK, índices, RLS e política por `userId`.
5. Atualizar exportação/exclusão e fazer o teste passar.
6. Validar Prisma e commit.

### Task 3: Extração segura de fontes

**Files:**
- Create: `apps/backend/src/services/routine-source-extractor.service.ts`
- Create: `apps/backend/src/services/routine-source-extractor.service.test.ts`
- Modify: `apps/backend/package.json`

**Steps:**
1. Escrever testes para texto/Markdown, MIME inválido, arquivo acima de 10 MB e corte em 100 mil caracteres.
2. Confirmar falhas esperadas.
3. Implementar extração de texto e adaptadores PDF, DOCX e XLSX com dependências compatíveis já auditadas.
4. Garantir que nenhum conteúdo bruto seja logado.
5. Executar testes e commit.

### Task 4: Classificação em lote

**Files:**
- Create: `apps/backend/src/services/routine-classifier.service.ts`
- Create: `apps/backend/src/services/routine-classifier.service.test.ts`
- Modify: `apps/backend/src/lib/openai-client.ts` se necessário

**Steps:**
1. Escrever testes com uma fonte contendo meta, projeto, tarefa, hábito, compromisso, referência e preocupação.
2. Exigir saída estruturada com trecho de evidência, confiança e campos operacionais.
3. Confirmar a falha antes da implementação.
4. Implementar structured output e validação estrita; em falha do modelo, manter a sessão recuperável.
5. Detectar duplicados contra itens atuais e negativos de memória.
6. Executar testes e commit.

### Task 5: Esclarecimentos bloqueantes

**Files:**
- Create: `apps/backend/src/services/routine-clarification.service.ts`
- Create: `apps/backend/src/services/routine-clarification.service.test.ts`

**Steps:**
1. Testar que compromisso sem data, hábito sem frequência e tarefa ambígua geram perguntas específicas.
2. Testar limite de cinco e ausência de perguntas genéricas.
3. Confirmar falhas.
4. Implementar ranking determinístico por impacto no plano.
5. Executar testes e commit.

### Task 6: Composição da primeira semana

**Files:**
- Create: `apps/backend/src/services/routine-composer.service.ts`
- Create: `apps/backend/src/services/routine-composer.service.test.ts`
- Modify: `apps/backend/src/services/context-grounding.service.ts`
- Modify: `apps/backend/src/services/adaptive-agenda-engine.service.ts` apenas se faltar um ponto de extensão

**Steps:**
1. Testar proteção de compromisso fixo, hábito no dia correto, margem, prazo e redução de carga em contexto de baixa energia.
2. Confirmar falhas.
3. Compor candidatos usando `DailyContext` e decisões do motor adaptativo; não usar horário do dia para inferir fase.
4. Produzir justificativa concreta por item e lista explícita dos não alocados.
5. Executar testes e commit.

### Task 7: Aplicação atômica e idempotente

**Files:**
- Create: `apps/backend/src/services/routine-apply.service.ts`
- Create: `apps/backend/src/services/routine-apply.service.test.ts`

**Steps:**
1. Testar criação conjunta de `Objective`, `Habit` e `TimelineBlock` em transação.
2. Testar rollback total quando uma criação falha.
3. Testar segunda aplicação sem duplicação.
4. Confirmar falhas.
5. Implementar transação, proveniência e resultado com contagens/IDs.
6. Executar testes e commit.

### Task 8: Endpoints e máquina de estados

**Files:**
- Modify: `apps/backend/src/index.ts`
- Create: `apps/backend/src/routes/routine-builder.routes.test.ts`

**Steps:**
1. Escrever testes de autenticação, pertencimento, transições e erros úteis para os sete endpoints.
2. Confirmar falhas.
3. Implementar rotas reutilizando os serviços, rate limiting e EventLog sem conteúdo bruto.
4. Executar testes de rota, suíte backend e build.
5. Commit.

### Task 9: Interface de revisão e semana

**Files:**
- Create: `apps/web/src/features/routine-builder/types.ts`
- Create: `apps/web/src/features/routine-builder/api.ts`
- Create: `apps/web/src/features/routine-builder/routine-item-card.tsx`
- Create: `apps/web/src/features/routine-builder/week-preview.tsx`
- Create: `apps/web/src/routes/routine-builder-page.tsx`
- Create: `apps/web/src/routes/routine-builder-page.test.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: arquivos de i18n em `apps/web/src/i18n/`

**Steps:**
1. Testar entrada, edição de tipo, resposta às perguntas, prévia, confirmação e erro específico.
2. Confirmar falhas.
3. Implementar fluxo progressivo mobile-first sem jargões metodológicos.
4. Garantir estado de carregamento, retomada da sessão e acessibilidade.
5. Executar testes web e build; commit.

### Task 10: Aura, Planner e onboarding na mesma entrada

**Files:**
- Modify: `apps/backend/src/contracts/aura-command.contract.ts`
- Modify: `apps/backend/src/services/aura-command.service.ts`
- Modify: `apps/backend/src/services/airia-cognitive-interpreter.service.ts`
- Modify: `apps/web/src/routes/aura-chat-page.tsx`
- Modify: `apps/web/src/routes/planner-page.tsx`
- Modify: rota de onboarding responsável pelo planejamento

**Steps:**
1. Testar que “monte minha rotina” inicia/retoma `RoutineBuildSession`, sem criar cinco blocos genéricos.
2. Testar que ações simples continuam usando o fluxo direto existente.
3. Confirmar falhas.
4. Adicionar ação `start_routine_builder`, remover o fallback genérico e navegar para a sessão.
5. Fazer Planner e onboarding usarem a mesma entrada.
6. Executar testes e commit.

### Task 11: Verificação, documentação e produção

**Files:**
- Modify: `docs/product/airia-product-contract.md`
- Modify: `docs/product/airia-memory-architecture.md`
- Modify: `apps/backend/CLAUDE.md`

**Steps:**
1. Documentar autoridade, retenção e fluxo do Montador de Rotina.
2. Rodar testes backend/web e builds completos.
3. Aplicar checklist `skills/airia-pr-review/SKILL.md`.
4. Fazer push; aplicar a migration no Supabase de produção e verificar tabela, índices, RLS e persistência funcional.
5. Publicar pelo fluxo oficial e confirmar o mesmo SHA no GitHub/VPS.
6. Verificar `/api/health`, `/home` e um fluxo autenticado de classificação, composição e aplicação.
