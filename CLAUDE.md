# Airia — Monorepo

## IDENTIDADE DO APP (CRÍTICO)
**Não é:** planner genérico, tracker menstrual, chatbot terapêutico.
**É:** assistente pessoal de ciclagem de humor, energia e agenda adaptativa.
- **Ciclo primário:** ciclo de humor/energia (EWMA + desvio padrão + tendência de 7 dias).
- **Ciclo secundário:** ciclo menstrual como modulador biológico, não como identidade principal.
- **Público-alvo:** pessoas com TDAH, ciclotimia, transtorno depressivo, bipolar tipo II e variações hormonais/cíclicas.
- **Princípio operacional:** contexto antigo explica padrão; contexto de hoje decide ação.

## Módulo Core — MoodCycleEngine
Localizado em `apps/web/src/utils/mood-cycle-engine.ts`.
Calcula algoritmicamente a fase atual:
- `Voo Alto`
- `Fluindo`
- `Estável`
- `Desacelerando`
- `Recolhimento`
- `Pausa`
- `Retomada`
- `Turbulência`

Essas 8 fases são a nomenclatura visível oficial. Estados de check-in como “Dia Sensível”, “Em equilíbrio” ou “Cansada” podem existir, mas não substituem a fase do ciclo.

## Estrutura do Monorepo
```
apps/
  web/          → Frontend React + Vite + TypeScript
  backend/      → API Node.js + Express + Prisma
  mobile/       → React Native + Expo (pausado)
packages/
  database/     → Schema Prisma compartilhado
```

## Stack Travada
| Camada | Tecnologia |
|--------|-----------|
| Web frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| Estado global | Zustand (stores em `apps/web/src/features/aura/`) |
| Backend API | Node.js + Express + TypeScript |
| ORM | Prisma (schema em `packages/database/prisma/schema.prisma`) |
| Banco | Supabase (PostgreSQL + Auth) |
| IA | OpenAI GPT-4o-mini |

## IA Persona — Aura (v2.4)
- Função: `buildAuraSystemPrompt(...)` em `apps/backend/src/lib/aura-prompt.ts`.
- A identidade Aura é compartilhada; cada superfície tem política própria (`journal-live`, `journal-finalize`, `aura-command`, `checkin`, `planning`, `home`, `insight`, `summary`).
- A linguagem deve ser natural, próxima, firme e específica. Evitar resposta de suporte, pergunta prematura e sugestão genérica.
- Metodologia interna: Aliança Divergente, TCC prática, exposição gradual, leitura de padrão, manobra concreta e autonomia.

## Contexto Diário e Agenda Adaptativa
- Fonte central: `apps/backend/src/services/context-grounding.service.ts`.
- `DailyContext` reúne agenda pendente/feita, hábitos pendentes/feitos, metas ativas/concluídas, subtarefas feitas, sugestões recentes, feedback de ações e memória RAG relevante.
- Cérebro operacional: `apps/backend/src/services/decision-engine.service.ts`.
- Agenda adaptativa: `apps/backend/src/services/adaptive-agenda-engine.service.ts`, exposta por `AgendaAdaptationService`.
- Toda sugestão operacional precisa ter âncora em algo real de hoje: agenda pendente, hábito devido, meta ativa ou ação explicitamente aceita.
- Memória RAG serve para explicar padrão, não para inventar tarefa.
- Feedback de ações fica em `AiActionFeedbackService` e bloqueia repetição de ações feitas, excluídas, rejeitadas, puladas ou agendadas.
- O Decision Brain separa `real_commitment`, `suggested_commitment`, `insight_only`, `blocked` e autorização de notificação.
- Sugestão de compromisso pode existir com horário/bloco sugerido, mas só vira compromisso real depois de confirmação. Sugestão não confirmada não notifica.
- Preview de adaptação da agenda fica em `AgendaAdaptationService`; ele não aplica mudança estrutural sozinho.
- Adiamento de bloco no Planner registra `timeline.block_postponed`, conta recorrência por bloco e entra no grounding como `postponedActions`.

## Status do Design System — Aura Editorial Clean
- Fundo base: branco/off-white, com uso de cor apenas como acento.
- Visual dominante: cards claros, sombras suaves, bordas discretas, layout respirado.
- Acentos ativos: salmão rosado pastel, verde sálvia claro, azul suave, lilás leve, pêssego aberto.
- Evitar qualquer retorno para o visual antigo de massa cromática, headers pesados ou mockups legados.

## Atualizações Recentes
- **2026-05-10:** Robustez pendente fechada: `VITE_AIRIA_DEMO_MODE`, card compartilhado de protocolo de segurança em Check-in/Diário/Aura, `risk_protocol_triggered` e superfície comercial interna na Home.
- **2026-05-09:** Robustez de demo/investimento adicionada: `/api/demo/seed`, `riskSafety` em check-in/diário/Aura, eventos de agenda adaptativa e roteiro de ligação em `docs/product/airia-investor-call-script.md`.
- **2026-04-30:** Airia Decision Brain + AdaptiveAgendaEngine adicionados ao backend para classificar ações reais, sugestões opcionais, insights, bloqueios e permissão de notificação.
- **2026-04-30:** Planner ganhou ação “Adiar” para mover bloco ao dia seguinte e registrar padrão de adiamento para análise.
- **2026-04-30:** `DailyContext`, `/api/context/day`, `/api/agenda/adapt` e `/api/ai/action-feedback` publicados em produção no commit `7c44742`.
- **2026-04-30:** Home registra feedback do card “Análise e Autonomia” no backend para impedir repetição entre sessões.
- **2026-04-29:** fases visíveis alinhadas para as 8 fases oficiais.
- **2026-04-29:** PWA Android destravado com scroll vertical natural e bloqueio lateral restrito ao necessário.

## Como rodar
```bash
# Backend (porta 3001)
cd apps/backend && npm run dev

# Frontend (porta 5173)
cd apps/web && npm run dev
```
