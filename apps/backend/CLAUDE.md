# Mood Cycling — Backend API

## Stack
- Node.js + Express
- TypeScript
- Prisma ORM
- OpenAI SDK (GPT-4o-mini)
- Supabase Auth (JWT)

## Core Functions
### `buildAuraSystemPrompt(userName, profileSummary?, moodCycleContext?)`
Arquivo: `src/index.ts`
Gera o prompt de sistema unificado para a Aura. O `moodCycleContext` deve ser injetado para que a IA saiba em qual fase do ciclo de humor o usuário se encontra.

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
