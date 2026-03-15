# Three Daily Check-ins Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update the data contract so each user can save three check-ins per day while keeping a simple aggregated daily chart.

**Architecture:** Store each check-in as an individual event with both a `local_date` and `recorded_at` timestamp. Enforce one record per day slot (`morning`, `midday`, `evening`) and let chart-oriented APIs aggregate by day instead of collapsing the source data.

**Tech Stack:** Prisma, PostgreSQL, Supabase SQL, TypeScript

---

### Task 1: Update the Prisma schema

**Files:**
- Modify: `supabase/prisma/schema.prisma`

**Step 1: Add intraday tracking fields**

- Add `recordedAt`.
- Add `checkinSlot`.

**Step 2: Remove the single-check-in-per-day rule**

- Replace the daily unique key with a user-day-slot unique key.

### Task 2: Update the Supabase migration

**Files:**
- Modify: `supabase/migrations/20260313103000_initial_public_schema.sql`

**Step 1: Align the table definition**

- Add `recorded_at`.
- Add `checkin_slot`.
- Replace the unique constraint.

**Step 2: Add guardrails**

- Add a slot check constraint for `morning`, `midday`, `evening`.
- Add an index that supports latest-check-in lookups.

### Task 3: Validate the contract

**Files:**
- Validate: `supabase/prisma/schema.prisma`
- Validate: `supabase/migrations/20260313103000_initial_public_schema.sql`

**Step 1: Confirm product behavior support**

- Verify that the schema supports up to three check-ins per day.
- Verify that the latest daily check-in can be queried efficiently.

**Step 2: Confirm chart compatibility**

- Verify that aggregation by `local_date` still works cleanly.
