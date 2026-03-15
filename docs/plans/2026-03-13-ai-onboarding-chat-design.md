# AI Onboarding Chat Design

**Goal:** Replace the current step-form onboarding with a fixed-question AI onboarding chat that collects essential user context, processes it immediately, and seeds the product with initial learning for check-in, journal, planner, and weekly insights.

## Current State

The project already has:

- `AuthScreen` for login and account creation
- `auth_store` with Supabase session handling
- `OnboardingScreen` with a simple 3-step form
- direct Supabase persistence for `profiles`, `onboarding_responses`, `user_preferences`, and `consents`
- AI processing patterns already established in check-in, journal, and weekly insights

The gap is that onboarding is still a static form and does not start the product's learning loop early enough.

## Product Decision

The onboarding becomes a chat-like guided flow with **8 fixed questions**.

The AI does **not** improvise the interview structure. It follows a fixed script for consistency, storage, analytics, and future comparisons across users.

The app must **not** include identity-politics topics or fields. Personalization is based only on practical product data such as name, age, sleep, routine, energy, goals, and present state.

## Fixed Questions

1. `Como você gosta de ser chamada?`
2. `Quantos anos você tem?`
3. `Como você está se sentindo neste momento?`
4. `Como tem sido seu sono nos últimos dias?`
5. `Que horas você costuma acordar e dormir?`
6. `Como é a sua rotina hoje?`
7. `O que mais tem pesado na sua energia ou no seu dia ultimamente?`
8. `O que você mais gostaria que o app te ajudasse a melhorar primeiro?`

## UX Flow

### Entry Flow

- user opens app
- if unauthenticated: show `AuthScreen`
- if authenticated and `profiles.onboarding_done = false`: show `OnboardingChatScreen`
- if authenticated and onboarding is complete: continue to app shell

### Chat Flow

- the onboarding opens with a welcome AI message
- the UI looks like a lightweight chat, not a questionnaire sheet
- one fixed question is shown at a time
- the user answers in free text
- the next question only unlocks after the current answer is saved locally in state
- a progress indicator shows `1/8`, `2/8`, etc.
- after question 8, the app shows a short processing state
- the AI generates the initial profile output
- the app shows a summary card with first suggestions
- the onboarding completes and transitions to the main experience

### Important UX Rule

This is still a fixed onboarding, not an open free chat. The AI voice is present in the copy and final processing, but the question order is deterministic.

## Data Model

The current onboarding storage is not sufficient for the new scope. It needs to expand.

### Existing Tables To Reuse

- `profiles`
- `onboarding_responses`
- `user_preferences`
- `consents`

### Recommended Data Mapping

#### `profiles`

- `full_name`
- `onboarding_done`

No broader identity fields are added.

#### `user_preferences`

- `wake_time`
- `sleep_time`

These remain the structured home for objective routine preferences.

#### `onboarding_responses`

Add structured fields for the new onboarding answers:

- `age` integer nullable
- `current_feeling` text nullable
- `sleep_quality_note` text nullable
- `routine_text` text nullable
- `main_energy_pressure` text nullable
- `primary_goal` text nullable

Keep and reuse:

- `support_goals`
- `routine_summary`
- `context_notes`

### AI Output Storage

The onboarding also needs processed output from the AI. Recommended fields:

- `ai_profile_summary` text nullable
- `ai_routine_summary` text nullable
- `ai_initial_state_summary` text nullable
- `ai_top_themes` text[] default `{}`
- `ai_initial_suggestions` text[] default `{}`
- `ai_profile_payload` jsonb nullable

This preserves both explicit fields for app consumption and a structured payload for future evolution.

## AI Processing

### Timing

The AI processes the onboarding **after all 8 answers are collected**.

Do not call the LLM after each question. That would add cost, latency, and more moving parts without enough value for the MVP.

### Prompt Objective

The onboarding AI must:

- summarize the user's initial context
- normalize the routine description
- identify the main friction on energy or day organization
- identify initial themes
- generate 3 to 5 soft practical suggestions
- avoid diagnosis
- avoid identity topics
- respond in Brazilian Portuguese

### Expected AI Output

```json
{
  "profileSummary": "string",
  "routineSummaryNormalized": "string",
  "initialStateSummary": "string",
  "topThemes": ["string"],
  "initialSuggestions": ["string"]
}
```

## Persistence Strategy

### During the Chat

The simplest MVP-safe option is:

- store all answers in the onboarding Zustand store first
- persist once at the end

This avoids partial writes across 8 steps.

### On Finish

When the final question is answered:

1. save raw onboarding answers
2. save wake/sleep preferences
3. save/update required consents
4. call AI processing with the full onboarding payload
5. save AI output back to `onboarding_responses`
6. mark `profiles.onboarding_done = true`
7. refresh auth/profile state in the app

## App Effects After Onboarding

The AI onboarding output should immediately influence:

- home welcome copy
- first check-in framing
- journal context
- planner suggestion tone
- weekly insights seed context

This is the moment where the app starts "learning" the user.

## Mobile Architecture

### Files To Evolve

- replace current `OnboardingScreen` behavior with chat-style onboarding
- expand `onboarding_store`
- keep `AuthScreen`
- keep `auth_store`
- update `App.tsx` flow to route:
  - auth
  - onboarding
  - app shell

### New Screen Recommendation

Use a dedicated screen:

- `OnboardingChatScreen.tsx`

This avoids overloading the current step-form screen and keeps the contract clear.

The old onboarding screen can be replaced or retired after migration, but only once the new screen fully covers its current functionality.

## Error Handling

- if AI processing fails after answers are saved:
  - keep the raw onboarding data
  - do not mark onboarding as complete
  - allow retry from the processing state
- if Supabase write fails:
  - show a clear retry state
- if the user closes the app before finishing:
  - MVP can restart onboarding from the beginning unless draft persistence is explicitly added later

## Open Gaps Closed By This Design

This design resolves the main current gaps:

- replaces static onboarding with guided chat UX
- adds the missing user-context fields
- defines where each raw answer is stored
- defines where AI output is stored
- defines when AI runs
- defines when onboarding is considered complete
- keeps alignment with Supabase auth and current mobile architecture

## Recommendation

Implement this as a fixed onboarding-chat workflow over the existing Expo + Supabase stack. Do not introduce a second onboarding system, do not create freeform adaptive interviewing yet, and do not move this flow into the backend unless a concrete need appears. The mobile app already talks directly to Supabase for onboarding persistence, which is sufficient for this phase.
