# Airia Integrated Check-in Design

**Date:** 2026-07-31
**Status:** Approved by the user

## Product purpose

Airia is an adaptive personal assistant whose core input is the person's current state. Mood and energy are not decorative tracking fields: they feed the current phase, the capacity of the day, Planner sizing, Home guidance, longitudinal patterns and the tone and scope of the next action.

The central Airia chat is the command surface for that system. A state report such as “Estou chateada e cansada” must be understood as a current emotional/energy check-in, persisted through the same application flow as the visual check-in, and reflected across every consumer. It must never become a reminder to perform a check-in later.

## Confirmed failure

The current pipeline recognizes `cansada` as a state signal and authorizes `log_checkin`, but leaves the message classified as ambiguous conversation. If the model returns `respond`, recovery only handles explicit commands and only extracts numeric scores. The plan builder then persists an empty draft, which the web renders as “0 ações”.

Past that point, the contracts also disagree:

- the visual check-in asks for mood and energy but sends artificial defaults for clarity and irritability;
- `/api/checkins` requires fields the user did not necessarily report;
- the Airia plan builder and executor require another subset and invent physical/social values;
- the Airia executor writes directly to `daily_checkins`, bypassing risk assessment, grounding, state analysis, memory and knowledge graph ingestion;
- voice returns translated labels rather than canonical factor IDs and treats hours slept as a 1–10 score;
- the native client still documents a 1–5 scale while web/backend use 1–10;
- conversational responses receive an empty command plan even when there is no operation.

## Chosen architecture

Use one canonical pipeline for screen, text and voice:

```text
screen | Airia text | Airia voice
            ↓
typed CheckinDraft with provenance and confidence
            ↓
deterministic authorization + readiness validation
            ↓
single CheckinApplicationService
            ↓
persist → safety → grounding → state evaluation → memory/graph
            ↓
Home | Planner | Check-in result | Patterns | Journal context | Airia receipt
```

The implementation will reuse patterns rather than import a new orchestration framework:

- typed slots, validation and repair from Rasa;
- intent/slots/handler separation and utterance corpora from Home Assistant/HassIL;
- idempotent side effects and resumable results from LangGraph;
- explicit action observations from Leon.

## Canonical contract

The only new command intent is `record_checkin`. Legacy `log_checkin` and `create_checkin` values are normalized at boundaries so previously persisted plans remain readable, but no new flow emits them.

```ts
type CheckinSignal = {
  value: number | null;
  provenance: 'reported' | 'inferred' | 'absent';
  confidence: number;
  evidence: string[];
};

type CheckinDraft = {
  status: 'ready' | 'needs_clarification' | 'unsupported';
  localDate: string;
  occurredAt: string;
  source: 'screen' | 'aura_text' | 'aura_voice' | 'mobile';
  sourceMessageId: string | null;
  idempotencyKey: string | null;
  rawText: string | null;
  note: string | null;
  emotions: string[];
  factors: string[];
  mood: CheckinSignal;
  energy: CheckinSignal;
  clarity: CheckinSignal;
  irritability: CheckinSignal;
  physical: CheckinSignal;
  social: CheckinSignal;
  sleepScore: CheckinSignal;
  sleepHours: number | null;
};
```

Mood and energy are the only core numerical signals required to calculate the adaptive state. Qualitative words may infer those scores when the evidence is strong. The record stores that they were inferred, including confidence and evidence. Clarity, irritability, physical and social remain absent unless explicitly reported; they are no longer filled with neutral values.

For “Estou chateada e cansada” the draft is ready because both core signals have high-confidence lexical evidence:

- emotion: `sad`/`upset` (reported phrase preserved as evidence);
- mood: low, inferred;
- energy: low, inferred;
- raw text and note preserved;
- other signals absent.

If only one core signal is available, Airia asks one short question for the missing core signal. Explicit refusal such as “só estou desabafando, não registre” always blocks persistence.

## Persistence and idempotency

`daily_checkins` stores:

- source and source message;
- signal metadata with provenance/confidence/evidence;
- an idempotency key;
- explicit sleep hours separately from the normalized sleep score;
- nullable optional signals.

The same message cannot create a duplicate record. A second distinct check-in in the same period must not overwrite the first: generated slots include the period plus a stable time/message suffix. Repeating the same request returns the existing record and its persisted result.

## Application service

`CheckinApplicationService.record()` is the only supported writer. Both `POST /api/checkins` and the Airia command executor call it. It owns:

1. schema validation and normalization;
2. idempotency lookup;
3. persistence;
4. risk/safety assessment;
5. current-context grounding;
6. state evaluation and adaptive recommendation;
7. update of `stateLabel`, `stateSummary` and `aiState`;
8. asynchronous memory, knowledge graph and background jobs;
9. a structured persisted result used by every UI receipt.

The command executor receives this writer as a dependency and runs check-in operations outside its generic database transaction. It only marks the command operation applied after the canonical service returns a real `checkinId`.

## User experience

High-confidence state reports auto-apply because logging the current state is a low-cost, reversible action. Airia shows a compact receipt derived from the saved record:

```text
CHECK-IN REGISTRADO
Humor baixo · Energia baixa
Isso já ajustou a leitura do seu dia.
[Ajustar check-in]
```

No empty plan card is rendered for conversation. A check-in plan card only appears when clarification/review is genuinely required. The adjustment CTA opens the existing check-in screen with the saved values rather than creating a parallel editor.

## Cross-surface effects

- **Home:** refreshes the current phase/state and the main adaptive action.
- **Planner:** receives the new energy/mood capacity before scheduling or sizing flexible work.
- **Check-in/Result:** displays the same record and `aiState`, regardless of entry source.
- **Patterns/Insights:** aggregates real and inferred signals without confusing missing values with neutral scores.
- **Journal and memory:** receive the same grounded context and provenance; raw emotional text is not converted into a task.
- **Voice:** uses the same vocabulary IDs and understanding service; sleep hours are not a subjective score.
- **Mobile:** types and controls align to the canonical 1–10 contract and nullable optional signals.

## Safety and privacy

Risk assessment runs before generating operational guidance for every source. Crisis/human-support routing remains visible in Airia, Check-in, Result and Journal. Inferred mood/energy is not a medical diagnosis, and provenance prevents the app from presenting an inferred number as something the user explicitly selected.

## Acceptance criteria

1. “Estou chateada e cansada” creates and applies one real check-in even when the model returns `respond` or is unavailable.
2. The same message is idempotent; a different later check-in does not overwrite it.
3. No unmentioned optional signal is stored as reported or filled with a default.
4. Explicit refusal creates no operation and no record.
5. A state report plus an operational request creates both authorized operations.
6. Screen, Airia text and voice call the same application writer and receive equivalent state analysis.
7. Home, Planner, Check-in result and Patterns reflect the persisted record after refresh.
8. Normal conversation does not render a “0 ações” card.
9. PT-BR utterance corpus covers colloquial state language, negation, corrections and numeric scores.
10. Backend/web tests and builds, mobile typecheck, authenticated E2E, database migration, VPS SHA and production health checks all pass before release completion.
