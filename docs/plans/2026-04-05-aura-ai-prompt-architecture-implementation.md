# Aura AI Prompt Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Centralize Aura identity and surface policies, separate the operational Aura command flow from the journal flow, and enforce post-session task generation only after diary finalization.

**Architecture:** Strengthen `aura-prompt.ts` into the single source of truth for Aura identity plus per-surface behavior policies. Add a dedicated backend command surface for the center star Aura UI, then split the journal into `journal-live` and `journal-finalize` so behavior is guaranteed both by prompt policy and backend control flow.

**Tech Stack:** React 18, Vite, TypeScript, Express, Zod, OpenAI Chat Completions, Zustand, SSE streaming

---

### Task 1: Strengthen the Aura core prompt and add explicit surface policies

**Files:**
- Modify: `apps/backend/src/lib/aura-prompt.ts`
- Modify: `apps/backend/src/lib/aura-prompt.test.ts`
- Modify: `apps/backend/CLAUDE.md`

**Step 1: Write the failing tests**

Add assertions in `apps/backend/src/lib/aura-prompt.test.ts` for:
- `journal-live` forbids closing and task suggestion
- `journal-finalize` allows summary and task generation
- `aura-command` is operational, not reflective by default

Example assertions:

```ts
const live = buildAuraSystemPrompt({ domain: 'journal-live' as any });
assert.match(live, /não encerre a conversa/i);
assert.match(live, /não sugira tarefas/i);

const finalize = buildAuraSystemPrompt({ domain: 'journal-finalize' as any });
assert.match(finalize, /resuma a sessão/i);
assert.match(finalize, /gere 0 a 3 tarefas/i);

const command = buildAuraSystemPrompt({ domain: 'aura-command' as any });
assert.match(command, /copiloto operacional/i);
assert.doesNotMatch(command, /diário reflexivo/i);
```

**Step 2: Run test to verify it fails**

Run:

```bash
npx tsx src/lib/aura-prompt.test.ts
```

Expected: FAIL because the new surface policies do not exist yet.

**Step 3: Write minimal implementation**

Update `apps/backend/src/lib/aura-prompt.ts` to:
- extend the domain type with:
  - `aura-command`
  - `journal-live`
  - `journal-finalize`
- move universal anti-generic and anti-repetition rules into the core prompt
- define surface policies for the new domains
- keep existing consumers working during the migration

Update `apps/backend/CLAUDE.md` so it documents the new prompt API shape instead of the old positional signature.

**Step 4: Run test to verify it passes**

Run:

```bash
npx tsx src/lib/aura-prompt.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/src/lib/aura-prompt.ts apps/backend/src/lib/aura-prompt.test.ts apps/backend/CLAUDE.md
git commit -m "refactor: strengthen aura core prompt policies"
```

### Task 2: Create a dedicated backend service for the center star Aura command flow

**Files:**
- Create: `apps/backend/src/services/aura-command.service.ts`
- Create: `apps/backend/src/services/aura-command.service.test.ts`
- Create: `apps/backend/src/contracts/aura-command.contract.ts`
- Modify: `apps/backend/src/index.ts`

**Step 1: Write the failing test**

Create `apps/backend/src/services/aura-command.service.test.ts` to assert:
- clear task requests classify to `planner_task`
- multi-step requests classify to `goal_project` or `checklist`
- emotional requests classify to `reflective_handoff`
- unclear requests produce a single clarification question

Example:

```ts
assert.equal(result.intent, 'planner_task');
assert.equal(result.action, 'create_task');
assert.equal(result.needsClarification, false);
```

**Step 2: Run test to verify it fails**

Run:

```bash
npx tsx src/services/aura-command.service.test.ts
```

Expected: FAIL because the service and contract do not exist yet.

**Step 3: Write minimal implementation**

Create:
- `apps/backend/src/contracts/aura-command.contract.ts`
  - request and response schemas
- `apps/backend/src/services/aura-command.service.ts`
  - one public method that builds command responses
  - use `buildAuraSystemPrompt({ domain: 'aura-command' })`
- backend endpoints in `apps/backend/src/index.ts`:
  - `POST /api/aura/command/start`
  - `POST /api/aura/command/stream`

Use SSE only if the UI still benefits from incremental output; otherwise keep the response contract simple and deterministic.

**Step 4: Run test to verify it passes**

Run:

```bash
npx tsx src/services/aura-command.service.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/src/contracts/aura-command.contract.ts apps/backend/src/services/aura-command.service.ts apps/backend/src/services/aura-command.service.test.ts apps/backend/src/index.ts
git commit -m "feat: add dedicated aura command backend flow"
```

### Task 3: Migrate the center star Aura web surface off the journal pipeline

**Files:**
- Modify: `apps/web/src/routes/aura-chat-page.tsx`
- Test manually: `apps/web/src/routes/aura-chat-page.tsx`

**Step 1: Write the failing test or manual check**

Document the manual regression checks before code:
- opening `/aura` must no longer call `/journal/start`
- sending “marca dentista amanhã 14h” must not behave as journaling
- planner action suggestions must still be addable from the chat UI

If you add an automated test harness later, target those three behaviors.

**Step 2: Run manual check to verify current behavior is wrong**

Run the app and confirm:
- the page still hits `/journal/start`
- the flow is coupled to `/journal/message/stream`

Expected: current behavior proves the migration is still needed.

