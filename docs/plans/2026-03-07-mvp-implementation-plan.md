# Mood & Energy MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a beginner-friendly, mobile-first MVP that captures daily mood and energy, uses OpenAI for guided reflection and suggestions, and stores everything safely in Supabase.

**Architecture:** The first release should stay simple: an Expo app connected to Supabase Auth, Postgres, Storage, and Edge Functions. OpenAI should only be called from server-side functions. n8n stays out until the product proves it needs real automation.

**Tech Stack:** Expo, React Native, TypeScript, Supabase, PostgreSQL, Edge Functions, OpenAI, Zustand, React Navigation, basic testing, simple CI.

---

## How To Use This Plan

This plan is written for someone who is starting from zero and wants to build with vibe coding. That means:

1. do one small block at a time;
2. validate each block before moving on;
3. do not try to build the whole app in one prompt;
4. keep the first version ugly-but-working before trying to polish everything.

## Recommended Build Order

1. Organize the project
2. Set up Supabase
3. Create the app shell
4. Make login and onboarding work
5. Make check-in work
6. Connect OpenAI to generate the day state
7. Show the result on the Today screen
8. Build the journal
9. Build the planner
10. Build weekly insights
11. Add privacy, analytics, and beta release

## Full Task List

### Phase 0: Prepare The Ground

1. Create a real repository structure with folders for `mobile`, `supabase`, `packages`, and `docs`.
2. Initialize git so you can go back if AI breaks something.
3. Add a simple README explaining the project and local setup.
4. Choose one package manager only, preferably `pnpm`.
5. Create a decision log file so product and stack choices stop changing every day.

### Phase 1: Lock The Product Shape

1. Turn the current docs into one short MVP checklist:
   - onboarding
   - check-in
   - Today screen
   - journal
   - planner
   - weekly insights
   - settings/privacy
2. Define the exact day-state labels:
   - example: `leve`, `estavel`, `sensivel`, `sobrecarregado`
3. Define what each label changes:
   - tone of message
   - planner suggestion style
   - task intensity suggestion
4. Define 3 simple success metrics for the MVP:
   - user finishes onboarding
   - user completes a check-in
   - user accepts at least one planner suggestion

### Phase 2: Set Up Supabase

1. Create the Supabase project.
2. Configure authentication.
3. Create the first tables:
   - `profiles`
   - `consents`
   - `daily_checkins`
   - `journal_sessions`
   - `journal_messages`
   - `timeline_blocks`
   - `weekly_insights`
4. Add RLS so one user only sees their own data.
5. Prepare realistic QA fixtures outside the consumer app when needed.
6. Write down the deletion flow before storing sensitive data.

### Phase 3: Create The Mobile Base

1. Create the Expo app.
2. Add navigation with these areas:
   - Hoje
   - Diario
   - Insights
   - Configuracoes
3. Connect the app to Supabase.
4. Add a very small design system:
   - colors
   - spacing
   - cards
   - buttons
   - tags
5. Create loading, empty, and error states early.

### Phase 4: Build Auth And Onboarding

1. Create sign-up and sign-in screens.
2. Create onboarding with the minimum questions:
   - what the user wants help with
   - rough routine
   - consent choices
3. Save onboarding answers in Supabase.
4. Confirm the user can sign in again and keep their profile.

### Phase 5: Build The First End-To-End Loop

This is the first real milestone and should be your first working version.

1. Build the check-in screen.
2. Save mood, energy, clarity, irritability, physical state, and optional note.
3. Create a server-side function that sends the check-in to OpenAI.
4. Force OpenAI to return structured JSON with:
   - day-state label
   - short summary
   - suggested tone for the day
5. Save that result in Supabase.
6. Show the result on the Today screen.

If this loop works, you already have the core thesis of the product alive.

### Phase 6: Build The Today Screen

1. Show the current day state clearly.
2. Show a short supportive message.
3. Add quick buttons for:
   - new check-in
   - open journal
   - open planner
4. Show a mini version of the planner.
5. Add empty states for first-time users.

### Phase 7: Build The Journal

1. Start with text only.
2. Create a chat-like screen.
3. Save each message in `journal_messages`.
4. Create a finalize-session function that asks OpenAI for:
   - short summary
   - emotions
   - themes
5. Save the result in `journal_sessions`.
6. Show a summary screen after the session ends.

Audio should come later, not before text works.

### Phase 8: Build The Planner

1. Create a vertical timeline for the day.
2. Let the user create simple blocks:
   - title
   - start time
   - duration
3. Let the user edit, move, and complete a block.
4. Show lighter or heavier suggestions depending on the day state.
5. Add AI planner suggestions only after manual planner CRUD is stable.

### Phase 9: Build Weekly Insights

1. Aggregate seven days of check-ins and sessions.
2. Generate 2 or 3 simple insights with OpenAI.
3. Save them in `weekly_insights`.
4. Show a basic weekly chart or list.
5. Keep this simple in v1.

### Phase 10: Add Privacy And Safety

1. Create a privacy screen.
2. Show what data is stored.
3. Add delete account and delete data flow.
4. Decide how long raw journal text is kept.
5. Add fallback behavior for sensitive journal content.

### Phase 11: Prepare Beta

1. Add basic tests for the core flow.
2. Add a simple CI check.
3. Configure Expo build profiles.
4. Publish to a small beta group.
5. Collect answers to:
   - did the app help you understand your day?
   - did the suggestion make sense?
   - would you use it again tomorrow?

## What You Should Build First

If you want the smartest order with the least chance of getting stuck, build only this first:

1. Supabase auth
2. onboarding
3. check-in form
4. OpenAI state evaluation
5. Today screen

Do not start with journal, planner, charts, audio, n8n, or wearables.

## What To Leave For Later

These are good ideas, but they should not block MVP:

1. audio input
2. n8n automations
3. wearable integrations
4. web app
5. fancy animations
6. advanced productivity systems

## Best Practices For Vibe Coding

1. Ask the AI for one folder or one feature at a time.
2. Always ask for the exact files it will create before generating code.
3. After each step, run the app and test only that step.
4. Keep prompts concrete:
   - bad: "build my whole app"
   - good: "create the Expo auth screens and Supabase client only"
5. Save working versions often.
6. When something breaks, go back one step instead of adding more code on top.

## Best Tool Split For You

1. `Stitch`: use to think visually and decide flows.
2. `Lovable`: use only if you want a quick landing page or a rough web prototype.
3. `Supabase`: real backend and real data.
4. `OpenAI`: real AI behaviors.
5. `Expo`: real product app.

## Final Recommendation

Do not try to "finish the whole project" first. Finish one believable core loop first:

`login -> onboarding -> check-in -> AI result -> Today screen`

After that, expand in this order:

`journal -> planner -> insights -> privacy hardening -> beta`

Plan complete and saved to `docs/plans/2026-03-07-mvp-implementation-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
