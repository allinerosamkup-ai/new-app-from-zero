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
  "operationalRule": "Contexto antigo explica padrão; ação do dia precisa de âncora operacional atual."
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

Returns an adaptation preview for the day. V1 does not silently move tasks; it proposes changes with reason and confidence.

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
  "context": {
    "phase": "Turbulência"
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
      "type": "pause",
      "title": "Responder cliente",
      "from": "11:00",
      "to": null,
      "reason": "Compromisso real pesado em fase de baixa capacidade; melhor pausar ou revisar escopo.",
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
