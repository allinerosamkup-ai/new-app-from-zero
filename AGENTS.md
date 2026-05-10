# AGENTS — Airia Global

## Identidade Operacional
Airia não é planner genérico, chatbot terapêutico nem tracker menstrual. É uma assistente pessoal de ciclagem de humor, energia e agenda adaptativa.

Alline é a pessoa das ideias. O agente técnico transforma ideias em produto, com tomada de decisão pragmática e cuidado para não quebrar mudanças recentes.

## Prioridades Técnicas
- Ler contexto e código antes de alterar.
- Preservar mudanças já feitas pela usuária ou por outros agentes.
- Preferir implementação pequena, testada e alinhada ao padrão existente.
- Não criar arquivos soltos. Documentação vai em `docs/`, planos em `docs/plans/`, contratos em `docs/product/`, instruções globais neste arquivo ou em `CLAUDE.md`.

## Regra Central de IA
Contexto antigo explica padrão; contexto de hoje decide ação.

Toda sugestão operacional da Airia deve estar ancorada em dado real atual:
- agenda pendente;
- hábito devido;
- meta ativa;
- subtarefa pendente;
- ação explicitamente aceita pela usuária.

Memória RAG não autoriza inventar tarefa. Itens concluídos, excluídos, rejeitados ou agendados entram como bloqueio, não como sugestão nova.

## Superfícies da Airia
- **Home:** visão do dia, ciclo, agenda curta, card “Análise e Autonomia”.
- **Planner:** timeline editável e futura superfície principal de adaptação da agenda.
- **Check-in:** leitura do estado atual; sugestões precisam respeitar horário local e o que já foi feito.
- **Check-in/Diário/Aura:** devem renderizar protocolo de segurança quando `riskSafety.route` exigir apoio humano ou crise.
- **Diário:** superfície reflexiva, com resposta natural e leitura de padrão.
- **Aura Chat:** superfície operacional e estratégica; quando vem do Planner/meta, deve explicar a ação e oferecer ideias práticas.
- **Insights:** leitura longitudinal, sem virar gerador de tarefas soltas.

## Backend Atual
- Contexto diário central: `apps/backend/src/services/context-grounding.service.ts`.
- Feedback de ações IA: `apps/backend/src/services/ai-action-feedback.service.ts`.
- Preview de adaptação: `apps/backend/src/services/agenda-adaptation.service.ts`.
- Prompt Aura: `apps/backend/src/lib/aura-prompt.ts`.
- Segurança mínima IA: `apps/backend/src/lib/risk-safety.ts`.
- Evento de segurança: `risk_protocol_triggered`.

## Regra de Produto Consumidor
O app não deve ter modo demo, seed de demo, copy de investidor, pitch, “produto vendável”, “carregar demo” ou explicações comerciais internas. A interface final é sempre para a usuária usar.

## Revisão de PR
Antes de aprovar ou finalizar mudanças, aplicar `docs/product/pr-review-skill-roadmap.md`. Essa checklist é obrigatória porque PRs recentes mostraram regressões em produto final vs. demo, grounding de IA, sync backend/frontend, timezone de planner e higiene de release.

## Checklist Antes de Finalizar
- Rodar testes relevantes.
- Rodar build do app alterado.
- Se subir produção, confirmar commit, push, deploy e healthcheck.
- Registrar mudanças importantes na documentação.
