# Prisma Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create the initial Prisma data contract for the MVP, aligned with Supabase Auth, privacy requirements, and the approved product documents.

**Architecture:** Keep Supabase as the source of truth for auth and Postgres storage. Use Prisma as a typed schema contract for product-domain tables, with a `Profile` model keyed to the Supabase auth user id and explicit relations for check-ins, journal, planner, weekly insights, onboarding, and consent records.

**Tech Stack:** Prisma, PostgreSQL, Supabase Auth, TypeScript

---

### Task 1: Create the Prisma schema file

**Files:**
- Create: `supabase/prisma/schema.prisma`

**Step 1: Define generator and datasource**

- Add `prisma-client-js` generator.
- Add PostgreSQL datasource using `DATABASE_URL`.

**Step 2: Add the core auth-linked user model**

- Create `Profile` keyed by the Supabase auth user id.
- Add onboarding status and base profile fields.

**Step 3: Add MVP domain models**

- Add `Consent`, `UserPreference`, `OnboardingResponse`, `DailyCheckin`, `JournalSession`, `JournalMessage`, `TimelineBlock`, and `WeeklyInsight`.

**Step 4: Add relations and constraints**

- Add cascade behavior, unique keys, indexes, and mapped snake_case table names.

### Task 2: Align the schema with the approved docs

**Files:**
- Modify: `supabase/prisma/schema.prisma`
- Reference: `docs/02-prd-mvp.md`
- Reference: `docs/03-arquitetura-e-fluxos.md`
- Reference: `docs/plans/2026-03-07-mvp-foundation-design.md`

**Step 1: Match the MVP check-in contract**

- Include mood, energy, clarity, irritability, physical, and social inputs.

**Step 2: Match the privacy contract**

- Add auditable consent records and explicit deletion-friendly relations.

**Step 3: Match the journal contract**

- Keep session summary separate from per-message storage.

**Step 4: Match the planner and weekly insights contract**

- Support daily timeline CRUD and cached weekly insight summaries.

### Task 3: Validate the schema contract

**Files:**
- Validate: `supabase/prisma/schema.prisma`

**Step 1: Review for architecture consistency**

- Confirm there is no app-owned password storage.
- Confirm all core entities have relations and indexes.

**Step 2: Review for parallel-agent safety**

- Keep naming predictable and avoid speculative tables not grounded in docs.
