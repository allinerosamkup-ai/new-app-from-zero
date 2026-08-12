# AGENTS — Airia Global

## Identidade Operacional
Airia não é planner genérico, chatbot terapêutico nem tracker menstrual. É uma assistente pessoal de ciclagem de humor, energia e agenda adaptativa.

Alline é a pessoa das ideias. O agente técnico transforma ideias em produto, com tomada de decisão pragmática e cuidado para não quebrar mudanças recentes.

## Prioridades Técnicas
- Ler contexto e código antes de alterar.
- Preservar mudanças já feitas pela usuária ou por outros agentes.
- Preferir implementação pequena, testada e alinhada ao padrão existente.
- Não criar arquivos soltos. Documentação vai em `docs/`, planos em `docs/plans/`, contratos em `docs/product/`, instruções globais neste arquivo ou em `CLAUDE.md`.

## Protocolo compartilhado de desenvolvimento

Antes de trabalho relevante, consultar [`docs/DEVELOPMENT_ITERATION_PROTOCOL.md`](docs/DEVELOPMENT_ITERATION_PROTOCOL.md) e ler somente a memória relevante em `docs/agent-memory/`.

Alterar arquivos não significa concluir. Toda tarefa deve passar por critérios de aceite, execução, verificação, diagnóstico, correção, reverificação e regressão proporcional ao risco. Antes de finalizar, registrar evidência real; se houver bloqueio, declarar `BLOQUEADO`, nunca `DONE`.

Durante tarefas longas, atualizar `docs/agent-memory/CURRENT_STATE.md`. Registrar descobertas reutilizáveis em `LEARNINGS.md`, corrigir memória desatualizada e não repetir abordagens já reprovadas sem nova evidência.

Antes de escrever código novo, procurar primeiro no repositório, nas worktrees e
branches, no histórico Git, nas dependências e nos padrões já usados. Depois,
quando necessário e autorizado, procurar documentação oficial, GitHub/code
search, registries, bibliotecas, templates, conectores e catálogos de
aplicativos. Preferir adaptar solução existente; verificar licença, segurança,
compatibilidade e manutenção antes de copiar qualquer coisa. Ver
`SEARCH / REUSE BEFORE INVENT` no protocolo.

Toda tarefa deve ser coordenada por subagentes em papéis separados:
`COORDENADOR → EXECUTOR → VERIFICADOR → VERIFICADOR DE INTEGRAÇÃO →
META-VERIFICADOR → DONE`. O executor não aprova o próprio trabalho. Quando
houver fatias independentes, usar comunicação horizontal entre executores;
entregas, reprovações e aprovações seguem comunicação vertical entre os LLMs.
Toda mensagem entre LLMs precisa carregar contexto, evidência, decisão e próxima
ação em handoff persistente; não depender apenas do chat. Worktree físico
por papel só existe quando necessário; os papéis não autorizam criar cópias sem
destino. O meta-verificador é o único que autoriza `DONE`. Ver §§8.9 e 14 do
protocolo.

Commit e worktree são gates separados. Antes de criar ou entrar em um worktree,
consultar `git worktree list --porcelain` e `docs/agent-memory/WORKTREES.md`;
reutilizar trabalho existente, registrar dono/branch/caminho e deixar handoff
quando houver troca de agente. Antes de finalizar, toda alteração deve estar
commitada, removida conscientemente ou documentada como `BLOQUEADO`; nenhum
arquivo, branch ou worktree pode ficar sem destino. O ciclo completo está em
§22 de `docs/DEVELOPMENT_ITERATION_PROTOCOL.md`.

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

`apps/web/src` e `apps/backend/src` são território de produto final. Copy de venda, narrativa de investimento, prova comercial, lista de espera e material de demonstração ficam em documentação, landing externa ou apresentação, nunca no fluxo consumidor.

Toda UI nova precisa ter fluxo real antes de polimento: entrada da usuária, chamada real, persistência confirmada, erro visível, retorno útil e próxima ação. Botão sem ação real, usuário temporário, sucesso simulado ou placeholder de implementação não entra.

## Revisão de PR
Antes de aprovar ou finalizar mudanças, aplicar `docs/product/pr-review-skill-roadmap.md`. Essa checklist é obrigatória porque PRs recentes mostraram regressões em produto final vs. demo, grounding de IA, sync backend/frontend, timezone de planner e higiene de release.

Quando a tarefa envolver PR, revisão, fechamento de feature, publicação ou deploy, usar também a skill local `skills/airia-pr-review/SKILL.md`.

## Checklist Antes de Finalizar
- Rodar testes relevantes.
- Rodar build do app alterado.
- Se subir produção, confirmar commit, push, deploy, mesmo SHA no VPS/GitHub e healthcheck `/api/health` + `/home`.
- Registrar mudanças importantes na documentação.
