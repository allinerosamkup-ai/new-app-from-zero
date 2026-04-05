# Aura AI Prompt Architecture Design

**Date:** 2026-04-05

**Status:** Approved

**Goal:** Reorganize the application's AI behavior so every surface inherits the same Aura identity from a strong central prompt while keeping its own explicit behavioral contract.

## Problem

The current AI system already has a centralized Aura prompt, but behavior is still split across backend services and many inline prompts in `apps/backend/src/index.ts`. This causes overlap between surfaces, weakens specificity, and creates behavioral leakage. The clearest example is the journal flow: live conversation, session closing, and task generation are currently mixed.

The app's AI is a product-critical layer. Optimizing isolated prompts without a system inventory would produce patchwork behavior and future regressions.

## Current Inventory

### Core prompt layer

- `apps/backend/src/lib/aura-prompt.ts`
  Central Aura identity and domain guidance.

### Service-level prompt surfaces

- `apps/backend/src/services/ai.service.ts`
  - `buildJournalPrompt`
  - `streamJournalReply`
  - `generateOnboardingProfile`
  - `summarizeJournalSession`
- `apps/backend/src/services/checkin.service.ts`
  - `evaluateDayState`
- `apps/backend/src/services/insight.service.ts`
  - `getWeeklyInsights`

### Prompt router layer

- `apps/backend/src/index.ts`
  - `/api/ai/suggest`
  - inline prompt variants:
    - `task-notes`
    - `task-checklist`
    - `task-title`
    - `day-tasks`
    - `journal-tasks`
    - `goal-subtasks`
    - `weekly-insight`
    - `stability-analysis`
    - `ai-goals`
    - `home-messages`
    - `agenda-blocks`
    - `checkin-response`
    - `gtd-clarify`
    - `goal-route`
    - `phase-transition`
    - `follow-up`

### Web surfaces consuming the AI

- `apps/web/src/routes/journal-page.tsx`
- `apps/web/src/routes/aura-chat-page.tsx`
- `apps/web/src/routes/checkin-result-page.tsx`
- `apps/web/src/routes/home-page.tsx`
- `apps/web/src/routes/goals-page.tsx`
- `apps/web/src/routes/planner-page.tsx`
- `apps/web/src/components/AutonomousAIEngine.tsx`
- `apps/web/src/routes/daily-summary-page.tsx`

## Approved Surface Matrix

### `journal-live`

- Role: live reflective conversation.
- Allowed:
  - listen
  - deepen
  - name emotions
  - ask one useful follow-up at a time
- Forbidden:
  - auto-close the session
  - summarize
  - propose tasks or commitments
  - behave like planner or operational copilot
- Closing triggers:
  - explicit UI finalize action
  - explicit user phrases such as “por hoje é isso”, “já terminei”, “tchau”

### `journal-finalize`

- Role: session closing and post-session synthesis.
- Allowed:
  - summarize the whole session
  - extract themes and emotions
  - generate 0-3 tasks or commitments derived from the session
- Forbidden:
  - continue the live conversation for multiple turns

### `aura-command`

- Role: operational copilot accessed through the center star button.
- Allowed:
  - interpret free-form requests
  - classify intent
  - route to planner, checklist, goals, agenda, or reflective handoff
  - ask one short clarifying question only when required
- Forbidden:
  - behave as reflective journaling by default
  - produce generic “helpful” text without acting

### `checkin`

- Role: short interpretation of current state.
- Allowed:
  - read the moment
  - offer one micro-action for the next hours
- Forbidden:
  - plan the whole day
  - repeat obvious check-in input

### `home`

- Role: proactive presence on the home screen.
- Allowed:
  - short motivation
  - self-care reminders
  - one proactive suggestion
- Forbidden:
  - act like check-in response
  - act like diary

### `planning`

- Role: transform context into executable tasks or agenda blocks.

### `goal-execution`

- Role: classify captures, break abstractions into micro-actions, and map multi-step work into goals/projects.

### `longitudinal-insight`

- Role: analyze patterns over time for stability, transitions, follow-ups, and weekly insights.

## Central Prompt Model

The AI prompt system should be organized into four layers:

1. `Aura Core`
   Shared identity, product meaning, methodology, tone, safety boundaries, anti-generic rules, and anti-repetition rules.

2. `Surface Policy`
   Explicit rules for each surface:
   - `aura-command`
   - `journal-live`
   - `journal-finalize`
   - `checkin`
   - `home`
   - `planning`
   - `goal-execution`
   - `longitudinal-insight`

3. `Task Instruction`
   Local instruction that describes the immediate job only.
   Example: “generate 3 tasks”, “classify this capture”, “summarize the session”.

4. `Output Schema`
   JSON-only or text-only output constraints.

## Central Prompt Requirements

The central prompt in `apps/backend/src/lib/aura-prompt.ts` must become the single source of truth for:

- Aura identity
- product identity
- methodology
- tone
- anti-generic guardrails
- anti-repetition guardrails
- “do not close conversations unless the surface allows it”
- “do not propose actions unless the surface allows it”

It must not include:

- screen-specific instructions
- endpoint-specific instructions
- one-off JSON schemas
- planner-specific or journal-specific task generation instructions

## Journal Architecture

### Current problem

`/api/journal/message/stream` currently generates `assistant.suggested_tasks` during live streaming. This pushes the conversation toward premature closure and duplicates the role of post-session task generation.

### Approved behavior

- live streaming only handles conversation
- task and commitment suggestions happen only after session finalization
- button-based finalization and phrase-based finalization must share the same backend rule

## Aura Command Architecture

### Current problem

The center star surface in `apps/web/src/routes/aura-chat-page.tsx` currently opens `/journal/start` and streams through `/journal/message/stream`, which couples the operational copilot to the journal pipeline.

### Approved behavior

Create a dedicated command surface with its own backend flow:

- `POST /api/aura/command/start`
- `POST /api/aura/command/stream`

The response contract should carry:

- short assistant message
- classified intent
- chosen action
- structured payload
- clarification requirement when needed

## Cleanup Direction for `/api/ai/suggest`

`/api/ai/suggest` should remain as a reusable execution layer, but its inline prompts must be simplified:

- keep immediate job
- keep data context
- keep output schema
- remove duplicated Aura persona language
- stop embedding cross-surface behavior in local prompt strings

## Acceptance Criteria

- the journal no longer auto-closes
- the journal no longer generates tasks during streaming
- the journal only proposes tasks and commitments after finalization
- the center star Aura surface no longer behaves like the journal pipeline
- every AI surface inherits the same core Aura identity
- every surface has explicit behavioral boundaries
- prompt optimization becomes system-driven rather than patch-driven

## Out of Scope

- redesigning the app UI
- replacing the OpenAI provider
- changing auth or store architecture
- changing planner, goals, or journal product scope beyond AI behavior separation
