# Airia Integrated Check-in Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make natural-language emotional/energy check-ins use one canonical, idempotent application flow that updates every Airia surface and works from screen, text and voice.

**Architecture:** A typed `record_checkin` draft separates understanding from execution. A single application writer persists the record, runs safety/grounding/state evaluation and returns a structured receipt; screen, Airia text and voice all call it. Optional signals remain nullable and include provenance instead of artificial defaults.

**Tech Stack:** TypeScript, Express, Zod, Prisma/PostgreSQL, React/Vite/PWA, React Native/Expo, Node test scripts, Playwright/browser E2E.

---

### Task 1: Freeze the canonical check-in contract in failing tests

**Files:**
- Create: `apps/backend/src/contracts/checkin-draft.contract.ts`
- Create: `apps/backend/src/contracts/checkin-draft.contract.test.ts`
- Modify: `apps/backend/src/contracts/checkin.contract.ts`
- Modify: `apps/backend/src/contracts/checkin.contract.test.ts`
- Modify: `apps/backend/src/contracts/aura-command.contract.ts`
- Modify: `apps/backend/src/contracts/aura-command-plan.contract.ts`
- Modify: `apps/backend/src/contracts/aura-command-plan.contract.test.ts`

**Step 1: Write the failing contract tests**

Add assertions proving:

```ts
const draft = CheckinDraftSchema.parse({
  status: 'ready',
  localDate: '2026-07-31',
  occurredAt: '2026-07-31T12:00:00.000Z',
  source: 'aura_text',
  sourceMessageId: 'message-1',
  idempotencyKey: 'session-1:message-1',
  rawText: 'Estou chateada e cansada',
  note: 'Estou chateada e cansada',
  emotions: ['sad', 'tired'],
  factors: [],
  mood: { value: 3, provenance: 'inferred', confidence: 0.9, evidence: ['chateada'] },
  energy: { value: 3, provenance: 'inferred', confidence: 0.95, evidence: ['cansada'] },
  clarity: { value: null, provenance: 'absent', confidence: 0, evidence: [] },
  irritability: { value: null, provenance: 'absent', confidence: 0, evidence: [] },
  physical: { value: null, provenance: 'absent', confidence: 0, evidence: [] },
  social: { value: null, provenance: 'absent', confidence: 0, evidence: [] },
  sleepScore: { value: null, provenance: 'absent', confidence: 0, evidence: [] },
  sleepHours: null,
});
assert.equal(draft.mood.provenance, 'inferred');
assert.equal(draft.clarity.value, null);
```

Also prove `CheckinCreateSchema` accepts missing optional scores, rejects missing mood/energy, and `record_checkin` is a valid command/operation.

**Step 2: Run tests and verify RED**

Run:

```powershell
Push-Location apps/backend
npx ts-node-transpile-only src/contracts/checkin-draft.contract.test.ts
npx ts-node-transpile-only src/contracts/checkin.contract.test.ts
npx ts-node-transpile-only src/contracts/aura-command-plan.contract.test.ts
Pop-Location
```

Expected: FAIL because the draft and canonical action do not exist and optional fields are still required.

**Step 3: Implement the schemas minimally**

Create the discriminated signal/draft schemas and change the creation schema so mood/energy remain required while clarity, irritability, physical, social and sleep are nullable/optional. Keep legacy action parsing only as a boundary alias.

**Step 4: Run tests and verify GREEN**

Expected: all three scripts pass.

**Step 5: Commit**

```powershell
git add apps/backend/src/contracts
git commit -m "feat(checkin): define canonical record contract"
```

### Task 2: Align Prisma and production migration without inventing signals

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `supabase/migrations/20260731120000_unify_checkin_signals.sql`
- Modify: `apps/backend/src/contracts/schema-alignment.test.ts`
- Modify: `apps/backend/src/contracts/migration-chain-safety.test.ts`

**Step 1: Write failing schema/migration assertions**

Assert that `clarityScore`, `physicalScore` and `socialScore` are nullable and that `DailyCheckin` has:

