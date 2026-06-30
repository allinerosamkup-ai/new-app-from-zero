# Journal Single Entry Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplificar o Journal para uma única entrada de chat e transformar a própria página em histórico vivo das sessões concluídas.

**Architecture:** O frontend deixa de ter múltiplos cards de método e passa a abrir uma única sessão de diário com histórico de resumos na mesma tela. O backend reaproveita `journalSession.summary` e passa a incluir resumos recentes no contexto do diário para que a IA use essa memória visível.

**Tech Stack:** React 18 + Vite + TypeScript, Express + TypeScript, Prisma, Supabase Auth, OpenAI GPT-4o-mini, SSE.

---

### Task 1: Atualizar contexto do diário no backend

**Files:**
- Modify: `apps/backend/src/services/journal.service.ts`
- Modify: `apps/backend/src/services/journal.service.test.ts`

**Step 1: Write the failing test**

Cobrir que `buildRoutineContext` expõe resumos recentes e os incorpora ao `promptSummary`.

**Step 2: Run test to verify it fails**

Run: `ts-node-transpile-only src/services/journal.service.test.ts`
Expected: FAIL nas novas asserções.

**Step 3: Write minimal implementation**

Adicionar resumos recentes ao contexto do diário e ao texto usado pela IA.

**Step 4: Run test to verify it passes**

Run: `ts-node-transpile-only src/services/journal.service.test.ts`
Expected: PASS

### Task 2: Refatorar Journal para entrada única + histórico

**Files:**
- Modify: `apps/web/src/routes/journal-page.tsx`

**Step 1: Implement minimal refactor**

- remover seleção de método
- iniciar sessão única
- listar sessões recentes
- mostrar resumo recém-finalizado dentro da própria página

**Step 2: Verify build**

Run: `npm run build --workspace=@app/web`
Expected: PASS

### Task 3: Remover acesso do diário da barra principal

**Files:**
- Modify: `apps/web/src/routes/aura-layout.tsx`
- Modify: `apps/web/src/App.tsx`

**Step 1: Remove nav entry**

Tirar `Diário` da barra inferior, mantendo rota ativa e cards de acesso em Home.

**Step 2: Verify integration**

Run: `npm run build --workspace=@app/web`
Expected: PASS
