---
name: airia-goal-progression
description: Implemente objetivos da Airia como uma sequencia real de microacoes ordenadas, com uma proxima acao ativa, conclusao progressiva, integracao ao Planner e celebracao acessivel no encerramento.
---

# Progresso de Objetivos

Objetivo nao e lista solta. A criacao em tela ou pela Airia gera microacoes persistidas e ordenadas; so a primeira incompleta fica ativa.

1. Trace schema, decomposicao, API, pagina Objetivos, Planner e conclusao de acao.
2. Gere de duas a cinco microacoes com primeiro movimento físico e ordem de execucao; nao invente uma meta sem pedido da usuaria.
3. Derive a acao ativa da primeira pendente no backend ou seletor unico, nunca de estado visual local.
4. Ao concluir, avance atomicamente; quando nao houver pendentes, conclua o objetivo e dispare `RewardBurst` respeitando movimento reduzido.
5. Retire a pagina isolada de tarefas sem retirar tarefas do Planner ou do Comando Central.

**Como verificar:** crie um objetivo, conclua cada acao e recarregue a pagina; somente a proxima fica verde e a celebracao ocorre uma vez ao final.
