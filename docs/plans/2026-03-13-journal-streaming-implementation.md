# Journal Streaming Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reemplaçar os placeholders do diário por um fluxo real com sessão persistida, streaming da resposta da IA e memória de rotina usando as tabelas já existentes.

**Architecture:** Keep the current Express backend, Prisma client, Expo mobile app, and Zustand stores. Add explicit journal request contracts, move session logic into a backend service, expose real start and streaming endpoints, and wire the existing mobile journal store to consume them without replacing the current screen structure.

**Tech Stack:** Express, Prisma, OpenAI, Zod, Expo, React Native, Zustand, TypeScript

---

### Task 1: Add journal request and response contracts

**Files:**
- Create: `apps/backend/src/contracts/journal.contract.ts`
- Create: `apps/backend/src/contracts/journal.contract.test.ts`

**Step 1: Write the failing test**

Create tests for:
- `POST /api/journal/start` request requiring `userId`
- `POST /api/journal/message/stream` request requiring `userId`, `sessionId`, and `message`
- optional response helpers for start context shape

**Step 2: Run test to verify it fails**

Run: `node --require ts-node/register/transpile-only apps/backend/src/contracts/journal.contract.test.ts`
Expected: FAIL because the contract file does not exist yet.

**Step 3: Write minimal implementation**

Implement Zod schemas and exported types for:
- `JournalStartSchema`
- `JournalMessageSchema`
- helper types for message roles and returned context

**Step 4: Run test to verify it passes**

Run: `node --require ts-node/register/transpile-only apps/backend/src/contracts/journal.contract.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/src/contracts/journal.contract.ts apps/backend/src/contracts/journal.contract.test.ts
git commit -m "feat: add journal request contracts"
```

### Task 2: Add a backend journal service for session and context orchestration

**Files:**
- Create: `apps/backend/src/services/journal.service.ts`
- Test: `apps/backend/src/services/journal.service.test.ts`

**Step 1: Write the failing test**

Create tests for:
- creating or reusing an active session for the user
- loading ordered session messages
- building routine context from onboarding, preferences, check-ins, sessions, and timeline blocks

**Step 2: Run test to verify it fails**

Run: `node --require ts-node/register/transpile-only apps/backend/src/services/journal.service.test.ts`
Expected: FAIL because the service file does not exist yet.

**Step 3: Write minimal implementation**

Implement service methods:
- `startOrResumeSession(prisma, userId)`
- `getSessionMessages(prisma, sessionId)`
- `buildRoutineContext(prisma, userId)`
- `nextOrderIndex(messages)`

Keep the routine summary derived from existing tables only. Do not add a new memory table.

**Step 4: Run test to verify it passes**

Run: `node --require ts-node/register/transpile-only apps/backend/src/services/journal.service.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/src/services/journal.service.ts apps/backend/src/services/journal.service.test.ts
git commit -m "feat: add journal session service"
```

### Task 3: Extend AI service for streamed journal replies

**Files:**
- Modify: `apps/backend/src/services/ai.service.ts`
- Test: `apps/backend/src/services/ai.service.test.ts`

**Step 1: Write the failing test**

Add a test that verifies the streamed journal helper:
- receives context and recent messages
- emits assistant text in deltas
- returns the final assembled content

**Step 2: Run test to verify it fails**

Run: `node --require ts-node/register/transpile-only apps/backend/src/services/ai.service.test.ts`
Expected: FAIL because streaming helper does not exist yet.

**Step 3: Write minimal implementation**

Add a method such as:
- `streamJournalReply({ context, history, message, onDelta })`

The method should:
- build the prompt with routine context, latest check-in, and recent history
- stream tokens from OpenAI
- call `onDelta` for each text chunk
- return the final assistant message string

Keep `summarizeJournalSession()` intact.

**Step 4: Run test to verify it passes**

Run: `node --require ts-node/register/transpile-only apps/backend/src/services/ai.service.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/src/services/ai.service.ts apps/backend/src/services/ai.service.test.ts
git commit -m "feat: add streaming journal ai service"
```

### Task 4: Add journal start and stream endpoints to the backend

**Files:**
- Modify: `apps/backend/src/index.ts`
- Modify: `apps/backend/src/services/journal.service.ts`
- Test: `apps/backend/src/index.journal.test.ts`

**Step 1: Write the failing test**

Cover:
- `POST /api/journal/start` returns `sessionId`, ordered messages, and context
- `POST /api/journal/message/stream` validates payload and returns SSE events
- persisted user and assistant messages keep correct `order_index`

**Step 2: Run test to verify it fails**

