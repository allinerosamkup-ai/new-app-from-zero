---
name: airia-governanca
description: Padrao obrigatorio de todo agente neste repositorio Airia, sem a titular solicitar. Operar governanca, dossie, ticket, celulas, simulador humano, nota 8/10, nucleo ativo e publicacao controlada. Vale ao planejar, codar, revisar, pontuar, prompt, dados, commit, merge ou deploy.
metadata:
  type: workflow
  version: "1.3"
  product: Airia
---

# Governança Multiagente — Airia

Projeto normativo. Descreve como o sistema **deve** operar. Não declara que os papéis já existem. Não trata lacuna como feature pronta.

**Regra-mãe:** cada mudança deve deixar a pessoa mais capaz de perceber seu estado, escolher o próximo passo e entender o motivo da proposta. Um agente pode otimizar sua página; somente o sistema pode aprovar uma mudança que afeta a jornada inteira.

Antes de propor código, leia `docs/product/PRODUCT_CONSTITUTION.md` (comportamento) e [references/dossie-produto.md](references/dossie-produto.md) (contrato operacional). Separe **ideal**, **contrato atual**, **implementado** e **lacuna**.

Esta skill **não** substitui `PRODUCT_CONSTITUTION.md`, `AGENTS.md` nem `docs/DEVELOPMENT_ITERATION_PROTOCOL.md`. Em conflito de comportamento, vence a constituição de produto e a decisão mais recente da titular.

## Quando usar / quando parar

**Padrão deste repositório.** Carregar em cada turno, sem a titular pedir a skill ou o ticket. Vale para pergunta, plano, código, revisão, nota, prompt, dados e qualquer menção a commit/merge/deploy.

Pare apenas se a tarefa for genérica fora da Airia, se alguém pedir para reativar Planner/Hábitos/Pomodoro/Agenda por conta própria, ou se a instrução for autorizar publicação sem a titular.

## Constituição operacional (carregar sempre)

1. Uma fonte de verdade.
2. Menos carga, mais direção.
3. Ação concreta — verbo, objeto, vínculo, Pronto quando.
4. Contexto antes de sugestão.
5. Autonomia confirmável.
6. Honestidade de evidência.
7. Saúde proporcional — não diagnosticar nem prescrever.
8. Núcleo ativo — `/comecar` `/checkin` `/home` `/goals` `/insights` `/journal` `/aura` `/preferences`.
9. Privacidade por padrão.
10. Publicação controlada.

Desligado: Planner, Hábitos, Pomodoro, Google Agenda.

## Ciclo

Pedido → ticket → célula em branch isolada → testes + simulador → parecer ≥ 8/10 com impressionado → coordenador → GitHub/VPS só com autorização humana.

Quem produz não se verifica. Pedido vago não vira código.

## Referências

- [references/dossie-produto.md](references/dossie-produto.md)
- [references/constituicao.md](references/constituicao.md)
- [references/celulas.md](references/celulas.md)
- [references/verificacao.md](references/verificacao.md)
- [references/simulacao.md](references/simulacao.md)
- [references/plataforma.md](references/plataforma.md)
- [assets/ticket.md](assets/ticket.md)
- [assets/parecer.md](assets/parecer.md)
- `docs/product/PRODUCT_CONSTITUTION.md`
- `docs/product/governanca-multiagente.md`
- `docs/quality/rubrica-8.md`
