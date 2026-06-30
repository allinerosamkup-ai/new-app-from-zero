# Home Agenda Smart Scheduling Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transformar a "Agenda do dia" da Home em um resumo util do hoje e impedir que sugestoes da IA sejam salvas em horarios aleatorios ou ocupados.

**Architecture:** Reaproveitar a Home atual, o store existente, `timeline_blocks`, `habits`, `PlannerService`, `PlannerSyncSchema` e o endpoint atual `/api/ai/suggest`. A regra de horario das sugestoes fica no backend e tambem e validada no salvamento, para nao depender apenas do prompt da IA.

**Tech Stack:** React 18 + Vite + TypeScript, Zustand/Context atual em `features/aura/store.tsx`, Express + Prisma, Supabase Postgres, testes Node/Vitest existentes.

---

## Decisao de escopo

Fazer primeiro a mudanca de agenda e sugestoes inteligentes. Nao misturar agora a persistencia de notas/checklists do Planner no banco, porque isso exige migration e aumenta o risco de mexer em uma parte que ja esta quase pronta. Essa persistencia entra como Fase 2.

## Reaproveitamento obrigatorio

- Reusar `state.tasks` e `state.habits` ja carregados em `apps/web/src/features/aura/store.tsx`.
- Reusar a secao existente "Agenda do dia" em `apps/web/src/routes/home-page.tsx`.
- Reusar `AgendaBlock`, `dedupeAgendaBlocks` e testes de `apps/web/src/routes/home-page.helpers.ts`.
- Reusar `/api/ai/suggest` com `type: "agenda-blocks"`.
- Reusar `/api/timeline/:date` e `/api/timeline`.
- Reusar `PlannerService.parseTimeToDate`, `PlannerService.detectConflicts` e `TimelineBlockSchema`.
- Reusar a integracao Google Agenda ja existente apenas como fonte de eventos ocupados quando estiver conectada; nao criar outro fluxo OAuth.

## Regras de produto

- A Home mostra os 3 proximos compromissos/tarefas do dia e 1 habito pendente dentro de "Agenda do dia".
- "Agenda do dia" deve ser entendida como compromissos + tarefas + habitos, nao apenas lista de tarefas.
- A sugestao da IA continua dentro da "Agenda do dia", mas como camada extra para acrescentar algo ou preencher o dia vazio.
- Sugestoes da IA so podem ser salvas entre 08:00 e 20:00.
- Sugestoes da IA so podem entrar em horarios livres.
- Depois das 18:00, sugestoes da IA devem ser para o dia seguinte.
- Tarefa manual continua livre: a pessoa pode escolher qualquer horario.
- Pedido explicito de horario pela pessoa continua permitido, desde que venha de fluxo manual/comando confirmado; essa regra nao deve bloquear edicao manual do Planner.
- Qualquer tarefa que entrou no Planner vira um bloco normal e completamente editavel pelo usuario, seja manual, sugerida pela IA, vinda da Home ou criada por comando.
- Nenhum bloco sugerido pode ficar travado, sem editar horario, titulo, categoria, energia/intensidade, notas, checklist, recorrencia, conclusao ou exclusao.
- A IA deve escolher a faixa pelo esforco:
  - pesada/trabalho/foco: preferir 08:00-12:00
  - media: preferir 10:00-16:00
  - leve/autocuidado/casa/social: preferir 14:00-20:00
  - se a faixa preferida estiver ocupada, procurar outro horario livre entre 08:00 e 20:00

---

## Task 1: Helpers da Home para resumo da Agenda do dia

**Files:**
- Modify: `apps/web/src/routes/home-page.helpers.ts`
- Test: `apps/web/src/routes/home-page.helpers.test.ts`

**Step 1: Add tests first**

Create tests for:
- returns at most 3 pending commitments/tasks sorted by time
- excludes completed tasks
- adds at most 1 due habit
- does not duplicate habit text as task text
- returns empty arrays when there is no agenda content

**Step 2: Implement helper types**

Add a small UI-facing helper, without backend calls:

```ts
export type HomeAgendaTaskItem = {
  id: string | number;
  kind: "task";
  title: string;
  time: string;
  category?: string;
};

export type HomeAgendaHabitItem = {
  id: string;
  kind: "habit";
  title: string;
  icon?: string;
  reminderTime?: string | null;
};

export function buildHomeAgendaPreview(input: {
  tasks: Array<{ id: string | number; title: string; time: string; done: boolean; category?: string }>;
  habits: Array<{ id: string; title: string; icon?: string; completions?: unknown[]; reminderEnabled?: boolean; reminderTime?: string | null }>;
}): { tasks: HomeAgendaTaskItem[]; habit: HomeAgendaHabitItem | null };
```