```prisma
source            String   @default("screen")
sourceMessageId   String?  @map("source_message_id")
idempotencyKey    String?  @map("idempotency_key")
signalMetadata    Json?    @map("signal_metadata")
sleepHours        Float?   @map("sleep_hours")
```

Assert the migration drops the legacy slot check, makes optional columns nullable, adds new columns and a partial unique index on `(user_id, idempotency_key)`.

**Step 2: Run and verify RED**

Run the two contract test scripts. Expected: FAIL on missing schema fields/migration.

**Step 3: Add schema and idempotent SQL migration**

The migration must preserve existing rows, drop only the obsolete slot constraint and use `IF EXISTS`/`IF NOT EXISTS` where supported.

**Step 4: Generate Prisma and verify GREEN**

Run:

```powershell
npm run db:generate
Push-Location apps/backend
npx ts-node-transpile-only src/contracts/schema-alignment.test.ts
npx ts-node-transpile-only src/contracts/migration-chain-safety.test.ts
Pop-Location
```

**Step 5: Commit**

```powershell
git add packages/database/prisma/schema.prisma supabase/migrations apps/backend/src/contracts
git commit -m "feat(checkin): persist provenance and optional signals"
```

### Task 3: Add deterministic PT-BR check-in understanding

**Files:**
- Create: `apps/backend/src/services/checkin-understanding.service.ts`
- Create: `apps/backend/src/services/checkin-understanding.service.test.ts`
- Create: `apps/backend/src/services/checkin-utterances.pt-BR.ts`
- Modify: `apps/backend/src/services/airia-cognitive-interpreter.service.ts`
- Modify: `apps/backend/src/services/airia-cognitive-interpreter.service.test.ts`
- Modify: `apps/backend/src/services/aura-command-recovery.service.ts`
- Modify: `apps/backend/src/services/aura-command-recovery.service.test.ts`

**Step 1: Write failing utterance tests**

Cover at minimum:

```ts
assert.deepEqual(understand('Estou chateada e cansada').status, 'ready');
assert.equal(understand('Estou chateada e cansada').mood.value, 3);
assert.equal(understand('Estou chateada e cansada').energy.value, 3);
assert.equal(understand('Estou chateada e cansada').clarity.value, null);
assert.equal(understand('Minha energia hoje é 8').status, 'needs_clarification');
assert.equal(understand('Só estou desabafando; não registre').status, 'unsupported');
```

Add corpus cases for `chateada`, `triste`, `péssima`, `ansiosa`, `irritada`, `cansada`, `exausta`, `sem energia`, positive states, numeric scores, English equivalents and a combined state + operational request.

**Step 2: Run and verify RED**

Expected: FAIL because qualitative extraction/canonical action do not exist.

**Step 3: Implement deterministic extraction and normalization**

Use normalized text, explicit-number precedence, a reviewed lexicon, evidence capture, confidence per field and canonical emotion IDs. Candidate LLM payload may enrich a field but cannot remove a deterministically authorized check-in.

State reports with both core signals become `captureAs: 'checkin'`, `captureMode: 'auto'`, action `record_checkin`. State plus another command preserves both actions. Explicit refusal wins.

**Step 4: Run and verify GREEN**

Run the understanding, cognitive interpreter and recovery tests.

**Step 5: Commit**

```powershell
git add apps/backend/src/services
git commit -m "feat(checkin): understand natural mood and energy reports"
```

### Task 4: Build the single application writer

**Files:**
- Create: `apps/backend/src/services/checkin-application.service.ts`
- Create: `apps/backend/src/services/checkin-application.service.test.ts`
- Modify: `apps/backend/src/services/checkin.service.ts`
- Modify: `apps/backend/src/services/checkin.service.test.ts`
- Modify: `apps/backend/src/index.ts`
- Modify: `apps/backend/src/index.aura-command.test.ts`
- Modify: `apps/backend/src/index.timeline.test.ts` only if shared fixtures require alignment

**Step 1: Write failing writer tests**

Use a real in-memory/fake repository boundary rather than testing mock call counts. Prove:

