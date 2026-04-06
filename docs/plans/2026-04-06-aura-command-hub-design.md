# Aura Command Hub Design

**Data:** 2026-04-06

**Objetivo**

Transformar a Aura Chat no hub operacional do app, capaz de reconhecer quando a usuária quer criar um compromisso, registrar uma meta ou usar o chat como diário, executando cada fluxo no setor correto sem tirar a usuária da conversa.

**Decisões**

1. A classificação principal continua no backend, dentro do contrato da Aura Command.
2. Compromissos passam por confirmação explícita antes de serem persistidos no planner.
3. Metas continuam com execução rápida, mas com card-resumo após criação.
4. Conversas classificadas como diário não redirecionam a usuária; a Aura sintetiza o trecho e persiste um resumo real em `journalSession`.
5. Não serão adicionadas dependências novas nem integrações externas.

**Escopo Funcional**

- `compromisso`
  - A IA extrai título, data, hora e categoria.
  - O frontend mostra um card de revisão com ações de confirmar e cancelar.
  - O planner só é atualizado após confirmação.

- `meta`
  - A IA cria a meta ou checklist usando os endpoints já existentes.
  - O frontend mostra resumo do que foi criado.

- `diário`
  - A IA detecta conversa reflexiva/emocional.
  - O backend gera um resumo estruturado com o pipeline já usado pelo diário.
  - O resumo é salvo como sessão concluída e passa a aparecer em `/api/journal/sessions`.

**Arquitetura**

- Backend
  - Estender o contrato da Aura Command para descrever ações que exigem confirmação.
  - Adicionar persistência de resumo de diário para comandos classificados como `reflective_handoff`.
  - Reaproveitar `summarizeJournalSession` e a tabela `journalSession`.

- Frontend
  - Introduzir um estado local de ação pendente em `aura-chat-page.tsx`.
  - Renderizar um card de confirmação para compromissos.
  - Executar criação de compromisso apenas após ação explícita da usuária.

**Fora de Escopo**

- Reescrever a Aura Chat inteira para um fluxo transacional server-driven.
- Abrir automaticamente a página do diário.
- Adicionar agenda externa, calendar sync ou novas bibliotecas.

**Critérios de Aceite**

1. Um pedido de compromisso não entra no planner antes da confirmação.
2. Um pedido de meta cria a meta usando os endpoints atuais.
3. Uma conversa de diário salva um resumo consultável pela lista de sessões do diário.
4. A Aura continua em PT-BR e sem textos fallback estáticos de IA.
