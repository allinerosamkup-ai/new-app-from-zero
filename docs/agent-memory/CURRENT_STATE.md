# CURRENT_STATE — trabalho em andamento

## Status

`PR #10 — gates locais, IA real, migração segura e E2E autenticado aprovados; sem deploy`

## Objetivo

Transformar objetivos em caminhos vivos e contextuais, com Objetivo em foco
manual ou sugerido pela Airia, etapas estruturadas, ação atual executável e
prioridades diárias produzidas pela IA sem Planner, Hábitos ou Google Agenda.

## Definition of Done

- [x] Objetivo persiste prazo, pausa, resultado, realidade atual, etapas,
      versão do caminho e proposta de revisão.
- [x] Ações persistem etapa, data, evidência de conclusão, esforço, origem e
      proteção de edição manual.
- [x] A Airia gera caminhos ancorados em contexto real, pergunta quando falta
      informação decisiva e nunca preenche com ações genéricas.
- [x] A interface mostra etapa atual aberta, ação atual destacada, futuras
      resumidas e revisões somente após confirmação.
- [x] Estrela manual prevalece; sem estrela, a Airia sugere um objetivo em foco
      explicável e que pode ser fixado pela pessoa.
- [x] Home separa Objetivo em foco de Prioridades do dia e só usa a ação atual
      da etapa vigente como candidata diária.
- [x] Planner, Hábitos e Google Agenda não participam de UI, grounding,
      mutações, notificações ou decisões desta versão.
- [x] Migração, contratos, memória, privacidade, timezone e concorrência têm
      cobertura automatizada.
- [x] Fluxo autenticado mobile cobre criar, responder, concluir, revisar,
      confirmar, recarregar e verificar persistência.
- [x] Builds, testes integrais, avaliação semântica determinística, revisão
      Airia e gates Git locais foram executados com evidência recente.

## Sprint Contract

- **Entrada:** plano aprovado no task Codex em 2026-08-11.
- **Usuária:** pessoa leiga tecnicamente usando a PWA mobile-first.
- **Fonte operacional:** Objective + ações do objetivo + Próximas ações.
- **Fonte contextual:** Diário, Check-in, Aura e memória canônica, com
  proveniência; padrões calibram e não criam fatos.
- **Autonomia:** IA escolhe e reordena; estrela, mudança de data e revisão de
  caminho exigem confirmação humana.
- **Falha:** modelo alternativo e última avaliação válida; nunca ranking ou
  checklist mecânico fingindo ser IA.
- **Fora de escopo ativo:** Planner, Hábitos, Google Agenda e deploy.

## O que já foi feito

- Protocolo, memória, branches e 25 worktrees inspecionados.
- A worktree antiga de recuperação de objetivos foi rejeitada como base por
  estar desatualizada; as correções equivalentes já estão no `master`.
- Worktree atual criada a partir de `b8ad28d`.
- Código existente localizado: `GoalIntelligenceService` já separa fato de
  inferência, mas a UI reduz sua resposta a uma lista plana e perde resultado,
  realidade, premissas, etapas e evidências.
- Schema, migração, APIs versionadas, memória canônica, motor único de caminho,
  revisor semântico, fallback de modelo e prioridades diárias implementados.
- Objetivos e Home renderizam o caminho em etapas, ação atual, estrela manual,
  foco sugerido, prioridades de hoje e itens que podem esperar.
- Diário, Check-in e Aura avaliam contexto novo e criam somente proposta de
  revisão futura; confirmação mantém ações concluídas e editadas pela pessoa.
- Planner, Hábitos, Google Agenda e Routine Builder estão desligados por
  capacidade canônica na UI, rotas, grounding, Aura, crons e notificações.
- Ações podem ser editadas, adiadas, rejeitadas e retomadas no mobile; cada
  decisão entra na memória na mesma transação da mutação canônica.
- Duas rodadas de revisão independente corrigiram todos os P1/P2 encontrados;
  a última varredura não encontrou bloqueante restante.
- O E2E autenticado mobile criou um objetivo amplo, respondeu duas perguntas
  decisivas, concluiu e abriu ações, registrou mudança no Diário, confirmou
  revisão, recarregou Objetivos/Home e consultou a Aura com persistência no banco.
