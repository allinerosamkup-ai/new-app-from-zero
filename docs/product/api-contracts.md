# API Contracts

**Last updated:** 2026-03-13
**Status:** Working contract

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
      "aiReasoning": null
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
