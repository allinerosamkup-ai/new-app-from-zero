# API Contracts

**Last updated:** 2026-04-30
**Status:** Working contract

Planner metadata fields updated and applied to Supabase on 2026-04-12.
Daily context and agenda adaptation endpoints added on 2026-04-30.
Decision Brain and Adaptive Agenda response metadata added on 2026-04-30.

## Journal

### `POST /api/journal/start`

Creates or resumes the active journal session for the user and returns the current context plus ordered message history.

**Request**

```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response 200**

```json
{
  "sessionId": "7a0f7c1e-1f25-4d9a-8b9a-b3d2df6a7d11",
  "created": false,
  "messages": [
    {
      "id": "msg_123",
      "role": "assistant",
      "content": "Estou aqui com você.",
      "createdAt": "2026-03-13T12:00:05.000Z"
    }
  ],
  "context": {
    "routineSummary": "Costuma trabalhar melhor no fim da manhã.",
    "promptSummary": "Rotina percebida: Costuma trabalhar melhor no fim da manhã.",
    "topThemes": ["trabalho"],
    "topPlannerCategories": ["trabalho"],
    "checkinToday": {
      "moodScore": 3,
      "energyScore": 2,
      "stateLabel": "Dia sensível"
    }
  }
}
```

### `POST /api/journal/message/stream`

Receives a new user message and returns Server-Sent Events with the streamed assistant reply.

**Request**

```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "sessionId": "7a0f7c1e-1f25-4d9a-8b9a-b3d2df6a7d11",
  "message": "Hoje está difícil focar."
}
```

**SSE Events**

- `session.started`

```json
{
  "sessionId": "7a0f7c1e-1f25-4d9a-8b9a-b3d2df6a7d11"
}
```

- `assistant.delta`

```json
{
  "chunk": "Olá, "
}
```

- `assistant.completed`

```json
{
  "sessionId": "7a0f7c1e-1f25-4d9a-8b9a-b3d2df6a7d11",
  "message": {
    "id": "msg_456",
    "role": "assistant",
    "content": "Olá, estou com você.",
    "createdAt": "2026-03-13T12:00:10.000Z"
  }
}
```

- `error`

```json
{
  "error": "Failed to stream journal message"
}
```

### `POST /api/journal/finalize`

Finalizes the session, summarizes the conversation, and persists summary metadata on `journal_sessions`.

**Request**

```json
{
  "sessionId": "7a0f7c1e-1f25-4d9a-8b9a-b3d2df6a7d11"
}
```

**Response 200**

```json
{
  "sessionId": "7a0f7c1e-1f25-4d9a-8b9a-b3d2df6a7d11",
  "summary": {
    "text": "Você falou sobre pressão e cansaço, mas também sobre vontade de reorganizar o dia.",
    "emotions": ["ansiosa", "cansada"],
    "themes": ["trabalho", "rotina"],
    "suggestions": ["Talvez valha reduzir o peso do começo da tarde."]
  },
  "sessionStatus": "completed"
}
```

## Onboarding

### `POST /api/onboarding/process`

Processes the 8 fixed onboarding answers and returns the initial AI profile used to seed personalization.

**Request**

```json
{
  "fullName": "Ana",
  "age": 33,
  "currentFeeling": "Estou cansada e um pouco sobrecarregada.",
  "sleepQualityNote": "Tenho dormido mal nos últimos dias.",
  "wakeTime": "07:00",
  "sleepTime": "23:00",
  "routineText": "Trabalho o dia todo e no fim da tarde fico esgotada.",
  "mainEnergyPressure": "Excesso de demandas e pouco descanso.",
  "primaryGoal": "Quero organizar melhor minha energia.",
  "supportGoals": ["routine", "stability"]
}
```

**Response 200**

```json
{
  "profileSummary": "Você está começando o app com vontade de reorganizar a rotina com mais gentileza.",
  "routineSummaryNormalized": "Acorda às 07:00, dorme às 23:00 e sente mais peso no fim da tarde.",
  "initialStateSummary": "Chega cansada e buscando mais estabilidade para os próximos dias.",
  "topThemes": ["sono", "rotina", "trabalho"],
  "initialSuggestions": [
    "Comece com blocos leves nas primeiras horas.",
    "Observe o impacto do sono nas tardes mais pesadas.",
    "Deixe pausas curtas entre demandas importantes."
  ]
}
```

## Daily Context and AI Feedback

## Risk Safety

AI surfaces can return a `riskSafety` object. This is not a diagnosis. It is a safety routing layer used to keep Airia positioned as an adaptive support product, not a clinical replacement.

Canonical shape shared by Check-in, Journal and Aura completed responses:

```json
{
  "riskLevel": "none | low | moderate | high | crisis",
  "signals": ["humor e energia muito baixos"],
  "route": "self_support | adapt_day | human_support | crisis_protocol",
  "message": "A Airia deve sugerir apoio humano e reduzir carga do dia, sem diagnosticar."
}
```

Current surfaces:

- `POST /api/checkins`: response includes top-level `riskSafety` and stores it under `aiState.riskSafety`.
- `POST /api/journal/message/stream`: `assistant.completed` SSE includes `riskSafety`.
- `POST /api/aura/command/stream`: `assistant.completed.response` includes `riskSafety`.

Client behavior:

- Check-in Result, Journal, and Aura Chat render the shared safety protocol card when route is not `self_support`.
- `human_support` and `crisis_protocol` record `risk_protocol_triggered`.
- `crisis_protocol` shows Brazil-ready emergency resources: CVV 188, SAMU 192, and 190, plus the instruction to use local emergency services outside Brazil.
- The assistant must not diagnose, promise treatment/cure, or position itself as a therapist, psychologist, psychiatrist or emergency service.

### `GET /api/context/day?date=YYYY-MM-DD`

Returns the backend-grounded day package used by AI surfaces. This is the canonical source for operational suggestions.

**Response 200**

```json
{
  "source": "ContextGroundingService",
  "date": "2026-04-30",
  "pendingTaskTitles": ["Responder cliente"],
  "completedTaskTitles": ["Treino"],
  "pendingHabitTitles": ["Diário"],
  "completedHabitTitles": ["Ginástica"],
  "activeGoalTitles": ["Preparar proposta da Airia"],
  "completedGoalTitles": [],
  "completedSubgoalTitles": ["Separar prints"],
  "recentSuggestionTitles": ["Separar roupa de treino"],
  "blockedActionTitles": ["Kit do treino"],
  "todayAnchorTitles": ["Responder cliente", "Diário", "Preparar proposta da Airia"],
  "decisionBrain": {
    "surface": "agenda",
    "date": "2026-04-30",
    "allowedActions": [
      {
        "title": "Responder cliente",
        "kind": "real_commitment",
        "action": "keep",
        "notificationAllowed": true,
        "requiresConfirmation": false
      },
      {
        "title": "Preparar proposta da Airia",
        "kind": "suggested_commitment",
        "action": "suggest",
        "notificationAllowed": false,
        "requiresConfirmation": true
      }
    ],
    "blockedActions": [
      {
        "title": "Treino",
        "kind": "blocked",
        "reason": "Tarefa já concluída hoje."
      }
    ]
  },
  "adaptiveAgenda": {
    "date": "2026-04-30",
    "trigger": "context-day",
    "applied": false,
    "decisions": [],
    "blocked": []
  },
  "actionFeedback": [
    {
      "key": "separar roupa de treino",
      "title": "Separar roupa de treino",
      "status": "dismissed",
      "surface": "home",
      "sourceType": "stability-analysis",
      "localDate": "2026-04-30",
      "createdAt": "2026-04-30T10:00:00.000Z"
    }
  ],
  "operationalRule": "Contexto antigo explica padrão; padrão verificado pode calibrar uma Ação quando há relevância atual, Objetivo/intenção, capacidade, segurança e evidência persistida."
}
```

### `POST /api/ai/action-feedback`

Stores feedback about an AI-suggested action. Feedback is used by `DailyContext` to block repetition.

**Request**

```json
{
  "title": "Separar roupa de treino",
  "status": "dismissed",
  "surface": "home",
  "sourceType": "stability-analysis",
  "localDate": "2026-04-30"
}
```

Allowed `status`: `shown`, `accepted`, `done`, `dismissed`, `deleted`, `scheduled`, `rejected`.

Blocking statuses: `done`, `dismissed`, `deleted`, `scheduled`, `rejected`.

**Response 200**

```json
{
  "stored": true,
  "item": {
    "key": "separar roupa de treino",
    "title": "Separar roupa de treino",
    "status": "dismissed",
    "surface": "home",
    "sourceType": "stability-analysis",
    "localDate": "2026-04-30",
    "createdAt": "2026-04-30T10:00:00.000Z"
  }
}
```

### `POST /api/agenda/adapt`

Returns an adaptation preview or applies selected confirmed decisions for the day. V1 never silently changes the agenda; `mode = "apply"` only runs decisions listed in `selectedDecisionIds`.

Important rules:

- `real_commitment`: saved agenda item, real habit or saved task.
- `suggested_commitment`: optional suggestion that may include a suggested block/time, but cannot be saved or notified without user confirmation.
- `insight_only`: pattern reading with no operational action.
- `blocked`: completed, rejected, repeated, expired, generic or ungrounded action.
- `notificationAllowed: false` means the app must not create a notification from that item.

**Request**

```json
{
  "date": "2026-04-30",
  "mode": "preview",
  "trigger": "checkin",
  "selectedDecisionIds": [],
  "context": {
    "phase": "Turbulência",
    "currentHour": 11,
    "currentMinute": 20
  }
}
```

**Response 200**

```json
{
  "date": "2026-04-30",
  "mode": "preview",
  "trigger": "checkin",
  "summary": "Agenda adaptativa encontrou 1 decisão(ões) possíveis, sem aplicar nada automaticamente.",
  "changes": [
    {
      "id": "task:responder-cliente",
      "type": "pause",
      "title": "Responder cliente",
      "targetId": "550e8400-e29b-41d4-a716-446655440000",
      "targetType": "timeline",
      "from": "11:00",
      "to": null,
      "suggestedDate": "2026-05-01",
      "suggestedStartTime": "11:00",
      "suggestedEndTime": "12:00",
      "reason": "Compromisso real pesado em fase de baixa capacidade; melhor pausar ou revisar escopo.",
      "bioReason": "A fase atual sinaliza menor capacidade; pausar evita transformar uma tarefa pesada em sobrecarga.",
      "impactLabel": "protege energia",
      "confidence": 0.82,
      "kind": "real_commitment",
      "requiresConfirmation": true,
      "notificationAllowed": true
    }
  ],
  "blockedSuggestions": ["Treino", "Separar roupa de treino"],
  "blockedDecisions": [
    {
      "type": "block",
      "title": "Treino",
      "kind": "blocked",
      "reason": "Tarefa já concluída hoje.",
      "notificationAllowed": false
    }
  ],
  "adaptiveAgenda": {
    "date": "2026-04-30",
    "trigger": "checkin",
    "surface": "agenda",
    "applied": false
  },
  "applied": false
}
```

Allowed change `type`: `keep`, `move`, `shrink`, `pause`, `suggest`, `convert`, `notify`, `block`, `skip`.

Apply response adds:

```json
{
  "mode": "apply",
  "applied": true,
  "appliedChanges": [{ "id": "task:responder-cliente", "type": "move", "applied": true }],
  "skippedChanges": [],
  "timelineRefreshNeeded": true
}
```

Scheduling rules:

- The backend receives local client time through `currentHour/currentMinute`.
- Suggestions use the current time and existing timeline blocks to find a viable free window.
- If no safe window remains today, suggested blocks can target the next day.
- `keep`, `block` and `notify` are never applied as structural agenda changes.
- When a Health Connect snapshot exists, measured sleep becomes the strongest sleep signal; steps, heart rate and exercise complement `bioReason`.

### Health Connect

Android native integration. The web app requests sync through the React Native shell, the native layer asks Health Connect permissions, reads today's local signals and stores a snapshot through the backend.

#### `GET /api/health-connect/latest`

Returns the latest Health Connect snapshot saved for the authenticated user.

```json
{
  "connected": true,
  "snapshot": {
    "source": "health_connect",
    "localDate": "2026-05-06",
    "sleepMinutes": 435,
    "sleepScore": 8,
    "steps": 6420,
    "avgHeartRate": 72,
    "exerciseMinutes": 25,
    "syncedAt": "2026-05-06T12:30:00.000Z"
  },
  "createdAt": "2026-05-06T12:30:01.000Z"
}
```

#### `POST /api/health-connect/sync`

Stores a Health Connect snapshot as `event_logs.event_name = "health_connect.synced"`.

```json
{
  "source": "health_connect",
  "localDate": "2026-05-06",
  "sleepMinutes": 435,
  "sleepScore": 8,
  "steps": 6420,
  "avgHeartRate": 72,
  "exerciseMinutes": 25,
  "syncedAt": "2026-05-06T12:30:00.000Z"
}
```

Usage in the decision engine:

- sleep from Health Connect replaces subjective sleep as the primary sleep signal when present;
- poor measured sleep can lower capacity even if the phase label is not low;
- steps, heart rate and exercise are explanatory body signals, not automatic task generators.

## Planner

### `GET /timeline/:date`

Returns the timeline blocks for a single day plus derived statistics for the current response.

**Response 200**

```json
{
  "date": "2026-03-13",
  "blocks": [
    {
      "id": "block_123",
      "startTime": "2026-03-13T09:00:00.000Z",
      "endTime": "2026-03-13T10:30:00.000Z",
      "title": "Planejamento da semana",
      "category": "trabalho",
      "intensity": "M",
      "status": "planned",
      "isAiSuggested": false,
      "aiReasoning": null,
      "noteMode": "checklist",
      "note": "Separar documentos antes de sair.",
      "checklist": [
        { "id": "item_1", "text": "Pegar documento", "done": false }
      ],
      "recurring": {
        "enabled": false,
        "frequency": "daily",
        "days": [],
        "everyNDays": 1
      },
      "energyLevel": "media",
      "lastResetDate": null
    }
  ],
  "stats": {
    "totalHours": 6.5,
    "workHours": 4.0,
    "restHours": 1.0,
    "intensityDistribution": {
      "L": 2,
      "M": 2,
      "P": 1
    }
  }
}
```

### Response Mapping

- `blocks[].startTime` maps from `timeline_blocks.start_at`
- `blocks[].endTime` maps from `timeline_blocks.end_at`
- `blocks[].isAiSuggested` maps from `timeline_blocks.is_ai_suggested`
- `blocks[].aiReasoning` maps from `timeline_blocks.ai_reasoning`
- `blocks[].noteMode` maps from `timeline_blocks.note_mode`
- `blocks[].checklist` maps from `timeline_blocks.checklist`
- `blocks[].recurring` maps from `timeline_blocks.recurring`
- `blocks[].energyLevel` maps from `timeline_blocks.energy_level`
- `blocks[].lastResetDate` maps from `timeline_blocks.last_reset_date`

### `POST /timeline`

Saves one or more blocks for a day. Planner metadata is optional, so partial updates such as completing or dragging a block do not erase notes, checklist or recurrence.

**Request**

```json
{
  "date": "2026-03-13",
  "forceSave": true,
  "blocks": [
    {
      "id": "block_123",
      "startTime": "09:00",
      "endTime": "10:30",
      "title": "Planejamento da semana",
      "category": "trabalho",
      "intensity": "M",
      "status": "planned",
      "noteMode": "checklist",
      "note": "Separar contexto antes de comecar.",
      "checklist": [
        { "id": "item_1", "text": "Abrir pauta", "done": false }
      ],
      "recurring": {
        "enabled": true,
        "frequency": "weekly",
        "days": [0, 2, 4],
        "everyNDays": 1
      },
      "energyLevel": "media",
      "lastResetDate": "2026-03-12"
    }
  ]
}
```

### Stats Rules

- `totalHours`: sum of all block durations for the requested date
- `workHours`: sum of durations where `category = "trabalho"`
- `restHours`: sum of durations where `category = "autocuidado"`
- `intensityDistribution.L`: count of blocks where `intensity = "L"`
- `intensityDistribution.M`: count of blocks where `intensity = "M"`
- `intensityDistribution.P`: count of blocks where `intensity = "P"`

### Safe Category Rule

To avoid divergence while multiple agents work in parallel, the MVP uses a conservative rule:

- only `trabalho` contributes to `workHours`
- only `autocuidado` contributes to `restHours`
- all other categories still contribute to `totalHours`

This rule can be expanded later, but it should not be inferred differently by different parts of the system.

### `POST /timeline/:id/postpone`

Moves a Planner block to the next day, preserving its time, metadata and planned status. The action is recorded as analytics context so Airia can detect repeated postponement patterns.

**Request**

```json
{
  "targetDate": "2026-05-01",
  "reason": "manual_planner_button"
}
```

`targetDate` is optional. If omitted, the backend moves the block to the day after its current `localDate`.

**Response 200**

```json
{
  "postponed": true,
  "originalDate": "2026-04-30",
  "targetDate": "2026-05-01",
  "postponeCount": 2,
  "block": {
    "id": "block_123",
    "title": "Responder cliente",
    "status": "planned"
  }
}
```

Side effects:

- Creates `event_logs.event_name = "timeline.block_postponed"`.
- Stores AI action feedback with `status = "scheduled"`, `surface = "planner"` and `sourceType = "timeline-postpone"`.
- Recent postponements are included in `DailyContext.postponedActions` and in the AI grounding text.

## Professional partners and referrals

All non-admin routes below require the authenticated Supabase user. A `userId`
sent in the request body is ignored.

### `POST /professional-partners/apply`

Normalizes and submits a professional CRP application. New or changed
professional identities return to `pending` until verified.

```json
{
  "professionalName": "Dra. Ana Lima",
  "crpRegion": "06",
  "crpNumber": "123456"
}
```

The response includes the applicant's own status. `referralCode` is `null`
until the application is both `verified` and active.

### `GET /professional-partners/me`

Returns the authenticated professional's application, verification status and,
after approval, their persistent referral code. It never returns referred-user
identities or a patient list.

### `POST /referrals/claim`

Claims one verified, active referral code for the authenticated user.

```json
{ "code": "AIRIA-AB12CD" }
```

A valid pre-onboarding claim grants a 14-day benefit. A claim made after an
initial trial was already granted records attribution but never restarts or
extends that trial. Self-referral, inactive codes and replacing a previous
claim are rejected.

### `GET /referrals/me`

Returns benefit days, whether the benefit was applied, and only the public
professional name. It does not expose CRP details, health data or therapeutic
relationship data.

### `POST /admin/professional-partners/:partnerId/verify`

Requires a valid `x-admin-key` matching `ADMIN_SECRET`; normal authentication is
not sufficient. Accepts `verified`, `rejected` or `review_required`, stamps the
verification time and stores an optional short review note.

## Billing and access

All status, Checkout, verification, and portal routes except the Stripe webhook
require the authenticated user. Body `userId` values are ignored.

### `GET /billing/status`

Returns the canonical entitlement summary plus the server-owned offer catalog.
`access`, not a frontend guess from `subscriptionStatus`, decides Pro access.

```json
{
  "access": "pro",
  "source": "trial",
  "subscriptionStatus": null,
  "plan": null,
  "periodEnd": null,
  "trialEndsAt": "2026-08-17T12:00:00.000Z",
  "daysRemaining": 7,
  "checkoutAvailable": true,
  "offers": [
    { "plan": "monthly", "amountCents": 2990, "currency": "BRL", "billingPeriod": "month", "enabled": true },
    { "plan": "annual", "amountCents": 24900, "currency": "BRL", "billingPeriod": "year", "enabled": true },
    { "plan": "lifetime", "amountCents": 9900, "currency": "BRL", "billingPeriod": "once", "enabled": true }
  ]
}
```

### `POST /billing/checkout`

Accepts exactly `monthly`, `annual`, or `lifetime`. Recurring plans open a Stripe
subscription Checkout; lifetime opens a one-time payment Checkout. The server
uses the authenticated identity, configured Price IDs, metadata, and Stripe
idempotency. Invalid or disabled offers never fall back silently to another plan.

```json
{ "email": "ana@example.com", "plan": "lifetime" }
```

### `GET /billing/checkout-session/:sessionId`

Confirms that the Checkout belongs to the authenticated user and reports whether
payment/subscription state is confirmed. A URL alone never activates access.

### `POST /billing/portal`

Creates a customer-portal session for the authenticated Stripe customer. Missing
customers return `no_subscription`.

### `POST /billing/webhook`

Public only for Stripe delivery. It requires a valid `stripe-signature` over the
raw body. Events are deduplicated by Stripe event ID and synchronize subscription,
invoice, cancellation, and paid lifetime state transactionally.

## Privacy export additions

The authenticated privacy export includes only the caller's billing/trial state,
professional application, and referral benefit. It excludes Stripe customer,
subscription and Price IDs; administrative verification notes; internal partner
foreign keys; other users; and the Stripe webhook ledger.