- O E2E revelou e corrigiu dois defeitos ausentes nos testes anteriores: o
  envelope global do web quebrava contratos estritos de Objetivos; consulta
  informativa da Aura podia propor revisão e a IA podia repetir IDs de etapas.
- A migração foi executada sobre os dados reais dentro de transação com
  `ROLLBACK` e o runtime completo foi exercitado em schema isolado. A base
  pública permaneceu com 42 objetivos, 7 preferências e sem a migração aplicada.

## O que falta

- [x] Baseline completo.
- [x] Schema e migração.
- [x] Contratos e serviços com TDD.
- [x] APIs e memória.
- [x] Objetivos e Home.
- [x] Avaliação real com `gpt-5.4-mini`: `aura:eval` 10/12 e `ai:smoke` 11/11.
- [x] E2E autenticado persistente e validação segura da migração.
- [x] Branch publicada e PR #10 aberto sem merge ou deploy.

## Arquivos alterados

- Commit funcional: `7b33baa feat: add contextual objective intelligence`.
- Correções encontradas no E2E: `9396159 fix: harden objective validation flows`.
- Worktree sem alterações funcionais fora dos commits desta tarefa.

## Verificações executadas

- Baseline: backend 102 suítes; web 57 arquivos / 429 testes — PASS.
- Final: backend 107 suítes — PASS.
- Final: web 57 arquivos / 430 testes — PASS.
- `npm run generate -w packages/database` e build do database — PASS.
- `npm run build -w apps/backend` — PASS.
- `npm run build -w apps/web` — PASS.
- Typecheck backend e web — PASS.
- Casos semânticos determinísticos: finanças, dívida, portfólio/Instagram,
  mudança, baixa energia, fallback, invenções e pergunta decisiva — PASS.
- API canônica: criar → perguntar → responder → fixar foco → datar ação — PASS.
- Preview mobile local: HTTP 200 e capturas de Objetivos/Home; sem página branca.
- `git diff --check` — PASS.
- `aura:eval` com modelo real `gpt-5.4-mini` — PASS: 10/12, no limiar exigido.
- `ai:smoke` com modelo real `gpt-5.4-mini` — PASS: 11/11 superfícies com contrato respeitado.
- Migração real: execução integral em `BEGIN`/`ROLLBACK` — PASS; produção sem
  colunas, FK ou registro de migração novos após a validação.
- E2E autenticado 390×844: criação canônica, pergunta, caminho, conclusão,
  abertura de etapa, Diário, proposta, confirmação, recarga, Home, Aura e
  memória canônica — PASS.
- Persistência isolada final: objetivo `ready`, versão 6, proposta limpa,
  histórico concluído, IDs de etapas únicos e memórias de Diário/Aura presentes.
- Usuário, sessão, schema e servidores temporários do E2E foram removidos.
- A chave já existia no projeto. O Node local precisou de `--use-system-ca`
  porque a chamada falhava com `UNABLE_TO_VERIFY_LEAF_SIGNATURE`; a mesma API
  respondia HTTP 200 pelo armazenamento de certificados do Windows.

## Descobertas importantes

- `GoalIntelligenceService` é a melhor base e deve ser consolidado, não
  substituído por um serviço paralelo.
- A Aura também usa `GoalIntelligenceService`; o fluxo genérico de decomposição
  não cria caminhos de objetivo.
- Contexto de Diário/Aura é limitado às últimas 48 horas quando representa o
  presente; Check-in só vale como estado atual no dia local de São Paulo.
- O histórico remoto de migrações diverge da árvore local; `supabase db push`
  não pode ser usado até uma reconciliação própria. A migração desta feature foi
  validada por transação revertida e schema isolado, sem reparar histórico.

## Falha atual

Sem bloqueio técnico conhecido. A migração pública, merge e deploy continuam
intencionalmente não executados porque exigem autorização explícita de produção.

## Próxima melhor ação

Revisar e integrar o PR #10 quando houver autorização. No deploy autorizado,
reconciliar o histórico remoto antes de aplicar a migração; não usar `db push`
automaticamente e não publicar a partir desta worktree.