**Step 3: Run targeted test**

Run:

```bash
npm run test --workspace=@app/web -- home-page.helpers.test.ts
```

Expected: new tests pass.

---

## Task 2: Reformatar a secao "Agenda do dia" na Home

**Files:**
- Modify: `apps/web/src/routes/home-page.tsx`
- Reuse: `apps/web/src/features/aura/store.tsx`

**Step 1: Use the helper**

In `HomePage`, derive:

```ts
const homeAgendaPreview = useMemo(
  () => buildHomeAgendaPreview({ tasks: state.tasks, habits: state.habits ?? [] }),
  [state.tasks, state.habits],
);
```

**Step 2: Render default agenda content**

Inside the existing "Agenda do dia" block, replace the idle `null` state with:
- up to 3 next commitment/task rows
- 1 pending habit row
- a neutral empty state if both are empty
- the existing `Montar com IA` action remains visible

**Step 3: Remove duplicated surface**

Merge or remove the later "Proximo na agenda" block, because the same information now belongs to "Agenda do dia".

**Step 4: Keep styling local**

Use existing `aura-card`, `home-agenda-card`, `home-soft-row`, `AuraButtonV2`, and CSS variables. Do not create new global design tokens.

---

## Task 3: Backend scheduling helpers for AI suggestions

**Files:**
- Modify: `apps/backend/src/services/planner.service.ts`
- Test: create or update `apps/backend/src/services/planner.service.test.ts`

**Step 1: Add tests first**

Cover:
- `resolveSuggestedAgendaDate("2026-04-12", 17)` returns `2026-04-12`
- `resolveSuggestedAgendaDate("2026-04-12", 18)` returns `2026-04-13`
- suggested windows never start before `08:00`
- suggested windows never end after `20:00`
- occupied windows are skipped
- heavy blocks prefer morning
- light blocks prefer afternoon/evening
- no free slot returns no saveable block

**Step 2: Extend `PlannerService`**

Add pure methods, reusing existing time helpers where possible:

```ts
static resolveSuggestedAgendaDate(localDate: string, hour: number): string
static timeToMinutes(time: string): number
static minutesToTime(minutes: number): string
static normalizeBusyWindows(blocks: Array<{ startTime: string; endTime: string }>): BusyWindow[]
static findSuggestedSlot(input: {
  intensity: "L" | "M" | "P";
  category: string;
  durationMinutes: number;
  busyWindows: BusyWindow[];
}): { startTime: string; endTime: string } | null
```

**Step 3: Scheduling rules**

- hard window: 08:00-20:00
- scan in 15 minute increments
- include existing timeline blocks as busy
- include connected Google events as busy when supplied by context
- do not mutate manual planner behavior

---

## Task 4: Harden `/api/ai/suggest` for `agenda-blocks`

**Files:**
- Modify: `apps/backend/src/index.ts`
- Reuse: `apps/backend/src/services/planner.service.ts`

**Step 1: Change the prompt goal**

Current prompt asks for 6-8 blocks covering the whole day. Replace that behavior for Home suggestions:
- generate 1-4 optional additions
- never rebuild the entire routine
- never duplicate existing planner items
- respect `targetDate`
- explain briefly why each suggested block fits the energy state

**Step 2: Compute target date on the backend**

Inside the `agenda-blocks` branch:
- read `context.localDate`
- read `context.hour`
- compute `targetDate` using `PlannerService.resolveSuggestedAgendaDate`
- query existing `timelineBlock` rows for that user/date

**Step 3: Post-process AI output**

After parsing/sanitizing AI output:
- attach `local_date: targetDate` to each `AgendaBlock`
- clamp or reschedule each suggestion through `PlannerService.findSuggestedSlot`
- drop saveable tasks that cannot fit
- keep `descanso`/`refeicao` only as display notes, not saveable tasks

**Step 4: Extend `AgendaBlock` contract**

Add optional fields in frontend type:

```ts
local_date?: string;
intensity?: "L" | "M" | "P";
blocked_reason?: string;
```

Do not add database fields for this task.

---

## Task 5: Validate conflicts against existing timeline on save

**Files:**
- Modify: `apps/backend/src/index.ts`
- Test: `apps/backend/src/index.timeline.test.ts`

**Step 1: Add failing test**

Test that `POST /api/timeline` with `forceSave: false` returns `409` when the incoming block overlaps an existing block for the same user/date.

**Step 2: Implement existing-block conflict check**

In `/api/timeline`:
- keep current incoming-vs-incoming conflict detection
- when `forceSave` is false, query existing blocks for `userId + localDate`
- ignore the same `id` when editing
- detect overlap against incoming blocks
- return 409 with useful conflict details

