# Journal Streaming Design

**Goal:** Implementar o fluxo real de diário com sessão persistida, streaming de resposta e memória de rotina, preservando a store Expo já existente e o contrato Supabase/Prisma atual.

**Current Context**

- O mobile já tem tela e store de diário em `apps/mobile/src/presentation/screens/JournalChatScreen.tsx` e `apps/mobile/src/presentation/providers/journal_store.ts`.
- O backend já tem `POST /api/journal/finalize` e persistência em `journal_sessions` e `journal_messages`.
- O fluxo principal ainda está incompleto: `startSession()` gera id temporário local e `sendMessage()` simula a IA.
- O schema já possui dados úteis para aprendizado de rotina: `onboarding_responses.routine_summary`, `user_preferences`, `daily_checkins`, `journal_sessions`, `journal_messages` e `timeline_blocks`.

## Approach

Usar o backend Express atual como orquestrador do diário. O mobile Expo continuará usando Zustand, mas trocará os placeholders por chamadas reais ao backend. O histórico e a memória de rotina serão construídos a partir das tabelas existentes, sem criar uma memória paralela opaca.

## API Design

### `POST /api/journal/start`

Responsabilidade:
- criar uma nova sessão ativa do dia quando não houver sessão ativa;
- ou recuperar a sessão ativa mais recente do usuário;
- retornar contexto inicial para a UI.

Resposta:
- `sessionId`
- `messages`
- `context.checkinToday`
- `context.routine`

### `POST /api/journal/message/stream`

Responsabilidade:
- receber `sessionId` e `message`;
- salvar a mensagem do usuário;
- carregar as últimas mensagens da sessão;
- montar contexto com check-in, rotina e sinais recentes do planner;
- chamar OpenAI com streaming;
- transmitir chunks para o app;
- ao final, salvar a resposta completa da IA em `journal_messages`.

Transporte:
- usar SSE a partir do backend Express.
- o payload terá eventos suficientes para a UI:
  - `session.started`
  - `assistant.delta`
  - `assistant.completed`
  - `error`

### `POST /api/journal/finalize`

Permanece ativo. O endpoint continuará gerando resumo, emoções, temas e sugestões, e atualizará `journal_sessions`.

## Routine Learning

O app deve aprender a rotina pela combinação de dados já existentes, não por uma memória paralela.

Fontes de contexto:
- `onboarding_responses.routine_summary`
- `user_preferences` (`wake_time`, `sleep_time`, horários preferidos)
- últimos check-ins do dia e da semana
- sessões finalizadas do diário
- blocos recentes do planner

Uso:
- esse contexto entra no prompt do diário para deixar a resposta mais situada;
- o backend pode derivar um resumo curto de rotina e reutilizá-lo em novas sessões;
- o histórico bruto continua sendo a fonte de verdade.

Regra de produto:
- a IA pode inferir padrões suaves de rotina, mas não pode afirmar certezas não suportadas pelos dados.
- a IA deve usar isso para acolhimento e para recomendações de organização, não para diagnóstico.

## Mobile Design

Arquivos oficiais a preservar:
- `apps/mobile/src/presentation/providers/journal_store.ts`
- `apps/mobile/src/presentation/screens/JournalChatScreen.tsx`
- `apps/mobile/src/services/ai_service.ts`

Mudanças:
- `startSession()` deixa de gerar `temp-session-*` e passa a usar o backend;
- `sendMessage()` deixa de simular `setTimeout` e passa a consumir stream;
- a store cria uma mensagem da IA vazia e vai anexando os chunks;
- `finalizeSession()` continua usando o endpoint real já existente.

## Backend Design

Serviços:
- extrair a lógica do diário para um serviço próprio, em vez de manter tudo em `index.ts`;
- manter `AIService` responsável pela chamada à OpenAI, mas separar a montagem do contexto e a persistência da sessão.

Persistência:
- `journal_sessions` continua sendo o container da sessão;
- `journal_messages` continua sendo a persistência de cada mensagem individual;
- `order_index` define a ordem exata do transcript.

## Error Handling

- se a stream falhar antes de qualquer chunk, a UI mostra erro e não cria mensagem fantasma da IA;
- se a stream falhar no meio, a UI marca erro e o backend não persiste resposta parcial como final;
- se `sessionId` for inválido, retornar `404`;
- se não houver contexto disponível, o fluxo continua com histórico mínimo.

## Testing

- validar contratos dos novos endpoints com testes pequenos de schema;
- testar montagem de contexto de rotina;
- testar persistência ordenada de mensagens;
- testar que a resposta final do streaming é salva corretamente;
- no mobile, testar a store para `startSession`, `sendMessage` e atualização incremental da mensagem da IA.

## Recommendation

Implementar primeiro o fluxo real com streaming sem otimizações avançadas. Não incluir ainda cancelamento de stream, reconexão automática ou streaming de áudio. O objetivo é estabilizar o contrato e manter paridade entre backend, mobile e banco.
