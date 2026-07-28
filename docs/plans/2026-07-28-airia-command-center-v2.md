# Airia Command Center v2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transformar o botão central da Airia em um comando operacional por linguagem natural integrado ao Planner, Google Agenda, Metas, Hábitos, Check-ins, Diário e uma Caixa de Captura para notas/checklists.

**Architecture:** O backend passa a interpretar a fala em um plano tipado, aplicar um gate de autorização e executar as mutações em um único serviço. Web/PWA e APK apenas apresentam propostas, solicitam os poucos dados indispensáveis e exibem resultados persistidos. Compromissos usam Google Agenda como origem quando conectado, com idempotência e vínculo local por calendário + evento.

**Tech Stack:** TypeScript, Express, Zod, Prisma/PostgreSQL, React/Vite/PWA, React Native/Expo e Google Calendar API.

---

### Task 1: Contratos e persistência

- Criar testes falhando para a união discriminada de operações, planos, política de execução e resultados.
- Adicionar sessões, mensagens, planos, operações e capturas ao Prisma e migrations Supabase.
- Adicionar `gcal_calendar_id`, estado de sync e operação de origem ao Planner, com índice único parcial.
- Gerar Prisma, executar testes de contrato e validar a migration.

### Task 2: Planejamento contextual

- Criar testes falhando para horários ausentes, conflitos, compromissos fixos, humor/energia, quiet hours e timezone.
- Extrair/reutilizar as janelas do Decision Engine em um agendador determinístico.
- Retornar melhor horário e até duas alternativas, sem inventar data indispensável nem agendar no passado.

### Task 3: Google Agenda idempotente

- Criar testes falhando para calendário de escrita, retries e timeout após criação.
- Persistir calendário padrão de escrita e usar `primary` como fallback.
- Marcar eventos com `airiaOperationId`, localizar o evento antes de retry e nunca criar duplicata.
- Não ocultar falha de sync; devolver estado `pending`, `synced` ou `failed`.

### Task 4: Executor central

- Criar testes falhando para criação de tarefa, compromisso, meta, hábito, nota, checklist e check-in.
- Implementar plano → preflight → aplicação, com transação interna e saga do Google.
- Persistir histórico e resultados; exigir chave de idempotência.
- Implementar edição seletiva, retry idempotente e bloqueio de reexecução.

### Task 5: Web/PWA

- Criar testes falhando para cartões de proposta e resultados.
- Remover mutações de `aura-chat-page.tsx`; consumir somente o executor central.
- Adicionar Caixa de Captura pesquisável e rotas/CTAs reais.
- Manter chat em tela cheia, texto/voz, estados de execução, edição, aplicação seletiva e erros visíveis.

### Task 6: APK/WebShell

- Confirmar o ponto de entrada real do APK antes de alterar navegação nativa não utilizada.
- Manter a Airia no centro da experiência WebShell compartilhada pelo APK.
- Reutilizar chat, cartões, voz e contratos do Web/PWA sem criar uma segunda implementação divergente.
- Validar o typecheck mobile e a paridade dos destinos.

### Task 7: Verificação e entrega

- Executar backend tests/build, web tests/build e typecheck mobile.
- Executar fluxo autenticado da API, fluxo visual do comando central, conflitos, retries, Google e persistência.
- Aplicar `skills/airia-pr-review/SKILL.md`, revisar timezone, grounding, risco, i18n e ausência de estado falso.
- Documentar migration/deploy sem declarar produção pronta antes de confirmar schema e persistência reais.

## Hardening de produção — 2026-07-28

A validação autenticada da primeira publicação revelou quatro fronteiras que os
testes isolados não cobriam:

- o entendimento determinístico reconhecia tarefa e check-in, mas uma resposta
  probabilística `respond`/`ask_clarification` ainda conseguia impedir a execução;
- “quero como meta” e “página de metas” não eram reconhecidos como meta;
- o gate inventava um horário antes de o agendador consultar conflitos, humor e
  energia;
- check-in exigia irritabilidade mesmo quando a usuária informou os três sinais
  centrais, e a memória recusava as origens `aura` e `canonical`.

O contrato corrigido dá precedência à ordem explícita atual, recupera de forma
tipada tarefa/meta/check-in quando o modelo contradiz esse entendimento, deixa a
hora ausente para o ranking contextual, decompõe metas antes da persistência e
aceita irritabilidade ausente sem inventar valor. A migration
`20260728170000_fix_aura_command_memory_and_checkin.sql` alinha o banco com esse
contrato e libera as origens reais da memória.
