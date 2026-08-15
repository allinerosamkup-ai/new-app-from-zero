# Mood Cycling — Backend API

## Stack
- Node.js + Express
- TypeScript
- Prisma ORM
- OpenAI SDK (GPT-4o-mini)
- Supabase Auth (JWT)

## Core Functions
### `buildAuraSystemPrompt({ userName?, profileSummary?, moodCycleContext?, domain?, extraInstructions? })`
Arquivo: `src/lib/aura-prompt.ts`
Gera o prompt de sistema unificado para a Aura. O `domain` define a policy da superfície (`journal-live`, `journal-finalize`, `aura-command`, `checkin`, `planning`, `home`, `insight`, `summary`, etc.) e o `moodCycleContext` deve ser injetado quando houver contexto de fase.

**Método interno de raciocínio:**
`airia-method.ts` contém uma lente interna de análise, direção e ação. Ela orienta a resposta, mas nunca vira cabeçalho, sigla, nomenclatura ou explicação do método para a usuária. A Airia entrega análise pronta, direcionamento concreto e, quando útil, uma provocação curta em linguagem natural.

### `ContextGroundingService.buildDailyContext(...)`
Arquivo: `src/services/context-grounding.service.ts`
Monta o pacote operacional único do dia (`DailyContext`): sinais e estado atuais,
Objetivos ativos/concluídos, Ações pendentes/concluídas, padrões verificados,
sugestões recentes, feedback de ações e memória RAG. Agenda e Hábitos legados
podem ser preservados no pacote técnico, mas não são fontes ativas enquanto as
capacidades estiverem desligadas.

Regra: memória antiga explica padrão; padrão verificado pode alimentar uma Ação
quando há relevância atual, Objetivo/intenção, capacidade, segurança e evidência
persistida. A memória não grava ação diretamente.

### `AiActionFeedbackService`
Arquivo: `src/services/ai-action-feedback.service.ts`
Persiste no `aiProfilePayload` o histórico leve de ações sugeridas pela IA e marcadas como `shown`, `accepted`, `done`, `dismissed`, `deleted`, `scheduled` ou `rejected`. Status bloqueadores entram no grounding para não ressuscitar sugestões.

### `DecisionEngine`
Arquivo: `src/services/decision-engine.service.ts`
Cérebro operacional da Airia. Recebe `DailyContext` e a superfície (`home`, `planner`, `checkin`, `journal`, `aura-chat`, `insights`, `notification`, `agenda`) e classifica candidatos como `real_commitment`, `suggested_commitment`, `insight_only` ou `blocked`.

Regras principais:
- compromisso real pode ser mantido, movido, reduzido, pausado ou notificado;
- sugestão opcional pode virar proposta de bloco, mas não salva nem notifica sem confirmação;
- memória antiga e RAG explicam padrão; padrões verificados podem calibrar a
  ação, mas não criam destino operacional sozinhos;
- concluído, rejeitado, repetido, vencido, genérico ou sem âncora vira bloqueio.

### `AdaptiveAgendaEngine`
Arquivo: `src/services/adaptive-agenda-engine.service.ts`
Transforma o resultado do `DecisionEngine` em decisões de agenda: `keep`, `move`, `shrink`, `pause`, `suggest`, `convert`, `notify` ou `block`. Sempre retorna preview; `applied` permanece `false` na versão atual.

### `POST /api/timeline/:id/postpone`
Move um bloco do Planner para o dia seguinte mantendo horário e metadados. Registra `timeline.block_postponed` em `EventLog`, grava feedback `scheduled` e expõe adiamentos recentes em `DailyContext.postponedActions`.

### `AgendaAdaptationService`
Arquivo: `src/services/agenda-adaptation.service.ts`
Wrapper HTTP/serviço do `AdaptiveAgendaEngine`. A versão atual não move tarefas sozinha; retorna mudanças propostas com motivo, confiança, tipo de decisão, necessidade de confirmação e permissão de notificação.

### `AIService.streamJournalReply({ context, history, message, onDelta })`
Arquivo: `src/services/ai.service.ts`
Gerencia a resposta em tempo real do diário usando Server-Sent Events (SSE). O `context` agora inclui `moodCycleContext`.

## Serviços adicionados

### `consent.service.ts` — prova de consentimento (LGPD Art. 8 §1)
A tabela `Consent` existia no schema e era exportada em `/api/privacy/export`
desde sempre, mas **nada nunca a escrevia** — chegava vazia em todo export, e o
app não conseguia demonstrar que houve aceite.

Grava no **primeiro acesso autenticado**, que é o momento honesto: a pessoa só
chega ali depois de passar pela tela de cadastro, que exibe Termos e Política.
Idempotente por `(userId, consentType, version)`, com `update: {}` — reexecutar
não sobrescreve a data original, que é o dado com valor legal.

Revogação (Art. 8 §5) **marca, não apaga**: apagar destruiria a prova de que
houve consentimento no período anterior. Revogar não apaga dados — para isso
continua existindo `/api/privacy/delete-request`.

Gravar consentimento **nunca pode derrubar a autenticação**: falha ali só vira
log, senão a pessoa perderia o app inteiro.

### `journal-signals.service.ts` — o diário propõe
O diário é onde a pessoa conta como está sem preencher formulário. O modelo emite
um bloco `journalSignals` no fim da resposta e este serviço lê:
- **check-in** — só com humor **e** energia. Metade do par vira registro torto e
  contamina baseline, tendência e toda leitura de padrão.
- **meta** — título mais 3 a 5 passos, ordenados do **menos** evitado para o mais
  (exposição graduada).

