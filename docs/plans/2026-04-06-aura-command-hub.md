# Aura Command Hub Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fazer a Aura Chat atuar como hub de compromisso, meta e diário com confirmação explícita para compromissos e persistência de resumo do diário.

**Architecture:** O backend continua classificando a intenção e passa a expor metadados de confirmação e persistência de diário. O frontend segura a execução de compromissos até confirmação da usuária e mantém metas/diário no fluxo atual, reaproveitando endpoints existentes.

**Tech Stack:** React 18 + Vite + TypeScript, Express + TypeScript, Prisma, Supabase Auth, OpenAI GPT-4o-mini, SSE.

---

### Task 1: Formalizar contrato e testes da Aura Command

**Files:**
- Modify: `apps/backend/src/contracts/aura-command.contract.ts`
- Modify: `apps/backend/src/services/aura-command.service.test.ts`

**Step 1: Write the failing test**

Cobrir:
- resposta de compromisso com `needsConfirmation`
- resposta de diário com payload resumível

**Step 2: Run test to verify it fails**

Run: `npx tsx apps/backend/src/services/aura-command.service.test.ts`
Expected: FAIL por schema/asserções ausentes.

**Step 3: Write minimal implementation**

Adicionar novos campos/valores no contrato Zod e ajustar os testes fake.

**Step 4: Run test to verify it passes**

Run: `npx tsx apps/backend/src/services/aura-command.service.test.ts`
Expected: PASS

### Task 2: Persistir handoff de diário no backend

**Files:**
- Modify: `apps/backend/src/index.ts`

**Step 1: Write the failing test**

Adicionar teste que valide que um comando de diário resulta em sessão concluída com `summary`.

**Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@app/backend`
Expected: FAIL no novo cenário coberto.

**Step 3: Write minimal implementation**

Criar helper reaproveitando `finalizeJournalSession`/`journalSession` para persistir resumo a partir da conversa da Aura.

**Step 4: Run test to verify it passes**

Run: `npm run test --workspace=@app/backend`
Expected: PASS nos testes alterados.

### Task 3: Segurar compromisso em confirmação no frontend

**Files:**
- Modify: `apps/web/src/routes/aura-chat-page.tsx`

**Step 1: Write the failing test**

Se houver base de teste viável, cobrir; caso contrário, validar manualmente com fluxo controlado e manter a lógica isolada em helpers puros.

**Step 2: Run test to verify it fails**

Run: `npm run build --workspace=@app/web`
Expected: erro inicial ou ausência de comportamento.

**Step 3: Write minimal implementation**

Adicionar estado `pendingAction`, card de confirmação e handlers `confirm/cancel`.

**Step 4: Run test to verify it passes**

Run: `npm run build --workspace=@app/web`
Expected: PASS

### Task 4: Verificar o corte vertical

**Files:**
- Modify: `docs/plans/2026-04-06-aura-command-hub.md`

**Step 1: Run targeted checks**

Run:
- `npx tsx apps/backend/src/services/aura-command.service.test.ts`
- `npm run build --workspace=@app/web`

**Step 2: Confirm expected behavior**

- compromisso só salva após confirmar
- meta cria card-resumo
- diário persiste resumo em `journalSession`