**Step 3: Write minimal implementation**

Update `apps/web/src/routes/aura-chat-page.tsx` to:
- start with `/api/aura/command/start`
- stream or post through `/api/aura/command/stream`
- consume the new command contract:
  - assistant message
  - intent
  - action
  - payload
  - clarification question when required
- keep the existing “add task to planner” affordance, but drive it from the command payload instead of journal task suggestions

**Step 4: Run verification**

Run:

```bash
npm run build --workspace=@app/web
```

Then manually verify in the UI:
- `/aura` opens
- quick actions still work
- operational requests map to the correct result path

Expected: build passes and `/aura` behaves as operational copilot.

**Step 5: Commit**

```bash
git add apps/web/src/routes/aura-chat-page.tsx
git commit -m "refactor: decouple aura command chat from journal flow"
```

### Task 4: Split the journal into live conversation and finalization modes

**Files:**
- Modify: `apps/backend/src/services/ai.service.ts`
- Modify: `apps/backend/src/index.ts`
- Modify: `apps/backend/src/index.journal.test.ts`
- Modify: `apps/web/src/routes/journal-page.tsx`

**Step 1: Write the failing tests**

Update `apps/backend/src/index.journal.test.ts` so the streaming route no longer expects `assistant.suggested_tasks`.

Add assertions for:
- stream emits `assistant.delta`
- stream emits `assistant.completed`
- stream does **not** emit `assistant.suggested_tasks`

Add or update finalize flow checks so task generation is verified only after `/api/journal/finalize`.

**Step 2: Run test to verify it fails**

Run:

```bash
npx tsx src/index.journal.test.ts
```

Expected: FAIL because the current stream still emits task suggestions.

**Step 3: Write minimal implementation**

In `apps/backend/src/services/ai.service.ts`:
- use `journal-live` for `streamJournalReply`
- use `journal-finalize` for session summary and post-session task generation

In `apps/backend/src/index.ts`:
- remove `assistant.suggested_tasks` emission from `/api/journal/message/stream`
- move journal task generation to `/api/journal/finalize`
- detect explicit closing phrases server-side before finalizing, or support a frontend flag that tells the backend the current message is a closure request

In `apps/web/src/routes/journal-page.tsx`:
- stop relying on `streamSuggestedTasks`
- keep button-based finalize
- support phrase-based closure by calling the same finalize flow

**Step 4: Run test to verify it passes**

Run:

```bash
npx tsx src/index.journal.test.ts
npm run test --workspace=@app/backend
```

Expected: PASS, and the backend suite still stays green.

**Step 5: Commit**

```bash
git add apps/backend/src/services/ai.service.ts apps/backend/src/index.ts apps/backend/src/index.journal.test.ts apps/web/src/routes/journal-page.tsx
git commit -m "refactor: split journal live flow from finalize flow"
```

### Task 5: Simplify `/api/ai/suggest` so prompts stop duplicating Aura behavior

**Files:**
- Modify: `apps/backend/src/index.ts`
- Modify: `apps/backend/src/services/ai.service.test.ts`
- Modify: `apps/backend/src/services/checkin.service.test.ts`
- Modify: `apps/backend/src/services/onboarding-ai.service.test.ts`

**Step 1: Write the failing tests**

Add assertions that local prompt strings no longer need to carry repeated Aura persona text for:
- `checkin-response`
- `home-messages`
- `day-tasks`
- `goal-subtasks`

Use tests to assert the system prompt carries the identity while local prompts carry only task intent and schema.

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test --workspace=@app/backend
```

Expected: FAIL on the new assertions before the cleanup.

**Step 3: Write minimal implementation**

Refactor inline prompt strings in `apps/backend/src/index.ts` so each one contains only:
- immediate task instruction
- contextual data
- output schema

Do not duplicate long Aura identity paragraphs inside those prompts.

**Step 4: Run test to verify it passes**

Run:

```bash
npm run test --workspace=@app/backend
npm run build --workspace=@app/backend
```

Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/src/index.ts apps/backend/src/services/ai.service.test.ts apps/backend/src/services/checkin.service.test.ts apps/backend/src/services/onboarding-ai.service.test.ts
git commit -m "refactor: simplify ai suggest prompts around aura core"
```

### Task 6: Final documentation and regression verification

**Files:**
- Modify: `docs/plans/2026-04-05-aura-ai-prompt-architecture-design.md`
- Modify: `docs/plans/2026-04-05-aura-ai-prompt-architecture-implementation.md`
- Optional Modify: `docs/05-prompt-pack.md`

**Step 1: Update docs with implemented endpoint and prompt matrix details**

Document:
- final surface list
- final endpoint list
- final journal lifecycle
- final Aura command contract

**Step 2: Run end-to-end verification**

Run:

```bash
npm run test --workspace=@app/backend
npm run build --workspace=@app/backend
npm run build --workspace=@app/web
```

Manual checks:
- journal stays open during live conversation
- journal suggests tasks only after finalization
- center star Aura executes operational requests without journaling behavior
- check-in, home, planner, and goals still return structured outputs

**Step 3: Commit**

```bash
git add docs/plans/2026-04-05-aura-ai-prompt-architecture-design.md docs/plans/2026-04-05-aura-ai-prompt-architecture-implementation.md docs/05-prompt-pack.md
git commit -m "docs: record aura prompt architecture and execution plan"
```
