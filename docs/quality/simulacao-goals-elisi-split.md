# Simulação humana — `/goals` split Elisi

Ticket: `feat/goals-elisi-split`. Contas reais e produção não foram usadas.

## Roteiros

1. **Pessoa nova** — cria objetivo. O detalhe já mostra a nota (vazia, para escrever) e o Agora (passo ou “definir próxima ação”). Não precisa descobrir uma aba chamada Nota.
2. **Pessoa recorrente** — na lista à esquerda (desktop) toca o objetivo; à direita reaparece a nota guardada e o passo atual.
3. **Pouca energia** — no celular o Agora vem **acima** da nota (textarea curta). Um toque no check conclui. Caminho fica recolhido.

## Fricções conhecidas

- Em mobile o split lista|detalhe some (cards empilhados); nota e Agora continuam juntos dentro do card.
- “Pronto quando” ainda é campo extra ao criar ação — carga extra, mas é o contrato de ação concreta da Airia.

## Confiança percebida

O próximo passo e a nota deixam de competir por uma aba. Isso atende a pergunta da célula: a ação atual é visível e executável.
