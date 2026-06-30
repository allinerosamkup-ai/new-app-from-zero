# Segunda rodada de melhoria do app

Data: 2026-05-10

## Objetivo

Transformar as melhorias da primeira rodada em continuidade de uso:

- Insights deve gerar acao apenas quando ha base suficiente.
- Diario deve encerrar com proxima acao clara e opcao de revisar o dia.
- Nenhuma sugestao nova pode nascer de dado fraco, vazio ou apenas texto generico.

## Implementacao

1. Criar helper testavel para decidir quando um insight pode virar acao.
2. Atualizar Insights para bloquear salvamento no Planner quando houver menos de 3 check-ins.
3. Mostrar evidencia da acao de Insights antes de salvar.
4. Atualizar Diario para levar a usuaria ao fechamento do dia apos finalizar uma sessao.
5. Rodar testes e builds de web/backend quando aplicavel.

## Fora de escopo

- Exclusao de conta.
- Refatoracao grande de Home, Planner, Insights ou Diario.
- Mudanca visual extensa.