O bloco JSON **sai do texto visível** — mostrar mecânica na cara de quem está
desabafando seria vazamento. E o diário **nunca aplica sozinho**: sempre
`review_required`, porque é superfície confessional e gravar sem pedir
transformaria desabafo em formulário.

`create_goal` vai com `firstAction: null` de propósito — sem isso o construtor
agenda um bloco de 25 min no Planner, que está desligado e ninguém veria.

### `action-equivalence.service.ts` — dedupe por significado
O cliente roda o filtro lexical antes e só chega aqui no caso difícil. Compara se
**fazer uma cumpre a outra**. Instruído a responder "não é duplicata" na dúvida.

Três proteções: temperatura via `openAiTemperature()` (mandar `0` cru dá 400 em
gpt-5/o-series, e como a falha é engolida o dedupe morreria calado); id fora da
lista enviada é descartado, senão alucinação apagaria em silêncio uma ação real;
e qualquer falha permite criar.

## Endpoints Principais
- `POST /api/actions/check-equivalent`: diz se uma ação nova já existe, por significado.
- `GET /api/privacy/consents` · `POST /api/privacy/consents/revoke`: histórico e revogação de consentimento.
- `POST /api/checkins`: Salva check-in e avalia estado via IA. Agora persiste campos de ciclo menstrual.
- `POST /api/ai/suggest`: Endpoint genérico para sugestões IA (notas, checklist, tarefas do dia).
- `GET /api/context/day?date=YYYY-MM-DD`: Retorna o `DailyContext` central do dia.
- `POST /api/agenda/adapt`: Retorna preview de adaptação da agenda com mudanças propostas.
- `POST /api/ai/action-feedback`: Registra feedback sobre ação sugerida pela IA.
- `POST /api/timeline/:id/postpone`: Adia bloco para o próximo dia e registra padrão de adiamento.
- `POST /api/journal/message/stream`: Endpoint SSE para chat do diário.
- `POST /api/routine-builder/sessions`: inicia uma montagem persistente. `mode: 'guided'` dispensa `focus`.
- `GET /api/routine-builder/library`: catálogo de opções do onboarding guiado (áreas, drenos, recuperadores, intenções, hábitos).
- `POST /api/routine-builder/sessions/:id/guided`: respostas de botão viram itens classificados sem IA e sem documento.
- `POST /api/routine-builder/sessions/:id/source`: lê texto ou arquivo e classifica a fonte.
- `PATCH /api/routine-builder/sessions/:id/items`: salva a revisão dos itens.
- `POST /api/routine-builder/sessions/:id/clarifications`: responde somente bloqueios operacionais.
- `POST /api/routine-builder/sessions/:id/compose`: cruza agenda, hábitos e check-in e produz a semana.
- `POST /api/routine-builder/sessions/:id/apply`: aplica metas, hábitos e blocos em uma transação idempotente.

Regras do fluxo:
- pedido simples para montar rotina abre o onboarding guiado por escolhas;
- texto ou documento é opcional e sempre passa por revisão;
- compromisso protegido mantém dia, horário e duração;
- tarefa flexível usa prioridade, prazo, capacidade e espaço real;
- hábito usa frequência, dias, janela e duração mínima/máxima; disponibilidade geral não cancela sua recorrência;
- hábito persistido é deduplicado por título normalizado antes de sugerir novo hábito;
- conflito retorna alternativas de mover, reduzir ou adiar, sem aplicar sozinho;
- lista operacional estruturada com caixas, objetivos e recorrências abre o montador mesmo sem comando literal;
- uma nova solicitação não pode ser substituída por sessão antiga salva no navegador;
- prévia antiga é recomposta automaticamente quando sua versão difere do motor atual.

## Prompt — o que mudou e não pode voltar

`lib/aura-prompt.ts`. Estas quatro coisas têm teste que trava regressão:

**A Airia não devolve a escolha da ação.** O prompt tinha, como *exemplo bom*,
`"se você tivesse que fazer UMA coisa mínima com isso hoje, qual seria?"` — e
exemplo pesa mais que regra. Agora é proibido explicitamente: ela **escolhe** a
menor ação e **nomeia**. Pedir que a pessoa escolha é devolver o trabalho para
quem está sem combustível.

**Pedir permissão não é devolver a escolha.** "Posso colocar no seu plano?" depois
de já ter formulado a meta é autorização para salvar, não transferência de
decisão. O guardrail distingue os dois casos — sem essa asserção, alguém
"conserta" e apaga a funcionalidade do diário.

**`STATE_ACTION_POLICY`** entra em 7 domínios que propõem ação. O estado limita
**o que pode ser proposto**, não só o tom. A regra que mais contraria o instinto:
**em fase alta a conduta é conter, não aproveitar o embalo** — nada de meta
ambiciosa, porque elevar quem já está elevado piora.

**Limite clínico:** nunca nomear transtorno, nunca comentar medicação, nunca
apresentar leitura de padrão como diagnóstico.

## Relatório de período (`monthly-report`)

Falava do dia atual porque era isso que recebia: `phaseLabel` e `moodCycleContext`
("leitura atual", "previsão de energia hoje"). Agora recebe `periodData` — só
agregados da janela — e o prompt tem as 13 seções mais proibição explícita de
virar leitura do dia. Cobertura abaixo de 30% obriga a declarar amostragem baixa.

## Regras de Banco (Prisma)
- Schema: `packages/database/prisma/schema.prisma`
- Model `DailyCheckin`: Centraliza dados de humor, energia e ciclo biológico.
- `EventLog`: registra eventos leves, incluindo feedback de ações IA quando disponível.
- `OnboardingResponse.aiProfilePayload`: guarda memória leve de sugestões recentes e feedback de ações sem nova migração.
- Todas as queries devem filtrar por `userId` (extraído do token JWT).
