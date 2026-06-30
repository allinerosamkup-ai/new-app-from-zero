# Splash Sales Landing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the current splash screen into a polished product presentation landing page that explains Mood Energy, shows who it is for, highlights the core flows, and displays real app screenshots.

**Architecture:** Keep the change isolated to the web splash route so the rest of the product remains untouched. Build the landing as a single route-level React page with structured sections, reusable data arrays, and lightweight inline composition that matches the current Aura clean system. Add a small regression test for the new splash content and verify the route visually with captured screenshots from live dev pages.

**Tech Stack:** React 18, Vite, TypeScript, existing Aura/editorial CSS, Vitest, headless browser screenshots from the local dev server.

---

### Task 1: Lock the landing contract

**Files:**
- Modify: `apps/web/src/routes/splash-page.tsx`
- Reference: `docs/01-visao-do-produto.md`
- Reference: `docs/02-prd-mvp.md`

**Step 1: Define the content blocks**

Create the landing structure directly in the splash route:
- hero
- audience/problem section
- “como funciona” section
- feature grid
- screenshot gallery
- CTA footer

**Step 2: Encode the product language**

Use copy that reflects the approved positioning:
- broad audience with oscillation of humor and energy
- subtle feminine tone in visuals, not exclusionary copy
- no medical claim language
- no generic productivity framing

**Step 3: Keep design aligned with Aura clean**

Use:
- off-white/light backgrounds
- pastel accents as details
- light cards, soft borders, editorial spacing
- strong typography hierarchy without heavy gradients

### Task 2: Add a failing regression test first

**Files:**
- Create: `apps/web/src/test/setup.ts`
- Create: `apps/web/src/routes/splash-page.test.tsx`
- Modify: `apps/web/vitest.config.ts` only if the new test setup needs adjustment

**Step 1: Write the failing test**

Write a route render test that expects the new splash to show:
- the main headline
- the “como funciona” section
- the screenshot gallery heading
- the primary CTA

**Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@app/web -- splash-page.test.tsx`

Expected:
- the test runner starts
- the new assertions fail because the current splash does not contain the new landing content

**Step 3: Fix test infrastructure only if needed**

If the run fails because `apps/web/src/test/setup.ts` is missing, add a minimal setup file first, then re-run until the test fails for the expected content reason.

### Task 3: Implement the landing page

**Files:**
- Modify: `apps/web/src/routes/splash-page.tsx`

**Step 1: Replace the current minimal splash structure**

Build the new page with section data arrays for:
- product highlights
- audience bullets
- flow steps
- screenshot cards

**Step 2: Preserve route behavior**

Keep navigation working:
- primary CTA → `/login?tab=criar`
- secondary CTA → `/login`

**Step 3: Add polished responsive layout**

Implement:
- stacked mobile-first layout
- desktop two-column hero
- horizontal screenshot gallery or editorial mosaic
- soft decorative background shapes

**Step 4: Keep the page maintainable**

Prefer:
- mapped arrays over repeated JSX
- small inline helper data
- concise local presentational helpers only if truly needed

### Task 4: Make the test pass

**Files:**
- Modify: `apps/web/src/routes/splash-page.tsx`
- Modify: `apps/web/src/routes/splash-page.test.tsx` only if an assertion is wrong

**Step 1: Run the targeted test**

Run: `npm run test --workspace=@app/web -- splash-page.test.tsx`

Expected:
- targeted splash test passes

**Step 2: Refine only after green**

Once green, clean up naming, spacing, and repetitive literals without changing tested behavior.

### Task 5: Capture real screenshots and wire them into the landing

**Files:**
- Create: `apps/web/public/screenshots/` assets as needed
- Modify: `apps/web/src/routes/splash-page.tsx`

**Step 1: Start the web preview**

Run: `npm run dev --workspace=@app/web`

**Step 2: Capture real app screens**

Take screenshots from live routes such as:
- `/dev/home`
- `/dev/checkin`
- `/dev/planner`
- `/dev/insights`

Save optimized PNGs into `apps/web/public/screenshots/`.

**Step 3: Replace placeholders with real images**

Update the landing gallery to use the captured screenshots with concise captions.

### Task 6: Full verification

**Files:**
- Verify: `apps/web/src/routes/splash-page.tsx`
- Verify: `apps/web/src/routes/splash-page.test.tsx`

**Step 1: Run the targeted test suite**

Run: `npm run test --workspace=@app/web -- splash-page.test.tsx`

Expected: PASS

**Step 2: Run the web build**

Run: `npm run build --workspace=@app/web`

Expected: Vite build succeeds with exit code 0

**Step 3: Visual check**

Confirm on the live preview that:
- the landing loads at `/splash`
- CTA buttons work
- screenshots render
- layout feels premium on desktop and mobile

