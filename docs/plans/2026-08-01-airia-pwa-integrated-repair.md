# Airia PWA Integrated Repair Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the installed Airia PWA reliably load the current release while fixing contextual check-in, Android voice duplication and legacy objective progression end to end.

**Architecture:** Keep canonical persistence and current UI contracts, but replace index-only transcript assembly with overlap-aware merging, replace the express/wizard split with one contextual form, recover only active objectives that lack actions, and bind the PWA/service worker/deploy to one Git-derived release identifier. All behavior changes start with failing tests and are verified in the public authenticated flow.

**Tech Stack:** React 18, TypeScript, Vite, vite-plugin-pwa/Workbox, Express, Prisma, Vitest, Docker Compose and Nginx.

---

### Task 1: Release identity and deterministic PWA refresh

**Files:**
- Create: `apps/web/src/features/pwa/release-update.ts`
- Create: `apps/web/src/features/pwa/release-update.test.ts`
- Modify: `apps/web/src/vite-env.d.ts`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/sw.ts`
- Modify: `apps/web/vite.config.ts`
- Modify: `deploy/airia/Dockerfile.web`
- Modify: `deploy/airia/compose.yml`
- Modify: `deploy/airia/deploy.sh`
- Modify: `deploy/airia/nginx.conf`

**Step 1: Write the failing tests**

Cover these pure decisions: a client already on the current build is not navigated; an older or unidentified client is navigated once with `__airia_release=<build>`; unrelated query parameters and route are preserved; an empty build id disables forced navigation.

**Step 2: Run the focused test and verify RED**

Run: `node ./node_modules/vitest/vitest.mjs run src/features/pwa/release-update.test.ts`

Expected: FAIL because the release decision helper does not exist.

**Step 3: Implement the minimal release contract**

Add an overlap-free URL decision helper. Inject `VITE_APP_RELEASE` into the web build from `git rev-parse HEAD`, expose it in a no-cache `/release.json`, include it in the service worker, and navigate controlled windows only when their release query differs. Keep `skipWaiting`, `clientsClaim` and the existing reload lock.

**Step 4: Run focused tests, typecheck and build**

Run:

```powershell
node ./node_modules/vitest/vitest.mjs run src/features/pwa/release-update.test.ts
node ./node_modules/typescript/bin/tsc --noEmit
node ./node_modules/vite/bin/vite.js build
```

Expected: all exit 0 and the built `release.json`/`sw.js` contain the selected release id.

**Step 5: Commit**

```powershell
git add apps/web deploy/airia
git commit -m "fix(pwa): bind installed clients to the deployed release"
```

### Task 2: Shared overlap-aware voice transcript

**Files:**
- Modify: `apps/web/src/features/voice/transcript-session.test.ts`
- Modify: `apps/web/src/features/voice/transcript-session.ts`
- Verify consumers: `apps/web/src/routes/aura-chat-page.tsx`
- Verify consumers: `apps/web/src/routes/checkin-page.tsx`
- Verify consumers: `apps/web/src/routes/journal-page.tsx`
- Verify consumers: `apps/web/src/routes/planner-page.tsx`

**Step 1: Write failing Android-style transcript tests**

Add cases where final results are `hoje eu tenho praia` followed at a new index by `hoje eu tenho praia com a Erica`, exact phrases repeat at new indexes, adjacent segments overlap, and the same result index is corrected. Assert a single natural sentence.

**Step 2: Run the focused test and verify RED**

Run: `node ./node_modules/vitest/vitest.mjs run src/features/voice/transcript-session.test.ts`

Expected: FAIL with duplicated phrase output.

**Step 3: Implement minimal overlap-aware merging**

Normalize comparison-only whitespace/case, discard contained duplicates, replace a shorter cumulative phrase with the longer one, and join independent segments using the longest suffix/prefix token overlap. Preserve original display text and reset semantics.

**Step 4: Run voice and route tests**

Run:

```powershell
node ./node_modules/vitest/vitest.mjs run src/features/voice/transcript-session.test.ts src/routes/journal-voice.helpers.test.ts src/routes/checkin-page.helpers.test.ts
node ./node_modules/typescript/bin/tsc --noEmit
```

Expected: all exit 0.

**Step 5: Commit**

```powershell
git add apps/web/src/features/voice apps/web/src/routes
git commit -m "fix(voice): merge cumulative Android transcripts"
```

### Task 3: One contextual check-in flow

**Files:**
- Create: `apps/web/src/features/aura/contextual-checkin.ts`
- Create: `apps/web/src/features/aura/contextual-checkin.test.ts`
- Modify: `apps/web/src/routes/checkin-page.tsx`
- Modify: `apps/web/src/routes/checkin-page.test.ts`
- Modify: `apps/web/src/i18n/locales/pt.json`
- Modify: `apps/web/src/i18n/locales/en.json`

**Step 1: Write failing submission-gate tests**

Assert that emotion plus mood/energy without reviewed influence context cannot submit; selected factors allow submit; explicit “não identifiquei um fator” allows submit without creating a fake factor; voice-extracted factors satisfy the same gate; all optional observed signals remain in the canonical payload.

**Step 2: Run focused tests and verify RED**

Run: `node ./node_modules/vitest/vitest.mjs run src/features/aura/contextual-checkin.test.ts src/routes/checkin-page.test.ts`

Expected: FAIL because the contextual gate and unified flow do not exist.

**Step 3: Replace express/wizard branching**

Render one scrollable form in this order: voice/emotion, mood and energy, influence factors, optional context, note and register. Remove `handleExpressFinish`, `mode`, `expressPhase` and wizard navigation. Keep the existing canonical `addCheckin` call and never synthesize optional scores or factors.

**Step 4: Run check-in tests, full web typecheck and build**

Run:

```powershell
node ./node_modules/vitest/vitest.mjs run src/features/aura/contextual-checkin.test.ts src/features/aura/checkin-submission.test.ts src/routes/checkin-page.test.ts src/routes/checkin-page.helpers.test.ts
node ./node_modules/typescript/bin/tsc --noEmit
node ./node_modules/vite/bin/vite.js build
```

Expected: all exit 0; built check-in chunk contains no express completion path.

**Step 5: Commit**

```powershell
git add apps/web/src/features/aura apps/web/src/routes/checkin-page.tsx apps/web/src/routes/checkin-page.test.ts apps/web/src/i18n
git commit -m "fix(checkin): require contextual influence review"
```

### Task 4: Recover active legacy objectives

**Files:**
- Create: `apps/backend/src/services/objective-action-recovery.service.ts`
- Create: `apps/backend/src/services/objective-action-recovery.service.test.ts`
- Modify: `apps/backend/src/index.ts`
- Modify: `apps/web/src/features/aura/store.tsx`
- Modify: `apps/web/src/routes/goals-page.tsx`
- Modify: `apps/web/src/routes/goals-page.test.tsx`

**Step 1: Write failing recovery tests**

Assert that only active objectives with zero valid actions are selected; archived/completed objectives are ignored; generated actions are normalized, ordered and persisted once; a retry is idempotent; failure leaves the original objective untouched.

**Step 2: Run focused tests and verify RED**

Run: `node ./node_modules/typescript/bin/tsx src/services/objective-action-recovery.service.test.ts`

Expected: FAIL because the recovery service does not exist.

**Step 3: Implement recovery endpoint and client hydration**

Add an authenticated idempotent recovery endpoint using the existing goal-subtask AI contract and `normalizeObjectiveSubgoals`. Invoke it once when Goals loads, then refresh canonical objectives. Never reactivate archived objectives and never replace valid existing actions.

**Step 4: Run objective tests and builds**

Run:

```powershell
node ./node_modules/typescript/bin/tsx src/services/objective-action-recovery.service.test.ts
node ./node_modules/typescript/bin/tsx src/services/objective-progression.service.test.ts
node ./node_modules/typescript/bin/tsx src/lib/objective-subgoals.test.ts
node ./node_modules/typescript/bin/tsc -p tsconfig.json --pretty false
node ./node_modules/vitest/vitest.mjs run src/routes/goals-page.test.tsx src/utils/goal-priority-actions.test.ts
```

Expected: all exit 0.

**Step 5: Commit**

```powershell
git add apps/backend/src apps/web/src/features/aura/store.tsx apps/web/src/routes/goals-page.tsx apps/web/src/routes/goals-page.test.tsx
git commit -m "fix(goals): recover missing legacy micro-actions"
```

### Task 5: Integrated verification and publication

**Files:**
- Modify if needed: `docs/product/pr-review-skill-roadmap.md`
- Verify: `deploy/airia/deploy.sh`

**Step 1: Run the complete local gates**

Run backend tests/build, web tests/typecheck/build and `git diff --check`. Expected: zero failures and zero whitespace errors.

**Step 2: Review the release against the Airia checklist**

Confirm no demo state, synthetic user data, fake check-in factors, archived-goal reactivation, hidden error, timezone drift or unsupported clinical diagnosis entered the diff.

**Step 3: Push and deploy one canonical commit chain**

Push the reviewed branch, fast-forward `master`, deploy from that exact SHA and rebuild both containers. The deploy must print the release id and fail on any mismatch.

**Step 4: Verify public assets and PWA update**

Confirm `/release.json`, `/sw.js`, `/home`, `/aura` and `/api/health` return successfully; public build id equals GitHub/VPS/container SHA; a previous installed client navigates once to the new release and then stops reloading.

**Step 5: Run authenticated evidence checks**

Using `allinerosakup@gmail.com` without mutating its real history, verify: no express check-in path; factors remain visible before registration; cumulative microphone events produce one sentence; Goals loads the current UI; existing stored data remains unchanged. Record screenshots, console/network errors and expected versus actual results.

**Step 6: Final release commit if documentation changed**

```powershell
git add docs
git commit -m "docs: record integrated Airia release verification"
```
