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
- **A Airia decide e preenche.** Quando a fala contém um item — compromisso marcado, prazo, algo que pediram à usuária, intenção de retomar algo — ela entrega o item montado: título, data, hora e duração já resolvidos. Devolver a lacuna como pergunta para quem já contou o que precisa fazer é transferir esforço para quem está sem combustível.
- Âncora de uma sugestão pode ser agenda pendente, hábito devido, meta ativa, ação aceita **ou o que a usuária acabou de contar**. O que não vale é sugestão tirada do relógio ("um café às 9h") — isso é enchimento, não ajuda.
- O que a Airia não inventa: o título do item. Sem saber o que é a coisa, ela faz uma pergunta curta — só essa.
- Memória RAG serve para explicar padrão, compreender o usuario,seus compromiisos, suas questoes emocinais, tudo que o usuario compartilhar com o app
- Feedback de ações fica em `AiActionFeedbackService` e bloqueia repetição de ações feitas, excluídas, rejeitadas, puladas ou agendadas.
- O Decision Brain separa `real_commitment`, `suggested_commitment`, `insight_only`, `blocked` e autorização de notificação.
- Sugestão de compromisso entra no dia sozinha, com desfazer e ajustar à mão. **Criar não é o mesmo que notificar:** gravar um bloco é barato, tocar o celular não é — `notificationAllowed` continua sendo decisão separada.
- Continuam exigindo aval humano: âncora protegida (consulta, compromisso com terceiro, evento importado do Google) e qualquer ação destrutiva. Pedido de escuta, negação explícita e instrução citada de documento continuam bloqueando criação.
- `AgendaAdaptationService` aplica sozinho o que não exige aval humano. Chamado sem `selectedDecisionIds`, aplica tudo que é elegível; lista vazia explícita significa não aplicar nada.
- Adiamento de bloco no Planner registra `timeline.block_postponed`, conta recorrência por bloco e entra no grounding como `postponedActions`.

## Execução e Progresso
- Motor de execução passo a passo em `apps/backend/src/services/routine-run.service.ts`: um passo por vez, prévia de uma linha do próximo, pausa que preserva tempo corrido, abandono após 15 min sem toque preservando o que já foi feito.
- Duração real por passo alimenta a calibração de cegueira temporal. O ajuste é do app, nunca da pessoa: a mensagem é "já ajustei", não "você demora".
- Decomposição automática em `task-decomposition.service.ts`: verbo que descreve resultado ou duração acima de 30 min quebram o item em 2 a 5 passos de 5 a 15 min, cada um com o primeiro movimento físico.
- Progresso em `progress-rewards.service.ts`. **Gamificação incentiva, não cobra** — são coisas diferentes:
  - recompensa por aparecer, nunca punição por faltar;
  - fase de Recolhimento e Pausa não quebra sequência, ela atravessa o dia ruim;
  - ausência sem fase protegida não gera mensagem nenhuma;
  - rotina largada no meio também paga, porque começar é a parte cara;
  - celebração fala do que aconteceu e nunca do que faltou.

## Status do Design System — Aura Editorial Clean
- Fundo base: branco/off-white, com uso de cor apenas como acento.
- Visual dominante: cards claros, sombras suaves, bordas discretas, layout respirado.
- Acentos ativos: salmão rosado pastel, verde sálvia claro, azul suave, lilás leve, pêssego aberto.
- Evitar qualquer retorno para o visual antigo de massa cromática, headers pesados ou mockups legados.

## Atualizações Recentes
- **2026-07-26:** Virada de captura: a Airia passou a montar tarefa, compromisso, hábito e meta a partir do contexto contado, com agendamento automático, decomposição automática de tarefa vaga, motor de execução passo a passo e progresso que incentiva sem cobrar.
- **2026-05-10:** Guardrails reais de produto ampliados: bloqueio de copy de venda/demo no app, fluxo falso, alegação clínica perigosa, `setHours()` em serviços de agenda, contrato único de `riskSafety` e checklist de release integrado.
- **2026-05-10:** Skill local `skills/airia-pr-review/SKILL.md` criada para tornar obrigatoria a revisao Airia baseada em evidencias antes de finalizar PRs/features/deploys.
- **2026-05-10:** Guardrails de revisão adicionados: `product-guardrails.test.ts`, ampliação de `risk-safety.test.ts` e checklist em `docs/product/pr-review-skill-roadmap.md`.
- **2026-05-10:** Modo/seed de demo removidos do produto. Ficam apenas fluxos reais de consumidor, protocolo de segurança em Check-in/Diário/Aura e `risk_protocol_triggered`.
- **2026-05-09:** Robustez de produto adicionada: `riskSafety` em check-in/diário/Aura, eventos de agenda adaptativa e roteiro de ligação em `docs/product/airia-investor-call-script.md`.
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
