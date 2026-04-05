# Mood Cycling — Backend API

## Stack
- Node.js + Express
- TypeScript
- Prisma ORM
- OpenAI SDK (GPT-4o-mini)
- Supabase Auth (JWT)

## Core Functions
### `buildAuraSystemPrompt({ userName?, profileSummary?, moodCycleContext?, domain?, extraInstructions? })`
Arquivo: `src/lib/aura-prompt.ts`
Gera o prompt de sistema unificado para a Aura. O `domain` define a policy da superfície (`journal-live`, `journal-finalize`, `aura-command`, `checkin`, `planning`, `home`, `insight`, `summary`, etc.) e o `moodCycleContext` deve ser injetado quando houver contexto de fase.

### `AIService.streamJournalReply({ context, history, message, onDelta })`
Arquivo: `src/services/ai.service.ts`
Gerencia a resposta em tempo real do diário usando Server-Sent Events (SSE). O `context` agora inclui `moodCycleContext`.

## Endpoints Principais
- `POST /api/checkins`: Salva check-in e avalia estado via IA. Agora persiste campos de ciclo menstrual.
- `POST /api/ai/suggest`: Endpoint genérico para sugestões IA (notas, checklist, tarefas do dia).
- `POST /api/journal/message/stream`: Endpoint SSE para chat do diário.

## Regras de Banco (Prisma)
- Schema: `packages/database/prisma/schema.prisma`
- Model `DailyCheckin`: Centraliza dados de humor, energia e ciclo biológico.
- Todas as queries devem filtrar por `userId` (extraído do token JWT).