**Step 3: Preserve manual freedom**

All existing manual flows that intentionally pass `forceSave: true` continue saving normally.

---

## Task 6: Save Home AI agenda suggestions to the correct date

**Files:**
- Modify: `apps/web/src/routes/home-page.tsx`
- Reuse: `/api/timeline`

**Step 1: Stop hardcoding today**

Current `approveAgenda()` uses:

```ts
const today = getLocalDateKey();
```

Change it to group selected blocks by `block.local_date ?? getLocalDateKey()`.

**Step 2: Use conflict-safe save**

For AI agenda suggestions, send:

```ts
forceSave: false
```

Manual Planner creation stays unchanged.

**Step 3: Update feedback**

If the target date is tomorrow, show copy like:

```txt
Entrou no planner de amanha.
```

If a conflict appears because the agenda changed after suggestion generation, show:

```txt
Esse horario ficou ocupado. Vou refazer a sugestao.
```

Then reset to `idle` or call `fetchAgenda()` again.

---

## Task 7: Guarantee complete editability for every Planner block

**Files:**
- Modify: `apps/web/src/routes/planner-page.tsx`
- Reuse: `apps/web/src/routes/planner-page.helpers.ts`
- Reuse: `apps/web/src/utils/task-metadata.ts`
- Test: `apps/web/src/routes/planner-page.helpers.test.ts`

**Step 1: Treat AI suggestions as normal blocks**

When Home AI suggestions are saved through `/api/timeline`, they must come back as regular `TimelineBlock` rows. Do not introduce a separate read-only source or a separate suggested-task model.

**Step 2: Preserve the existing edit sheet**

Every saved timeline block must open the same edit flow already used by manual blocks:
- title
- date
- start time
- end time
- category/tag
- energy/intensity
- notes
- checklist
- recurring config
- complete/reopen
- delete

**Step 3: Avoid locked UI states**

If a block is marked with `isAiSuggested` later, use it only for a small visual label. It must not disable editing.

**Step 4: Clarify Google events**

Google Calendar events that are only displayed as external events are not local Planner blocks yet. If the product needs them fully editable inside Planner, they must first be imported/saved as `timeline_blocks`; otherwise editing them would require editing the external Google event directly.

---

## Task 8: Optional Google Agenda busy windows

**Files:**
- Modify: `apps/web/src/routes/home-page.tsx`
- Reuse: `GET /api/gcal/events?date=YYYY-MM-DD`

**Step 1: Fetch only when building AI suggestions**

In `fetchAgenda()`, after target date is known from frontend or returned by backend, reuse the existing endpoint to load Google busy windows when connected.

**Step 2: Pass busy windows as context**

Map Google events to:

```ts
externalBusyWindows: Array<{ title: string; startTime: string; endTime: string; source: "gcal" }>
```

**Step 3: Keep this best-effort**

If Google fetch fails, continue with internal timeline availability. Do not block the Home.

---

## Task 9: Verification

**Commands:**

```bash
npm run test --workspace=@app/web -- home-page.helpers.test.ts
npm run test --workspace=@app/backend
npm run build --workspace=@app/web
npm run build --workspace=@app/backend
```

**Manual checks:**
- Home shows 3 next commitments/tasks and 1 habit inside "Agenda do dia".
- Home no longer duplicates "Proximo na agenda" below.
- Empty agenda still offers AI suggestion.
- Before 18:00, AI suggestions target today.
- At/after 18:00, AI suggestions target tomorrow.
- Suggested blocks never save before 08:00 or after 20:00.
- Suggested blocks avoid occupied internal timeline slots.
- Manual Planner creation still allows arbitrary user-selected time.
- A suggestion accepted from the Home opens in Planner with full edit controls.
- Editing an AI-suggested block can change title, date, time, category, intensity, notes/checklist and recurrence.
- Deleting or completing an AI-suggested block behaves exactly like a manual block.

---

## Fase 2: Persistir metadata do Planner no banco

Status: executada no plano `docs/plans/2026-04-12-planner-metadata-persistence.md`.

Do separately after the Home/scheduling change is stable.

**Why:** current notes/checklists/recurrence metadata lives in `localStorage` through `apps/web/src/utils/task-metadata.ts`. Moving it to Supabase is correct, but requires Prisma schema, migration, backend contract and data migration behavior.

**Likely files later:**
- `packages/database/prisma/schema.prisma`
- `supabase/migrations/*`
- `apps/backend/src/index.ts`
- `apps/web/src/utils/task-metadata.ts`
- `apps/web/src/routes/planner-page.tsx`