Run: `node --require ts-node/register/transpile-only apps/backend/src/index.journal.test.ts`
Expected: FAIL because the routes do not exist yet.

**Step 3: Write minimal implementation**

In `index.ts`:
- add `POST /api/journal/start`
- add `POST /api/journal/message/stream`
- keep `POST /api/journal/finalize`

In the streaming route:
- validate request with `JournalMessageSchema`
- persist the user message
- send SSE headers
- stream assistant deltas
- persist the final assistant message on completion

**Step 4: Run test to verify it passes**

Run: `node --require ts-node/register/transpile-only apps/backend/src/index.journal.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/src/index.ts apps/backend/src/services/journal.service.ts apps/backend/src/index.journal.test.ts
git commit -m "feat: add journal start and streaming routes"
```

### Task 5: Expand the mobile AI service to support journal start and streaming

**Files:**
- Modify: `apps/mobile/src/services/ai_service.ts`
- Test: `apps/mobile/src/services/ai_service.test.ts`

**Step 1: Write the failing test**

Cover:
- starting a session from the backend
- consuming journal stream events
- returning a final assistant message string

**Step 2: Run test to verify it fails**

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`
Expected: FAIL after adding the new test references and missing methods.

**Step 3: Write minimal implementation**

Add:
- `startJournalSession(userId)`
- `streamJournalMessage({ userId, sessionId, message, onEvent })`

Use the existing API client where possible. If SSE support needs `fetch`, keep that logic scoped to this service.

**Step 4: Run test to verify it passes**

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/mobile/src/services/ai_service.ts apps/mobile/src/services/ai_service.test.ts
git commit -m "feat: add mobile journal streaming service"
```

### Task 6: Replace journal store placeholders with real backend flow

**Files:**
- Modify: `apps/mobile/src/presentation/providers/journal_store.ts`
- Test: `apps/mobile/src/presentation/providers/journal_store.test.ts`

**Step 1: Write the failing test**

Cover:
- `startSession()` stores real `sessionId`, messages, and context
- `sendMessage()` appends user message, creates empty assistant message, and updates it incrementally
- `finalizeSession()` remains compatible

**Step 2: Run test to verify it fails**

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`
Expected: FAIL because store signatures and fields are incomplete.

**Step 3: Write minimal implementation**

Update the existing store instead of replacing it:
- remove `temp-session-*`
- replace `setTimeout` simulation with backend streaming
- keep current public actions if possible
- add only the minimum extra state needed for stream progress

**Step 4: Run test to verify it passes**

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/mobile/src/presentation/providers/journal_store.ts apps/mobile/src/presentation/providers/journal_store.test.ts
git commit -m "feat: wire journal store to backend streaming"
```

### Task 7: Update the journal screen to respect the real session lifecycle

**Files:**
- Modify: `apps/mobile/src/presentation/screens/JournalChatScreen.tsx`

**Step 1: Write the failing test**

If there is no existing screen test harness, define the expected UI checks in comments first:
- loading state while starting session
- streamed assistant message visible while typing
- end-session action still works

**Step 2: Run test to verify it fails**

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`
Expected: FAIL if the screen needs new props/state not yet exposed.

**Step 3: Write minimal implementation**

Update the screen to:
- call `startSession()` on entry or first use
- respect the store loading states
- avoid duplicate sends while a stream is active

**Step 4: Run test to verify it passes**

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/mobile/src/presentation/screens/JournalChatScreen.tsx
git commit -m "feat: update journal chat screen for streaming"
```

### Task 8: Verify backend and mobile contracts together

**Files:**
- Modify: `docs/product/api-contracts.md`
- Modify: `docs/plans/2026-03-13-journal-streaming-design.md`

**Step 1: Run verification**

Run:
- `node --require ts-node/register/transpile-only apps/backend/src/contracts/journal.contract.test.ts`
- `node --require ts-node/register/transpile-only apps/backend/src/services/journal.service.test.ts`
- `node --require ts-node/register/transpile-only apps/backend/src/services/ai.service.test.ts`
- `node --require ts-node/register/transpile-only apps/backend/src/index.journal.test.ts`
- `npm run build --workspace=@app/backend`
- `npx tsc -p apps/mobile/tsconfig.json --noEmit`

Expected:
- all journal contract tests pass
- backend builds
- mobile type-check passes

**Step 2: Document the final contract**

Update `docs/product/api-contracts.md` with:
- `POST /api/journal/start`
- `POST /api/journal/message/stream`
- retained `POST /api/journal/finalize`

**Step 3: Commit**

```bash
git add docs/product/api-contracts.md docs/plans/2026-03-13-journal-streaming-design.md
git commit -m "docs: record journal streaming contract"
```