- a ready draft returns `{ status: 'persisted', checkinId, persistedAt, stateLabel, stateSummary, riskSafety }`;
- optional signals remain null;
- metadata preserves inferred/reported provenance;
- the same idempotency key returns the same ID;
- two distinct messages in the same period create distinct slots;
- safety/state evaluation runs for screen and Airia sources.

**Step 2: Run and verify RED**

Expected: FAIL because no application writer exists.

**Step 3: Extract the current `/api/checkins` flow into the writer**

Move normalization, upsert/create, safety, grounding, evaluation, state update, memory/graph/background scheduling and result serialization behind `CheckinApplicationService.record()`. Use `humanizeScore(undefined)`/explicit “não informado” for absent optional signals.

Replace the route body with schema parsing plus one writer call. Do not retain a second persistence implementation.

**Step 4: Run focused route/service tests and verify GREEN**

Run check-in service, application service, contract and relevant index tests.

**Step 5: Commit**

```powershell
git add apps/backend/src/services/checkin* apps/backend/src/index.ts apps/backend/src/index*.test.ts
git commit -m "refactor(checkin): centralize persistence and state evaluation"
```

### Task 5: Route Airia plans through the canonical writer

**Files:**
- Modify: `apps/backend/src/services/aura-command-plan-builder.service.ts`
- Modify: `apps/backend/src/services/aura-command-plan-builder.service.test.ts`
- Modify: `apps/backend/src/services/aura-command-executor.service.ts`
- Modify: `apps/backend/src/services/aura-command-executor.service.test.ts`
- Modify: `apps/backend/src/services/aura-command.service.ts`
- Modify: `apps/backend/src/services/aura-command.service.test.ts`
- Modify: `apps/backend/src/index.ts`
- Modify: `apps/backend/src/index.aura-command.test.ts`

**Step 1: Write the exact failing end-to-end backend test**

Send `Estou chateada e cansada` while the model returns `respond`. Assert the SSE completed frame contains:

```ts
assert.equal(frame.response.action, 'record_checkin');
assert.equal(frame.plan.operations.length, 1);
assert.equal(frame.plan.operations[0].type, 'record_checkin');
assert.equal(frame.execution.status, 'applied');
assert.equal(savedCheckins.length, 1);
assert.equal(savedCheckins[0].moodScore, 3);
assert.equal(savedCheckins[0].energyScore, 3);
```

Add tests for model offline, refusal, duplicate request and state + calendar/task command.

**Step 2: Run and verify RED**

Expected: current behavior returns `respond`, zero operations and no check-in.

**Step 3: Implement canonical plan/executor wiring**

Remove the `log_checkin → create_checkin` normalization block. Plan builder creates `record_checkin` from the typed draft. Executor receives `recordCheckin` as a dependency, calls it outside the generic transaction, and marks the operation applied only from the persisted receipt. Legacy operation values normalize to this path.

**Step 4: Run all command tests and verify GREEN**

Run cognitive, command, recovery, builder, executor and index Aura tests.

**Step 5: Commit**

```powershell
git add apps/backend/src/services/aura-command* apps/backend/src/index.ts apps/backend/src/index.aura-command.test.ts
git commit -m "feat(aura): execute check-ins through the canonical pipeline"
```

### Task 6: Align web receipt, empty-plan behavior and screen submission

**Files:**
- Modify: `apps/web/src/features/aura/command-types.ts`
- Modify: `apps/web/src/features/aura/store.tsx`
- Modify: `apps/web/src/routes/aura-chat-page.tsx`
- Modify: `apps/web/src/components/aura/CommandPlanCard.tsx`
- Modify: `apps/web/src/routes/checkin-page.tsx`
- Modify: `apps/web/src/i18n/locales/pt.json`
- Modify: `apps/web/src/i18n/locales/en.json`
- Create or modify: focused web tests adjacent to the changed helpers/components

**Step 1: Write failing web tests**

Prove:

- an applied `record_checkin` result renders a saved receipt with mood, energy and “Ajustar check-in”;
- a plan with zero operations is not rendered;
- manual check-in does not send clarity/irritability/physical/social defaults;
- explicit sleep hours use `sleepHours`, not `sleepScore`;
- receipt content comes from execution result, not optimistic model prose.

**Step 2: Run and verify RED**

