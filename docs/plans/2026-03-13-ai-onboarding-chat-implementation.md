# AI Onboarding Chat Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current form onboarding with a fixed 8-question onboarding chat, persist raw answers and AI-processed output, and route authenticated users through this flow before the main app.

**Architecture:** Keep Expo mobile with Zustand and Supabase as the onboarding execution path. Extend the existing auth and onboarding stores, add a dedicated onboarding chat screen, expand database fields through Prisma and SQL, and use an AI processing step after the last answer to produce the initial user profile summary.

**Tech Stack:** Expo, React Native, Zustand, Supabase, Prisma, SQL migration, OpenAI, TypeScript

---

### Task 1: Extend onboarding data contract in Prisma and SQL

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Modify: `supabase/migrations/20260313103000_initial_public_schema.sql`
- Test: `apps/backend/src/contracts/schema-alignment.test.ts`

**Step 1: Add failing expectations**

Extend the schema alignment test to expect:
- `onboarding_responses.age`
- `onboarding_responses.current_feeling`
- `onboarding_responses.sleep_quality_note`
- `onboarding_responses.routine_text`
- `onboarding_responses.main_energy_pressure`
- `onboarding_responses.primary_goal`
- AI output fields for onboarding summaries

**Step 2: Run test to verify it fails**

Run: `node --require ts-node/register/transpile-only apps/backend/src/contracts/schema-alignment.test.ts`
Expected: FAIL because the columns do not exist yet.

**Step 3: Update schema and migration**

Add the raw-answer fields and AI-output fields to:
- Prisma `OnboardingResponse`
- SQL migration `public.onboarding_responses`

**Step 4: Run test to verify it passes**

Run: `node --require ts-node/register/transpile-only apps/backend/src/contracts/schema-alignment.test.ts`
Expected: PASS

### Task 2: Add onboarding AI service contract

**Files:**
- Create: `apps/backend/src/contracts/onboarding-ai.contract.ts`
- Create: `apps/backend/src/contracts/onboarding-ai.contract.test.ts`

**Step 1: Write the failing test**

Cover the structured AI output:
- `profileSummary`
- `routineSummaryNormalized`
- `initialStateSummary`
- `topThemes`
- `initialSuggestions`

**Step 2: Run test to verify it fails**

Run: `node --require ts-node/register/transpile-only apps/backend/src/contracts/onboarding-ai.contract.test.ts`
Expected: FAIL because the contract file does not exist yet.

**Step 3: Implement minimal contract**

Use Zod to define and export the onboarding AI response schema.

**Step 4: Run test to verify it passes**

Run: `node --require ts-node/register/transpile-only apps/backend/src/contracts/onboarding-ai.contract.test.ts`
Expected: PASS

### Task 3: Add onboarding AI processing service

**Files:**
- Modify: `apps/backend/src/services/ai.service.ts`
- Create: `apps/backend/src/services/onboarding-ai.service.test.ts`

**Step 1: Write the failing test**

Cover a service method that receives the 8 onboarding answers and returns the structured onboarding AI output.

**Step 2: Run test to verify it fails**

Run: `node --require ts-node/register/transpile-only apps/backend/src/services/onboarding-ai.service.test.ts`
Expected: FAIL because the onboarding AI method does not exist yet.

**Step 3: Implement minimal service**

Add a method such as:
- `generateOnboardingProfile(input)`

Keep the prompt fixed and aligned with the approved 8-question onboarding.

**Step 4: Run test to verify it passes**

Run: `node --require ts-node/register/transpile-only apps/backend/src/services/onboarding-ai.service.test.ts`
Expected: PASS

### Task 4: Replace onboarding step-form state with chat-flow state

**Files:**
- Modify: `apps/mobile/src/presentation/providers/onboarding_store.ts`
- Create: `apps/mobile/src/presentation/providers/onboarding_store.test.ts`

**Step 1: Write the failing test**

Cover:
- ordered fixed questions
- storing each answer
- progress advancing one question at a time
- final payload assembly

**Step 2: Run test to verify it fails**

Run: `node --require ts-node/register/transpile-only apps/mobile/src/presentation/providers/onboarding_store.test.ts`
Expected: FAIL because the current store is step-form based.

**Step 3: Implement minimal chat store**

Add:
- fixed question list
- current index
- answer map
- `submitAnswer()`
- `finishOnboarding()`

Keep the store integrated with Supabase persistence and `auth_store.refresh()`.

**Step 4: Run test to verify it passes**

Run: `node --require ts-node/register/transpile-only apps/mobile/src/presentation/providers/onboarding_store.test.ts`
Expected: PASS

### Task 5: Build the onboarding chat screen

**Files:**
- Create: `apps/mobile/src/presentation/screens/OnboardingChatScreen.tsx`
- Modify: `apps/mobile/App.tsx`

**Step 1: Define expected UI behavior**

The screen must show:
- welcome AI message
- current fixed question
- user answer bubble
- input area
- progress indicator
- processing state after question 8

**Step 2: Implement the screen**

Use the existing visual direction of the mobile app, but make the onboarding feel conversational rather than form-based.

**Step 3: Route the app**

Update `App.tsx`:
- unauthenticated -> `AuthScreen`
- authenticated without onboarding -> `OnboardingChatScreen`
- authenticated with onboarding -> app shell

### Task 6: Save raw onboarding answers and AI output

**Files:**
- Modify: `apps/mobile/src/presentation/providers/onboarding_store.ts`
- Modify: `apps/mobile/src/lib/supabase.ts` only if needed for helper behavior

**Step 1: Persist raw onboarding answers**

Save:
- `profiles.full_name`
- `user_preferences.wake_time`
- `user_preferences.sleep_time`
- all new onboarding raw answer fields
- consents

**Step 2: Process with AI**

After raw persistence, call the onboarding AI processing function.

**Step 3: Persist AI output**

Save:
- `ai_profile_summary`
- `ai_routine_summary`
- `ai_initial_state_summary`
- `ai_top_themes`
- `ai_initial_suggestions`
- `ai_profile_payload`

**Step 4: Mark onboarding complete**

Update `profiles.onboarding_done = true`, then refresh auth state.

### Task 7: Verify end-to-end integration

**Files:**
- Modify: `docs/product/api-contracts.md` only if onboarding AI becomes an explicit backend contract
- Modify: `docs/plans/2026-03-13-ai-onboarding-chat-design.md`

**Step 1: Run verification**

Run:
- `node --require ts-node/register/transpile-only apps/backend/src/contracts/schema-alignment.test.ts`
- `node --require ts-node/register/transpile-only apps/backend/src/contracts/onboarding-ai.contract.test.ts`
- `node --require ts-node/register/transpile-only apps/backend/src/services/onboarding-ai.service.test.ts`
- `node --require ts-node/register/transpile-only apps/mobile/src/presentation/providers/auth_store.test.ts`
- `node --require ts-node/register/transpile-only apps/mobile/src/presentation/providers/onboarding_store.test.ts`
- `npx tsc -p apps/mobile/tsconfig.json --noEmit`
- `npm run build --workspace=@app/backend`

Expected:
- all tests pass
- backend builds
- mobile type-check passes

**Step 2: Update documentation**

Record the final onboarding chat contract and storage mapping.
