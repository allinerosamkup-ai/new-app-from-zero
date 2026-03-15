# Supabase Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire the repository to the approved Supabase project with local configuration, environment contract, and the first SQL migration for the MVP schema.

**Architecture:** Supabase remains the backend platform for auth, Postgres, and server-side access control. Prisma stays as a typed schema reference, while the real source of database structure for this stage is a Supabase SQL migration that creates public-domain tables, auth-linked profiles, triggers, and RLS policies.

**Tech Stack:** Supabase, PostgreSQL, SQL, Prisma, TypeScript

---

### Task 1: Add the local Supabase project contract

**Files:**
- Create: `supabase/config.toml`
- Create: `.env.example`

**Step 1: Record the linked Supabase project id**

- Add the current project ref to `supabase/config.toml`.

**Step 2: Define the runtime environment contract**

- Add the mobile, server, and Prisma environment variables to `.env.example` without writing live secrets into the repo.

### Task 2: Add the first Supabase SQL migration

**Files:**
- Create: `supabase/migrations/20260313103000_initial_public_schema.sql`

**Step 1: Create helper functions and auth trigger**

- Add `set_updated_at`.
- Add `handle_new_user`.
- Add the trigger that creates `public.profiles` rows from `auth.users`.

**Step 2: Create MVP tables**

- Add `profiles`, `onboarding_responses`, `user_preferences`, `consents`, `daily_checkins`, `journal_sessions`, `journal_messages`, `timeline_blocks`, and `weekly_insights`.

**Step 3: Add indexes, constraints, and RLS**

- Match the Prisma data contract.
- Add per-user RLS policies using `auth.uid()`.

### Task 3: Validate the local Supabase setup

**Files:**
- Validate: `supabase/config.toml`
- Validate: `.env.example`
- Validate: `supabase/migrations/20260313103000_initial_public_schema.sql`

**Step 1: Check architecture alignment**

- Confirm the schema uses `auth.users` instead of app-owned passwords.
- Confirm consent, onboarding, journal messages, planner, and weekly insights exist.

**Step 2: Check safety for parallel work**

- Keep file naming and table naming predictable for other agents.