Run focused web tests. Expected: current UI shows an empty card and sends defaults.

**Step 3: Implement UI alignment**

Refresh the shared store after applied execution, render the compact receipt, link to `/checkin`, filter empty plans, remove legacy client-side `log_checkin` persistence and stop sending artificial defaults.

**Step 4: Run tests/build and verify GREEN**

Run web tests and TypeScript build.

**Step 5: Commit**

```powershell
git add apps/web/src
git commit -m "fix(web): reflect canonical check-ins across Airia"
```

### Task 7: Make voice and mobile use the same contract

**Files:**
- Modify: `apps/backend/src/index.ts`
- Modify: `apps/backend/src/index.aura-command.test.ts` or create a focused voice endpoint test
- Modify: `apps/mobile/src/domain/entities/checkin.ts`
- Modify: `apps/mobile/src/services/checkin_repository.ts`
- Modify: `apps/mobile/src/services/ai_service.ts`
- Modify: `apps/mobile/src/presentation/providers/checkin_store.ts`
- Modify: `apps/mobile/src/presentation/screens/CheckinScreen.tsx`
- Modify: relevant mobile tests

**Step 1: Write failing parity tests**

Assert voice extraction returns canonical emotion/factor IDs, provenance and `sleepHours`; assert mobile types accept 1–10 and nullable optional signals without fallback `3` values.

**Step 2: Run and verify RED**

Expected: voice returns localized labels/hours as score and mobile injects 1–5 defaults.

**Step 3: Reuse the understanding vocabulary and application contract**

The voice endpoint may use the model to enrich a candidate, but normalization/validation goes through `CheckinUnderstandingService`. Mobile submission uses the same REST schema, 1–10 controls and optional fields.

**Step 4: Verify GREEN**

Run focused backend tests and:

```powershell
npx tsc -p apps/mobile/tsconfig.json --noEmit
```

**Step 5: Commit**

```powershell
git add apps/backend/src/index.ts apps/mobile/src
git commit -m "fix(checkin): align voice and mobile signals"
```

### Task 8: Integrated verification, release review and production deployment

**Files:**
- Modify: `docs/product/airia-product-contract.md`
- Modify: `.dummy/memory/projects/mood-energy/state.md` and decisions/errors memory only after verified completion (gitignored)
- Use: `skills/airia-pr-review/SKILL.md`
- Use: `.agents/skills/deploy-airia/SKILL.md`

**Step 1: Run complete local gates**

```powershell
npm run test --workspace=@app/backend
npm run build --workspace=@app/backend
npm run test --workspace=@app/web
npm run build --workspace=@app/web
npx tsc -p apps/mobile/tsconfig.json --noEmit
git diff --check
```

Expected: all pass with no unaccounted warnings.

**Step 2: Run authenticated browser/API scenarios**

Verify screen, text and voice check-ins; exact phrase; refusal; retry/idempotency; second distinct check-in; state + task; Home phase; Planner capacity; Check-in result; Patterns; Journal context; mobile/PWA viewport; risk protocol. Capture screenshots and persisted database evidence.

**Step 3: Apply mandatory Airia PR review**

Audit product-vs-demo guardrails, grounding, backend/frontend contracts, timezone, risk safety, i18n, migration chain, release hygiene and user-owned dirty files.

**Step 4: Commit, push and deploy**

Push the verified branch, merge/publish according to the repository workflow, apply the production migration, then run:

```sh
cd /opt/airia/app && sh ./deploy/airia/deploy.sh
```

**Step 5: Prove production**

Confirm GitHub and VPS use the same SHA; containers are healthy; `/api/health`, `/home` and `/aura` return 200; run the exact authenticated phrase and query the resulting `daily_checkins` row including source/provenance/idempotency; confirm all consumer pages refresh from it.

**Step 6: Record verified product contract and Dummy OS memory**

Update the product contract and project memory with only evidence-backed behavior, migration state, production SHA and residual risks.

**Step 7: Mark the goal complete only after every acceptance criterion has direct evidence**

If any production, migration, authenticated-flow or cross-page proof is missing, leave the goal active and continue working.
