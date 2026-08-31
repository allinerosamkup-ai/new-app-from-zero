# AGENTS — Airia Global

## Identidade Operacional
Airia não é planner genérico, chatbot terapêutico nem tracker menstrual. É uma assistente pessoal de ciclagem de humor, energia e agenda adaptativa.

Alline é a pessoa das ideias. O agente técnico transforma ideias em produto, com tomada de decisão pragmática e cuidado para não quebrar mudanças recentes.

## Governança multiagente (obrigatória)

Vale para **qualquer agente** neste repositório (Claude, Grok, Cursor, Replit), em cada turno, sem a titular solicitar.

1. Carregar `skills/airia-governanca/SKILL.md` antes de planejar, alterar, revisar, pontuar, commitar ou falar em deploy.
2. Comportamento do produto continua em [`docs/product/PRODUCT_CONSTITUTION.md`](docs/product/PRODUCT_CONSTITUTION.md). Esta seção e a skill **não** criam segunda constituição.
3. Pedido vago não vira código. Ticket em [`docs/quality/templates/ticket.md`](docs/quality/templates/ticket.md).
4. Quem produz não verifica a própria entrega. Rubrica em [`docs/quality/rubrica-8.md`](docs/quality/rubrica-8.md).
5. Superfície cotidiana exige simulador humano mínimo ([`docs/quality/cenarios-humanos.md`](docs/quality/cenarios-humanos.md)).
6. Merge em `master` e Deploy VPS exigem autorização humana explícita + CI + nota ≥ 8. Overlay: [`docs/product/governanca-multiagente.md`](docs/product/governanca-multiagente.md).

Núcleo ativo: `/comecar`, `/checkin`, `/home`, `/goals`, `/insights`, `/journal`, `/aura`, `/preferences`. Planner, Hábitos, Pomodoro e Agenda não voltam por rota, prompt, notificação ou copy.

## Prioridades Técnicas
- Ler contexto e código antes de alterar.
- Preservar mudanças já feitas pela usuária ou por outros agentes.
- Preferir implementação pequena, testada e alinhada ao padrão existente.
- Não criar arquivos soltos. Documentação vai em `docs/`, planos em `docs/plans/`, contratos em `docs/product/`, instruções globais neste arquivo ou em `CLAUDE.md`.

## Protocolo compartilhado de desenvolvimento

Antes de trabalho relevante, consultar [`docs/DEVELOPMENT_ITERATION_PROTOCOL.md`](docs/DEVELOPMENT_ITERATION_PROTOCOL.md) e ler somente a memória relevante em `docs/agent-memory/`.

Quando a tarefa afetar produto, UX, IA, fluxo ou arquitetura da Airia, consultar
também [`docs/product/PRODUCT_CONSTITUTION.md`](docs/product/PRODUCT_CONSTITUTION.md).
Ela é a fonte canônica do comportamento do produto: a Airia deve interpretar
os sinais, propor uma ação concreta e preservar confirmação, correção e veto da
usuária. Não aceitar como solução uma interface que devolva para a usuária uma
decisão que a Airia já poderia tomar. Contratos técnicos, prompts e memória
explicam a implementação; não podem criar uma segunda constituição.

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

O verificador, o verificador de integração e o meta-verificador devem registrar
nota objetiva de `0–10`. A barra de aprovação é o resultado extraordinário: só
libera quem olha a entrega e se impressiona, nunca quem apenas confirma que ela
atende ao pedido. `8/10` e ausência de falha crítica são o mínimo necessário,
jamais o suficiente — nota alta em entrega morna é `FAIL` e recalibração.
“Impressionante” não é opinião solta: quem aprova declara o que tornou a entrega
extraordinária, contra quais critérios e com qual evidência.
Antes de escrever código novo, a busca por soluções existentes deve ser
registrada com fontes consultadas, candidatos, escolha/adaptação ou rejeição e
motivo. Sem essa evidência, a tarefa não está pronta para aprovação.

Commit e worktree são gates separados. Antes de criar ou entrar em um worktree,
consultar `git worktree list --porcelain` e `docs/agent-memory/WORKTREES.md`;
reutilizar trabalho existente, registrar dono/branch/caminho e deixar handoff
quando houver troca de agente. Antes de finalizar, toda alteração deve estar
commitada, removida conscientemente ou documentada como `BLOQUEADO`; nenhum
arquivo, branch ou worktree pode ficar sem destino. O ciclo completo está em
§22 de `docs/DEVELOPMENT_ITERATION_PROTOCOL.md`.

## Regra Central de IA
Contexto antigo explica padrão; contexto de hoje decide ação. Padrões verificados
também são fontes legítimas para priorizar, reduzir, dividir, proteger ou
adiar uma Ação, desde que tenham relação atual, destino em Objetivo/intenção,
capacidade e segurança compatíveis, e referência persistida às evidências.

Toda sugestão operacional da Airia deve estar ancorada em dado real atual:
- Objetivo ativo;
- Ação pendente;
- intenção ou relato atual com resultado concreto;
- padrão verificado que altere de forma explicável uma decisão já ancorada.

Memória RAG não grava Ação diretamente. Itens concluídos, excluídos, rejeitados
ou adiados entram como bloqueio, não como sugestão nova.

## Superfícies da Airia
- **Home:** visão do dia, estado, padrões relevantes, Objetivos e Ações.
- **Planner:** superfície preservada/desligada; se reativada, deverá consumir o
  mesmo contrato global de estado, padrões e Ações.
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

O fluxo integrado obrigatório é:
`sinais → estado atual → padrões verificados → capacidade/segurança →
Objetivo/Ação → devolução → confirmação/correção → persistência`. Alterar um
produtor sem revisar seus consumidores, a devolução e o feedback é
`INTEGRATION_PENDING`, não conclusão.

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
