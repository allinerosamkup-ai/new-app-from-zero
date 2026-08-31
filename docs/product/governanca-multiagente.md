# Governança multiagente — overlay operacional

**Status:** padrão do repositório na branch `docs/ticket-000-governanca-repo`. Vale para todo agente após o merge. Até o merge, Claude/Cursor só veem se trabalharem nesta branch.
**Não substitui** [`PRODUCT_CONSTITUTION.md`](./PRODUCT_CONSTITUTION.md).
**Ler com:** `AGENTS.md`, [`../DEVELOPMENT_ITERATION_PROTOCOL.md`](../DEVELOPMENT_ITERATION_PROTOCOL.md), `skills/airia-governanca/SKILL.md`.

## Regra-mãe

Cada mudança deve deixar a pessoa mais capaz de perceber seu estado, escolher o próximo passo e entender o motivo da proposta. Um agente pode otimizar sua página; somente o sistema pode aprovar uma mudança que afeta a jornada inteira.

## Duas constituições, um produto

| Documento | Decide |
|---|---|
| `PRODUCT_CONSTITUTION.md` | O que a Airia é, como infere/propõe/confirma, o que é PRODUCT FAIL |
| Este overlay + `skills/airia-governanca` | Quem pode propor, quem verifica, quando parar, o que viaja no ticket |
| `DEVELOPMENT_ITERATION_PROTOCOL.md` | Ciclo técnico já em uso no repo |

Em conflito de comportamento, vence `PRODUCT_CONSTITUTION.md` e a decisão mais recente da titular. Em conflito de publicação, vence autorização humana + CI + nota ≥ 8.

## Núcleo ativo e rotas

`/comecar` · `/checkin` · `/home` · `/goals` · `/insights` · `/journal` · `/aura` · `/preferences`

Desligado na experiência operacional: Planner, Hábitos, Pomodoro, Google Agenda. Código residual não é requisito. Não sugerir, notificar, rotear nem promptar esses módulos.

## Papéis

Quem produz não verifica a própria entrega.

| Papel | Faz | Não faz |
|---|---|---|
| Titular | Intenção, produto, dados sensíveis, publicação | Operar microtarefa |
| Coordenador geral | Ticket, escopo, bloqueio de incoerência | Autorizar deploy; reescrever célula por gosto |
| Célula (funcional + UI/UX) | Superfície no ticket | Nota de si mesma |
| Verificador | Rubrica, bloqueios, dois “impressionado” | Autoria da mudança |
| Simulador humano | Jornada percebida | Aprovar só porque o botão existe |
| Especialista | Regra transversal | Substituir a célula dona |
| Integrador | Montar versão aprovada | Inventar feature |
| Verificador global | Produto inteiro | Aceitar páginas ótimas com jornada quebrada |

## Ciclo mínimo

1. Pedido da titular sem solução presumida
2. Ticket (`docs/quality/templates/ticket.md`)
3. Branch isolada por ticket
4. Testes do ticket + regressão
5. Simulador humano quando a superfície for usada por pessoa
6. Parecer independente (`docs/quality/templates/parecer.md`)
7. Coordenador confirma jornada e núcleo
8. Commit / PR / deploy só com autorização registrada

## Publicação

Não mergear `master`, não alterar banco remoto, não trocar segredo, não disparar “Deploy VPS” sem ticket de release e autorização da titular neste turno.

Repo: `allinerosamkup-ai/new-app-from-zero`. Workflow de produção: `.github/workflows/deploy.yml`.
