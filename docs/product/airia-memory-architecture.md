# Memória longitudinal da Airia

## Regra de autoridade

A memória explica contexto, reconhece padrões e calibra iniciativa. Ela nunca autoriza uma ação operacional sozinha. Todo registro canônico tem `actionAuthority = none`; tarefa, compromisso e notificação continuam exigindo uma âncora atual real ou confirmação explícita.

## Camadas

1. `UserMemory` é a fonte canônica: fatos, padrões, preferências, decisões e contexto, com chave estável, escopo, confiança, saliência, idioma e ciclo de vida.
2. `UserMemoryEvidence` preserva a proveniência de cada observação. Evidências idênticas são deduplicadas por hash.
3. `MemoryEmbedding` continua como índice semântico e pode apontar para a memória canônica por `memoryId`.
4. O Knowledge Graph mantém entidades, fatos, padrões e decisões para raciocínio relacional e faz dual-write para a camada canônica.

Padrões inferidos só ficam recuperáveis após três evidências em pelo menos dois dias. Contradições geram supersessão; registros expirados, retratados ou em outro idioma são excluídos da recuperação. Falha vetorial afeta apenas a requisição corrente: a busca estruturada continua e uma próxima requisição tenta o vetor novamente.

## Aura Chat

Após a resposta ser entregue, a mensagem da usuária e uma janela curta da conversa são registradas como contexto e embedding. A extração estruturada e o Knowledge Graph rodam em best-effort: falha de memória nunca bloqueia a conversa. Desabafo permanece contexto, sem virar tarefa nem decisão operacional.

## Padrão de agenda

`AgendaPatternRecognitionService` observa até 42 dias de blocos, eventos comportamentais, onboarding e memórias dos escopos `agenda`, `work` e `routine`. Ele calcula liberdade contínua, confiança, proporções protegida/importada/recorrente, variância, janelas estáveis por dia da semana, adiamentos, snoozes e conclusões.

Pouca amostra não confirma padrão e ausência de compromisso não prova autonomia. Um padrão confirmado é persistido em `agenda.style.current` por 14 dias, com proveniência. Em `/api/agenda/adapt`, somente confiança a partir de 0,65 pode calibrar a iniciativa, com peso longitudinal de 20%; o dia real continua dominante e o padrão jamais cria âncora ou tarefa.

## Memória negativa

Conclusão, rejeição, exclusão e agendamento geram memória negativa best-effort. Quando há `targetId`, o bloqueio exato é aplicado antes da comparação textual. Isso impede que uma mudança de título ressuscite uma ação já encerrada.

## Privacidade

O export inclui memórias canônicas, evidências, embeddings e Knowledge Graph. `DELETE /api/memory` apaga essas camadas e projeções legadas de memória, sem apagar a conta ou outros dados do produto. As tabelas canônicas têm cascade por usuário, RLS com `auth.uid()` e restrições de domínio no banco.
