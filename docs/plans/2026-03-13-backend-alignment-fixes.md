# Backend Alignment Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align the backend request contracts and persistence logic with the current Prisma schema and existing API decisions, while fixing the current compile blocker.

**Architecture:** Keep the current Express backend, Prisma client, and service split. Extract the request validation schemas into small reusable modules so they can be tested directly, then update route handlers to match the live Prisma contract for multiple daily check-ins and the existing journal session shape.

**Tech Stack:** Express, TypeScript, Zod, Prisma, Supabase SQL

---

### Task 1: Add failing tests for the check-in request contract

**Files:**
- Create: `apps/backend/src/contracts/checkin.contract.ts`
- Create: `apps/backend/src/contracts/checkin.contract.test.ts`

**Step 1: Write failing tests**

- Expect `checkinSlot` to be required.
- Expect `energyScore` max to be `3`.
- Expect `physicalScore` max to be `4`.
- Expect `socialScore` max to be `3`.

**Step 2: Run the tests to verify they fail**

Run a backend test command targeting only this file.

**Step 3: Implement the contract**

- Export a reusable `CheckinCreateSchema`.

**Step 4: Run the tests to verify they pass**

### Task 2: Add failing tests for planner sync request contract

**Files:**
- Create: `apps/backend/src/contracts/planner.contract.ts`
- Create: `apps/backend/src/contracts/planner.contract.test.ts`

**Step 1: Write failing tests**

- Expect planner sync payload to require `userId`, `date`, `forceSave`, and `blocks`.

**Step 2: Run the tests to verify they fail**

**Step 3: Implement the contract**

- Export `PlannerSyncSchema`.

**Step 4: Run the tests to verify they pass**

### Task 3: Align the route handlers

**Files:**
- Modify: `apps/backend/src/index.ts`

**Step 1: Replace inline placeholder schema code**

- Import the new contract modules.

**Step 2: Align check-in persistence**

- Use `checkinSlot`.
- Replace the old `upsert` unique key with the new user-day-slot key.
- Pass the full score set to `CheckinService`.

**Step 3: Keep journal finalize consistent**

- Preserve the current `summary.summary` shape because it already matches `AIService`.

### Task 4: Align the SQL migration with Prisma

**Files:**
- Modify: `supabase/migrations/20260313103000_initial_public_schema.sql`

**Step 1: Add the missing `suggestions` column**

- Keep `journal_sessions` aligned with Prisma.

### Task 5: Verify

**Files:**
- Validate: `apps/backend/src/index.ts`
- Validate: `apps/backend/src/contracts/checkin.contract.test.ts`
- Validate: `apps/backend/src/contracts/planner.contract.test.ts`
- Validate: `supabase/migrations/20260313103000_initial_public_schema.sql`

**Step 1: Run tests**

- Confirm both contract tests pass.

**Step 2: Run backend build**

- Confirm TypeScript compilation passes.
