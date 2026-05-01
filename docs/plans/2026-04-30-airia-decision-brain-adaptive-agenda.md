# Airia Decision Brain + Agenda Adaptativa

Data: 2026-04-30
Status: Implementado no backend, sem aplicar mudanças automáticas na agenda.

## Objetivo

Unificar o raciocínio operacional da Airia em uma camada central antes de qualquer sugestão. A IA continua responsável pela interpretação e linguagem, mas o sistema passa a decidir com segurança o que é real, opcional, apenas insight, bloqueado ou notificável.

## Arquitetura

### Truth Layer

Entrada principal: `DailyContext`, montado por `ContextGroundingService`.

Inclui agenda pendente/concluída, hábitos pendentes/concluídos, metas ativas/concluídas, subtarefas feitas, sugestões recentes, feedback da usuária, horário local e memórias relevantes.

### Decision Brain

Arquivo: `apps/backend/src/services/decision-engine.service.ts`

Classifica candidatos como:

- `real_commitment`: compromisso real, hábito real ou tarefa salva.
- `suggested_commitment`: sugestão opcional, ainda não confirmada.
- `insight_only`: leitura de padrão sem ação operacional.
- `blocked`: item feito, rejeitado, repetido, vencido, genérico ou sem base.

Também define:

- `notificationAllowed`
- `requiresConfirmation`
- `action`: `keep`, `move`, `shrink`, `pause`, `suggest`, `convert`, `notify`, `block`, `insight`

### Adaptive Agenda Engine

Arquivo: `apps/backend/src/services/adaptive-agenda-engine.service.ts`

Transforma o resultado do Decision Brain em preview de agenda. Não aplica mudança estrutural sozinho.

Decisões possíveis:

- `keep`
- `move`
- `shrink`
- `pause`
- `suggest`
- `convert`
- `notify`
- `block`

### Wrapper de API

Arquivo: `apps/backend/src/services/agenda-adaptation.service.ts`

Expõe o preview para `POST /api/agenda/adapt` e inclui decisões bloqueadas para auditoria e UI.

## Regras Críticas

- Agenda vazia pode gerar sugestão opcional de bloco.
- Sugestão opcional não vira compromisso sem confirmação.
- Sugestão opcional não pode notificar.
- Compromisso real pode notificar se não estiver vencido e não estiver bloqueado.
- Item concluído, hábito feito, meta feita, sugestão rejeitada ou sugestão recente entra como bloqueio.
- Memória RAG explica padrão, mas não vira tarefa sem âncora operacional atual.

## Superfícies Afetadas

- `/api/context/day` passa a devolver `decisionBrain` e `adaptiveAgenda`.
- `/api/agenda/adapt` passa a usar `AdaptiveAgendaEngine`.
- `/api/ai/suggest` recebe o Decision Brain dentro do grounding para reduzir sugestão solta.

## Testes

- `decision-engine.service.test.ts`
- `adaptive-agenda-engine.service.test.ts`
- `agenda-adaptation.service.test.ts`

Casos cobertos:

- agenda vazia com meta ativa gera sugestão opcional sem notificação;
- agenda vazia sem âncora vira insight;
- fase baixa pode pausar tarefa pesada;
- treino/concluídos/rejeitados/recentes aparecem como bloqueios;
- preview nunca aplica mudança automaticamente.
