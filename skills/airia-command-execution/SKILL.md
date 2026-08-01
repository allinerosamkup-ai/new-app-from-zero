---
name: airia-command-execution
description: Ajuste o Comando Central da Airia para compreender linguagem natural e executar tarefas, compromissos, objetivos, notas, check-ins e navegacao com contexto real, sem perguntas ou sugestoes genericas.
---

# Execucao pelo Comando Central

Use o contrato `actions[]`, o grounding diario e o executor idempotente como fonte unica. A Airia extrai todas as acoes da fala, registra estado emocional em paralelo e confirma o que foi feito.

1. Trace prompt, parser, contrato, executor, persistencia e retorno da interface antes de alterar texto.
2. Execute quando titulo, data ou horario puderem ser resolvidos pelo texto e pelo contexto. Pergunte somente pelo titulo de algo inexistente e nunca por uma reflexao motivacional.
3. Para horario em aberto, consulte agenda, carga e check-in atual; escolha um horario livre e ofereca ajuste/desfazer.
4. Mantenha bloqueios para acoes destrutivas, eventos protegidos e protocolo de risco.
5. Teste uma fala com varias acoes, uma fala de estado emocional e um pedido de agendamento sem horario.

**Como verificar:** uma mensagem deve gerar os registros certos e uma resposta curta que diga o que a Airia ja fez, com ancora real para qualquer sugestao.
