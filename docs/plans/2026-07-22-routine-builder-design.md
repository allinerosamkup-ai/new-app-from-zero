# Montador de Rotina da Airia — Design aprovado

## Objetivo

Transformar conversa, texto colado, áudio transcrito ou documento em uma semana realmente executável. A Airia deve separar metas, projetos, tarefas, hábitos, compromissos fixos, referências e preocupações; cruzar esses itens com agenda, limites, humor, energia e histórico; pedir somente os esclarecimentos indispensáveis; mostrar uma prévia editável; e persistir apenas depois da confirmação.

## Problema confirmado

O fluxo atual interpreta uma ação por mensagem. Um documento misto vira relato ou uma única ação, a rotina sem contexto cai em blocos genéricos e não existe uma sessão persistente de revisão. Por isso a Airia não consegue montar uma rotina completa, distinguir meta de tarefa nem explicar ao usuário o que será criado.

## Fluxo do produto

1. **Foco:** a pessoa informa o que precisa organizar nesta semana.
2. **Vida real:** a Airia carrega compromissos, hábitos, metas, tarefas e restrições existentes.
3. **Limites:** considera horários de acordar e dormir, compromissos fixos, períodos indisponíveis e carga aceitável.
4. **Caixa de entrada universal:** recebe texto, áudio transcrito ou arquivo.
5. **Classificação:** separa cada trecho em meta, projeto, tarefa, hábito, compromisso, referência ou preocupação.
6. **Esclarecimento mínimo:** faz no máximo cinco perguntas, somente quando uma resposta muda a agenda.
7. **Primeira semana:** monta uma prévia com horário, duração, origem e justificativa de cada item.
8. **Confirmação:** cria tudo em uma única transação e informa exatamente o resultado.

## Princípios obrigatórios

- Contexto antigo explica padrões; contexto atual e itens confirmados autorizam ações.
- Documento gera candidatos, nunca mutações silenciosas.
- Toda classificação é editável e mostra o trecho de origem.
- Compromissos fixos são protegidos; tarefas flexíveis são adaptadas.
- Humor e energia mudam carga, duração, ordem e margem, mas não inventam obrigações.
- Itens concluídos, excluídos, rejeitados ou duplicados não reaparecem como novidades.
- A resposta usa a metodologia de raciocínio aprovada sem exibir nomes, siglas ou nomenclaturas proprietárias.
- A Airia entrega análise e direção; perguntas são exceção, não o produto.

## Tipos e destino

| Tipo reconhecido | Destino após confirmação | Regra |
|---|---|---|
| Meta | `Objective` | Resultado desejado, sem horário próprio |
| Projeto | `Objective` + tarefas associadas | Resultado com várias etapas |
| Tarefa | `TimelineBlock` | Ação concluível e observável |
| Hábito | `Habit` | Comportamento recorrente |
| Compromisso | `TimelineBlock` fixo | Data ou horário externo protegido |
| Referência | Contexto da sessão/memória | Não vira tarefa sem ação explícita |
| Preocupação | Contexto da sessão/memória | Pode influenciar análise, nunca cria obrigação |

## Arquitetura

Uma `RoutineBuildSession` armazena fonte, classificação, respostas, prévia e aplicação. Ela permite retomar o processo, editar itens e garante idempotência.

Serviços:

- `RoutineSourceExtractorService`: valida MIME/tamanho e extrai texto de TXT, Markdown, PDF, DOCX e XLSX.
- `RoutineClassifierService`: transforma a fonte em itens estruturados, preservando evidência e confiança.
- `RoutineClarificationService`: identifica apenas lacunas bloqueantes.
- `RoutineComposerService`: combina candidatos com o contexto diário e o motor adaptativo existente.
- `RoutineApplyService`: persiste metas, hábitos e blocos em uma transação única.

## Persistência

`RoutineBuildSession` contém: usuário, estado, etapa, tipo/nome/MIME/hash da fonte, texto com retenção curta, foco, limites, itens classificados, perguntas, respostas, plano semanal, resultado da aplicação, localidade, início da semana, data da aplicação e timestamps.

Estados válidos: `draft`, `classified`, `needs_clarification`, `ready`, `applied`, `failed`, `cancelled`.

## API

- `POST /api/routine-builder/sessions`
- `POST /api/routine-builder/sessions/:id/source`
- `PATCH /api/routine-builder/sessions/:id/items`
- `POST /api/routine-builder/sessions/:id/clarify`
- `POST /api/routine-builder/sessions/:id/compose`
- `POST /api/routine-builder/sessions/:id/apply`
- `GET /api/routine-builder/sessions/:id`

## Interface

A rota `/routine-builder` terá etapas progressivas: entrada, classificação, esclarecimentos, semana e confirmação. Aura, Planner e onboarding apontam para a mesma sessão; não haverá três montadores concorrentes.

## Privacidade e segurança

- Arquivos têm limite de 10 MB e lista explícita de MIME.
- Texto bruto tem retenção curta e participa de exportação/exclusão LGPD.
- Conteúdo de documentos não entra em logs.
- A aplicação exige sessão autenticada, pertencimento ao usuário e confirmação explícita.
- Em falha, nenhuma entidade parcial permanece criada.

## Critérios de aceite

1. Um texto misto produz vários itens classificados.
2. Meta, tarefa, hábito e compromisso são distinguidos corretamente.
3. Referência e preocupação não viram tarefas automaticamente.
4. Duplicados existentes são sinalizados e bloqueados.
5. A Airia faz no máximo cinco perguntas úteis.
6. A prévia respeita compromissos fixos e hábitos devidos.
7. A carga varia conforme contexto real de humor e energia.
8. A confirmação cria todos os registros atomicamente e pode ser repetida sem duplicar.
9. A interface informa erros de forma específica.
10. Aura e Planner abrem e retomam a mesma sessão.
