# Planner Metadata Persistence Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Persistir notas, checklist, recorrencia e nivel de energia dos blocos do Planner no banco, mantendo edicao completa para blocos manuais e sugeridos.

**Architecture:** Reusar `timeline_blocks` como fonte unica dos blocos salvos. Adicionar campos de metadata no proprio bloco, aceitar esses campos no contrato `/api/timeline`, retornar tudo em `GET /api/timeline/:date` e manter `localStorage` apenas como fallback legado para dados criados antes da migracao.

**Tech Stack:** Prisma + Supabase PostgreSQL, Express + Zod, React 18 + Vite + TypeScript, testes Node/Vitest existentes.

---

## Status

Executado em 2026-04-12. Testes e builds backend/web passaram. `npm run db:generate` atualizou os tipos do Prisma, mas retornou EPERM ao substituir a DLL `query_engine-windows.dll.node` porque havia processo Node mantendo o arquivo travado no Windows.

Supabase remoto atualizado em 2026-04-12:
- `gcal_event_id` confirmado em `public.timeline_blocks`.
- `note_mode`, `note`, `checklist`, `recurring`, `energy_level` e `last_reset_date` confirmados em `public.timeline_blocks`.
- Escrita/leitura real de metadata validada no banco remoto com dado temporario removido em seguida.
- RLS ativado em `public.memory_embeddings` com policy `memory_embeddings_manage_own`, porque o advisor do Supabase apontou alerta critico.

## Decisao de escopo

Esta fase nao cria um novo modelo de tarefa, nao cria endpoint separado e nao muda o fluxo visual do Planner. A persistencia entra no mesmo `timeline_blocks` para evitar duplicar estrutura.

## Reaproveitamento obrigatorio

- Reusar `TimelineBlockSchema` e `PlannerSyncSchema`.
- Reusar `POST /api/timeline` para salvar bloco + metadata.
- Reusar `GET /api/timeline/:date` para hidratar a tela do Planner.
- Reusar `task-metadata.ts` como fonte de tipos e fallback legado.
- Reusar `PlannerSheetBody`, `NoteSection` e `RecurringSection`.

## Regras de produto

- Todo bloco do Planner deve poder salvar e recuperar:
  - modo de nota
  - nota textual
  - checklist com itens e estado concluido
  - recorrencia
  - nivel de energia visual
  - data de reset de checklist recorrente
- Blocos sugeridos pela IA devem usar o mesmo contrato dos blocos manuais.
- Atualizacoes parciais, como concluir ou arrastar horario, nao podem apagar metadata existente.
- Google Agenda continua externo enquanto nao for importado como `timeline_blocks`.

---

## Task 1: Contrato de metadata do Planner

**Files:**
- Modify: `apps/backend/src/services/planner.service.ts`
- Modify: `apps/backend/src/contracts/planner.contract.test.ts`
- Modify: `apps/web/src/routes/planner-page.helpers.ts`
- Modify: `apps/web/src/routes/planner-page.helpers.test.ts`

**Steps:**
1. Escrever teste backend aceitando `noteMode`, `note`, `checklist`, `recurring`, `energyLevel` e `lastResetDate`.
2. Rodar `npm run test --workspace=@app/backend` e confirmar falha no contrato.
3. Estender `TimelineBlockSchema` com metadata opcional e normalizada.
4. Escrever teste web garantindo que `buildTimelineBlockInput` inclui metadata quando recebe um form completo.
5. Rodar teste web direcionado e confirmar falha.
6. Atualizar helper web para serializar metadata.
7. Rodar testes direcionados ate passar.

## Task 2: Schema e migration

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `supabase/migrations/20260412120000_add_timeline_block_metadata.sql`

**Steps:**
1. Adicionar campos em `TimelineBlock`: `noteMode`, `note`, `checklist`, `recurring`, `energyLevel`, `lastResetDate`.
2. Criar migration Supabase com `alter table public.timeline_blocks add column if not exists ...`.
3. Usar defaults seguros para nao quebrar blocos antigos.
4. Rodar `npm run db:generate` para atualizar Prisma Client.

## Task 3: Persistencia no backend

**Files:**
- Modify: `apps/backend/src/index.timeline.test.ts`
- Modify: `apps/backend/src/index.ts`

**Steps:**
1. Escrever teste que salva metadata pelo `POST /api/timeline` e valida payload enviado ao Prisma.
2. Escrever teste que uma atualizacao parcial sem metadata preserva campos existentes.
3. Confirmar falha.
4. Atualizar `POST /api/timeline` para gravar metadata apenas quando enviada.
5. Atualizar `GET /api/timeline/:date` para retornar metadata.
6. Rodar `npm run test --workspace=@app/backend`.

## Task 4: Hidratar Planner pela API

**Files:**
- Modify: `apps/web/src/routes/planner-page.tsx`

**Steps:**
1. Estender `PlannerTask` e `mapTaskFromApi` para carregar metadata.
2. Atualizar `buildFormStateFromTask` para preferir metadata da API e usar `localStorage` somente como fallback.
3. Atualizar criacao/edicao para enviar metadata no payload principal.
4. Manter `setTaskMeta` como cache legado, sem depender dele para a verdade principal.
5. Garantir que concluir, arrastar e excluir nao apagam metadata.

## Task 5: Documentacao e verificacao

**Files:**
- Modify: `docs/product/api-contracts.md`
- Modify: `docs/plans/2026-04-12-home-agenda-smart-scheduling.md`

**Steps:**
1. Documentar novos campos no contrato de Planner.
2. Marcar a Fase 2 anterior como executada.
3. Rodar:
   - `npm run test --workspace=@app/backend`
   - `npm run test --workspace=@app/web`
   - `npm run build --workspace=@app/backend`
   - `npm run build --workspace=@app/web`
