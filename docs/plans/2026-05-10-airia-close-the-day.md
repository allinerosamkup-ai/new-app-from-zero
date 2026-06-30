# Airia Close the Day Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transformar `/daily-summary` em fechamento operacional do dia, com ajustes de amanha ancorados em dados reais.

**Architecture:** A logica de produto fica em helper puro testado. A tela renderiza o view model e conecta os CTAs existentes para Planner, Diario e Check-in. Nenhuma acao e aplicada automaticamente.

**Tech Stack:** React 18, Vite, TypeScript, Zustand, Vitest/ts-node helper tests.

---

### Task 1: Daily Summary View Model

**Files:**
- Create: `apps/web/src/routes/daily-summary-page.helpers.ts`
- Test: `apps/web/src/routes/daily-summary-page.helpers.test.ts`

**Step 1: Write failing tests**

Testar:
- estado vazio sem dados;
- resumo com tarefas concluidas/pendentes;
- baixa energia gera ajuste de reduzir carga;
- habito pendente gera ajuste leve;
- sugestoes exigem ancora real.

**Step 2: Run test to verify it fails**

Run: `npx ts-node-transpile-only src/routes/daily-summary-page.helpers.test.ts` from `apps/web`.

Expected: FAIL because helper does not exist.

**Step 3: Implement helper**

Criar `buildDailyCloseSummary(input)` retornando `hasData`, `headline`, `evidence`, `stats`, `tomorrowAdjustments`, `primaryAction`.

**Step 4: Run test to verify it passes**

Run: `npx ts-node-transpile-only src/routes/daily-summary-page.helpers.test.ts`.

Expected: PASS.

### Task 2: Update Daily Summary Page

**Files:**
- Modify: `apps/web/src/routes/daily-summary-page.tsx`
- Test: `apps/web/src/routes/daily-summary-page.helpers.test.ts`

**Step 1: Keep helper tests green**

Run helper test before editing UI.

**Step 2: Render operational close**

Use `buildDailyCloseSummary(state)` at the top of the page. Render:
- headline;
- stats;
- evidence;
- tomorrow adjustments;
- CTAs: Planner, Diario, Check-in.

**Step 3: Preserve journal task flow as secondary**

Keep existing journal task generation, but below the operational close and only when `state.journal` exists.

**Step 4: Verify**

Run web tests and build.

### Task 3: Add Home Entry Point

**Files:**
- Modify: `apps/web/src/routes/home-page.tsx`
- Test: existing web tests.

**Step 1: Add small CTA**

Add a restrained "Fechar o dia" CTA near agenda/status sections. It navigates to `/daily-summary`.

**Step 2: Do not add fake data**

The CTA is navigation only. The summary page decides whether there is enough data.

**Step 3: Verify**

Run `npm run test --workspace=@app/web` and `npm run build --workspace=@app/web`.

### Task 4: Review and Release Hygiene

**Files:**
- Modify docs if needed.

**Step 1: Apply Airia PR Review skill**

Check product final vs demo, grounding, real flow, error visibility, timezone, risk safety and release hygiene.

**Step 2: Run full verification**

Run:
- `npm run test --workspace=@app/backend`
- `npm run build --workspace=@app/backend`
- `npm run test --workspace=@app/web`
- `npm run build --workspace=@app/web`

**Step 3: Report changed files and residual risks**

No deploy unless explicitly requested.

