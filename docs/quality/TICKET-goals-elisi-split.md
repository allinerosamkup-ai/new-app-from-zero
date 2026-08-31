# Ticket de trabalho — Airia

- **ID / branch:** `feat/goals-elisi-split`
- **Data:** 2026-08-31
- **Titular (pedido original, citação fiel):** trabalhar na página de objetivos para funcionar como notas e tarefas do Elisi; avaliar o split e ver por que ainda não funciona; comparar com o GitHub porque o local estava diferente; GitHub é o avançado; instalar governança nesta pasta; Coordenador Geral da Airia.
- **Papéis acionados:** coordenador geral / célula `/goals` / dados (`description`) / simulador / verificador independente

## Intenção da pessoa

Querer ver, no mesmo objetivo, o que está pensando (nota) e o que dá para fazer agora (tarefa), sem abrir outra tela e sem o app esconder uma coisa para mostrar a outra.

## Resultado desejado

Em `/goals`, nota e tarefas ficam visíveis juntas. Em tela larga, lista à esquerda e detalhe à direita. A Airia continua destacando o próximo passo executável.

## Páginas e domínios afetados

- Células donas: `/goals`
- Especialistas: dados (PATCH `description` já existe)
- Produtores / consumidores: Home e Aura leem o próximo passo; não duplicar lista

## Não escopo

Planner, hábitos, árvore infinita, merge em master, Deploy VPS, nova tabela de notas.

## Dados e decisões

- Fonte canônica: `Objective.description` (nota) e `subgoals` (tarefas)
- Efeitos persistidos: PATCH `/objectives/:id` `{ description }`; POST/PATCH de ações
- Reversão: voltar a abas Agora/Caminho/Nota
- Segurança e privacidade: sem dados pessoais em log

## Cenários humanos

1. Pessoa nova — cria um objetivo e vê nota + próximo passo sem caçar aba
2. Pessoa recorrente — toca o objetivo na lista e retoma a nota e a ação
3. Pessoa com pouca energia — o Agora está visível; um toque marca feito

## Critérios de aceite

- [ ] Nota e Agora visíveis ao mesmo tempo (não são abas que se excluem)
- [ ] Desktop: lista | detalhe
- [ ] Mobile: cards empilhados com o mesmo split interno
- [ ] Nota persiste em `description`
- [ ] Próximo passo continua executável, com “Pronto quando”
- [ ] Testes do workspace passam

## Risco de release

Baixo. Sem migração. Rollback: restaurar as abas.

## Decisão de autoridade

- Exige autorização da titular para: commit / deploy
- Autorização registrada neste turno: implementar e instalar governança local; **não** publicar
