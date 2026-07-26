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

**Método interno de raciocínio:**
`airia-method.ts` contém uma lente interna de análise, direção e ação. Ela orienta a resposta, mas nunca vira cabeçalho, sigla, nomenclatura ou explicação do método para a usuária. A Airia entrega análise pronta, direcionamento concreto e, quando útil, uma provocação curta em linguagem natural.

### `ContextGroundingService.buildDailyContext(...)`
Arquivo: `src/services/context-grounding.service.ts`
Monta o pacote operacional único do dia (`DailyContext`): agenda pendente/concluída, hábitos pendentes/concluídos, metas ativas/concluídas, subtarefas feitas, sugestões recentes, feedback de ações e memória RAG como contexto de padrão.

Regra: memória antiga explica padrão; ação operacional precisa nascer de agenda, hábito, meta ou aceite real do dia.

### `AiActionFeedbackService`
Arquivo: `src/services/ai-action-feedback.service.ts`
Persiste no `aiProfilePayload` o histórico leve de ações sugeridas pela IA e marcadas como `shown`, `accepted`, `done`, `dismissed`, `deleted`, `scheduled` ou `rejected`. Status bloqueadores entram no grounding para não ressuscitar sugestões.

### `DecisionEngine`
Arquivo: `src/services/decision-engine.service.ts`
Cérebro operacional da Airia. Recebe `DailyContext` e a superfície (`home`, `planner`, `checkin`, `journal`, `aura-chat`, `insights`, `notification`, `agenda`) e classifica candidatos como `real_commitment`, `suggested_commitment`, `insight_only` ou `blocked`.

Regras principais:
- compromisso real pode ser mantido, movido, reduzido, pausado ou notificado;
- sugestão opcional pode virar proposta de bloco, mas não salva nem notifica sem confirmação;
- memória antiga e RAG explicam padrão, mas não criam ação sozinhos;
- concluído, rejeitado, repetido, vencido, genérico ou sem âncora vira bloqueio.

### `AdaptiveAgendaEngine`
Arquivo: `src/services/adaptive-agenda-engine.service.ts`
Transforma o resultado do `DecisionEngine` em decisões de agenda: `keep`, `move`, `shrink`, `pause`, `suggest`, `convert`, `notify` ou `block`. Sempre retorna preview; `applied` permanece `false` na versão atual.

### `POST /api/timeline/:id/postpone`
Move um bloco do Planner para o dia seguinte mantendo horário e metadados. Registra `timeline.block_postponed` em `EventLog`, grava feedback `scheduled` e expõe adiamentos recentes em `DailyContext.postponedActions`.

### `AgendaAdaptationService`
Arquivo: `src/services/agenda-adaptation.service.ts`
Wrapper HTTP/serviço do `AdaptiveAgendaEngine`. A versão atual não move tarefas sozinha; retorna mudanças propostas com motivo, confiança, tipo de decisão, necessidade de confirmação e permissão de notificação.

### `AIService.streamJournalReply({ context, history, message, onDelta })`
Arquivo: `src/services/ai.service.ts`
Gerencia a resposta em tempo real do diário usando Server-Sent Events (SSE). O `context` agora inclui `moodCycleContext`.

## Endpoints Principais
- `POST /api/checkins`: Salva check-in e avalia estado via IA. Agora persiste campos de ciclo menstrual.
- `POST /api/ai/suggest`: Endpoint genérico para sugestões IA (notas, checklist, tarefas do dia).
- `GET /api/context/day?date=YYYY-MM-DD`: Retorna o `DailyContext` central do dia.
- `POST /api/agenda/adapt`: Retorna preview de adaptação da agenda com mudanças propostas.
- `POST /api/ai/action-feedback`: Registra feedback sobre ação sugerida pela IA.
- `POST /api/timeline/:id/postpone`: Adia bloco para o próximo dia e registra padrão de adiamento.
- `POST /api/journal/message/stream`: Endpoint SSE para chat do diário.
- `POST /api/routine-builder/sessions`: inicia uma montagem persistente. `mode: 'guided'` dispensa `focus`.
- `GET /api/routine-builder/library`: catálogo de opções do onboarding guiado (áreas, drenos, recuperadores, intenções, hábitos).
- `POST /api/routine-builder/sessions/:id/guided`: respostas de botão viram itens classificados sem IA e sem documento.
- `POST /api/routine-builder/sessions/:id/source`: lê texto ou arquivo e classifica a fonte.
- `PATCH /api/routine-builder/sessions/:id/items`: salva a revisão dos itens.
- `POST /api/routine-builder/sessions/:id/clarifications`: responde somente bloqueios operacionais.
- `POST /api/routine-builder/sessions/:id/compose`: cruza agenda, hábitos e check-in e produz a semana.
- `POST /api/routine-builder/sessions/:id/apply`: aplica metas, hábitos e blocos em uma transação idempotente.

Regras do fluxo:
- pedido simples para montar rotina abre o onboarding guiado por escolhas;
- texto ou documento é opcional e sempre passa por revisão;
- compromisso protegido mantém dia, horário e duração;
- tarefa flexível usa prioridade, prazo, capacidade e espaço real;
- hábito usa frequência, dias, janela e duração mínima/máxima; disponibilidade geral não cancela sua recorrência;
- hábito persistido é deduplicado por título normalizado antes de sugerir novo hábito;
- conflito retorna alternativas de mover, reduzir ou adiar, sem aplicar sozinho;
- lista operacional estruturada com caixas, objetivos e recorrências abre o montador mesmo sem comando literal;
- uma nova solicitação não pode ser substituída por sessão antiga salva no navegador;
- prévia antiga é recomposta automaticamente quando sua versão difere do motor atual.

## Regras de Banco (Prisma)
- Schema: `packages/database/prisma/schema.prisma`
- Model `DailyCheckin`: Centraliza dados de humor, energia e ciclo biológico.
- `EventLog`: registra eventos leves, incluindo feedback de ações IA quando disponível.
- `OnboardingResponse.aiProfilePayload`: guarda memória leve de sugestões recentes e feedback de ações sem nova migração.
- Todas as queries devem filtrar por `userId` (extraído do token JWT).
