# Montador de Rotina em Cards — Design aprovado

## Objetivo

Transformar o Montador de Rotina em uma experiência única e operacional: a usuária descreve seus planos, recebe uma rotina já separada em sugestões concretas e decide, card por card, o que salvar, editar ou descartar.

## Referência de interação

A referência visual enviada define a hierarquia:

1. entrada simples para os planos;
2. resumo curto do que a IA entendeu;
3. cards com item, data, horário, duração e recorrência;
4. ações visíveis `Adicionar`, `Editar` e `Descartar`;
5. ação final `Aceitar todos`.

A Áiria preserva sua identidade visual, sua leitura de capacidade e seu motor de composição. A referência orienta a estrutura de uso, não uma cópia de marca.

## Decisão de persistência

`Adicionar` salva imediatamente apenas o item daquele card.

`Aceitar todos` salva em uma única operação os itens restantes que:

- ainda não foram salvos;
- não foram descartados;
- possuem configuração operacional válida.

Depois de salvo, o card permanece visível com estado `Adicionado` e não pode ser criado novamente. A operação é idempotente e bloqueia duplicatas por usuário.

## Fluxo

### 1. Captura

A usuária escreve ou dita seus planos. Documento e imagem continuam opcionais. Quando o pedido vem do chat da Áiria com conteúdo suficiente, a classificação começa automaticamente.

### 2. Entendimento

A Áiria separa objetivos, hábitos, tarefas e compromissos. Ela gera um resumo em linguagem natural e usa perguntas somente quando falta frequência, dia ou horário indispensável.

### 3. Proposta

Depois da composição, a página mostra uma pilha de cards. Cada card apresenta:

- tipo do item;
- título concreto;
- primeira ocorrência;
- duração;
- recorrência;
- razão de posicionamento, ligada ao contexto real;
- estado: disponível, salvando, adicionado, descartado ou com ajuste necessário.

### 4. Ações

- `Adicionar`: persiste o item imediatamente e atualiza o card.
- `Editar`: abre editor de dia, horário, duração e recorrência aplicável; recompõe a proposta antes de salvar.
- `Descartar`: exclui o item da proposta, sem gravar entidade.
- `Aceitar todos`: salva os itens restantes e exibe o resultado consolidado.
- `Gerar de novo`: cria uma nova sessão a partir do texto atual; nunca reaproveita silenciosamente uma sessão antiga.

## Arquitetura

O motor atual continua como fonte única:

- `RoutineClassifierService` classifica a fonte.
- `RoutineClarificationService` pede somente campos indispensáveis.
- `RoutineComposerService` posiciona os itens.
- `RoutineApplyService` passa a aceitar uma seleção opcional de `sourceItemIds`.

O resultado acumulado da aplicação guarda `appliedSourceItemIds`. Aplicações parciais mantêm a sessão em `ready/preview`. Quando não há itens operacionais restantes, a sessão passa para `applied`.

Nenhuma nova tabela é necessária: o estado acumulado permanece no JSON `applyResult` da sessão.

## Erros e segurança

- Falha ao salvar um card não muda seu estado visual para adicionado.
- Uma aplicação concorrente retorna conflito e a interface recarrega a sessão.
- Itens duplicados, concluídos, rejeitados ou excluídos não reaparecem como criação.
- Compromissos fixos continuam protegidos.
- Horários são persistidos com a convenção UTC já usada pelo Planner.

## Critérios de aceitação

1. A frase real da usuária gera cards de rotina.
2. `Adicionar` persiste somente o item escolhido.
3. Repetir `Adicionar` não duplica dados.
4. `Editar` recompõe o card antes da persistência.
5. `Descartar` impede a gravação.
6. `Aceitar todos` grava somente os restantes.
7. A interface mostra sucesso e erro reais.
8. Backend, frontend e produção passam pelos testes e builds obrigatórios.

