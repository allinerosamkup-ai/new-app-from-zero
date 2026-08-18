# Verificação Final — Governança de Telemetria do Núcleo Airia

**Autor:** Manus AI  
**Data de verificação:** 18 de agosto de 2026  
**Repositório de trabalho local:** `/home/ubuntu/repo-supabase-audit`  
**Projeto de dados validado:** `ksdvzqvwhrmvgozobjbt`  
**Status:** **APROVADO**

> A revisão independente atribuiu **9,75/10**, sem falhas críticas nos critérios mandatórios de privacidade, idempotência, isolamento, jornada de check-in ou segurança prioritária. O limiar definido para aceite era **8,0/10**.

## Síntese executiva

Esta entrega transforma a telemetria do núcleo ativo da Airia em um mecanismo **versionado, minimizado, idempotente e com retenção explícita**. O escopo inclui Check-in, Hoje, Padrões, Diário, Objetivos e decisões canônicas da Airia. A instrumentação registra ações e resultados de produto, sem incluir transcrições, notas, valores de humor, energia, sono, sintomas ou conteúdo de diário.

O banco Supabase recebeu a migração de governança e uma migração complementar de endurecimento. Após a aplicação, a verificação do advisor deixou de reportar os cinco erros de views `SECURITY DEFINER` e os quatro avisos de tabelas com RLS sem política. Permanecem avisos legados de funções e extensão, documentados na seção de riscos.

| Dimensão | Resultado verificável |
|---|---|
| Contrato de eventos | Catálogo tipado com 21 nomes versionados, `Zod discriminatedUnion`, payloads estritos e bloqueio de chaves sensíveis. |
| Privacidade | Conteúdo livre e indicadores de saúde recusados pelo contrato; os eventos de UI carregam apenas IDs, enums, contagens e estados técnicos. |
| Idempotência | `eventId` reutilizado pelo cliente offline, índice único parcial `(user_id, event_id)` e tratamento de colisão `P2002` no serviço. |
| Retenção | `expires_at` obrigatório, padrão de 180 dias, índice de expiração e função de purga exclusiva do `service_role`. |
| Jornadas cobertas | Check-in, Home, Padrões, Diário, Objetivos e decisões são rastreados por eventos semânticos. |
| Qualidade | Build do backend, typecheck da PWA, 117 suítes backend e 59 arquivos/449 testes da PWA aprovados. |

## Alterações implementadas

O contrato central está em `apps/backend/src/contracts/event-log.contract.ts`. Ele separa o evento legado do produto versionado e impede extensões silenciosas dos payloads. O endpoint `POST /api/events/product` valida o contrato, impõe limite de 120 eventos por minuto por usuário e persiste por meio de um serviço idempotente testável.

No cliente, `apps/web/src/lib/track.ts` conserva o mesmo `eventId` e `occurredAt` ao reenfileirar um evento offline. Assim, uma entrega posterior não cria uma segunda observação do mesmo gesto. Os eventos emitidos no Check-in incluem abertura, contexto opcional, voz, tentativa, bloqueio de validação, conclusão, fila offline e falha. As demais jornadas registram abertura, solicitação e resultado de relatório, salvamento confirmado e mudanças persistidas de objetivos.

As decisões canônicas agora possuem a dupla analítica `decision.presented.v1` e `decision.feedback_submitted.v1`, ambas ligadas ao `decisionId`. A apresentação é protegida por um conjunto local de IDs já exibidos, evitando repetição decorrente de renderizações da PWA.

| Área | Arquivos principais | Garantia introduzida |
|---|---|---|
| Contrato e endpoint | `event-log.contract.ts`, `product-event.service.ts`, `index.ts` | Validação, rate limit e deduplicação no limite do backend. |
| Cliente | `track.ts`, `airia-reading.ts` | Fila offline idempotente e ciclo de decisões. |
| Check-in | `checkin-page.tsx` | Cobertura dos nove estados sem envio de conteúdo sensível. |
| Núcleo ativo | `home-page.tsx`, `insights-page.tsx`, `journal-page.tsx`, `goals-page.tsx` | Eventos de intenção e resultados confirmados. |
| Banco | `20260817233000_add_product_event_governance.sql` | Colunas, índices, RLS e retenção. |
| Segurança | `20260817234500_harden_internal_tables_and_views.sql` | Bloqueio explícito de tabelas internas e views com `security_invoker`. |

## Verificação no Supabase

As duas migrações abaixo foram aplicadas com sucesso ao projeto ativo, por operações versionadas de DDL.

| Migração | Resultado | Evidência de banco |
|---|---|---|
| `20260817233000_add_product_event_governance.sql` | Aplicada | `event_id`, `event_version`, `occurred_at`, `surface` e `expires_at` presentes; `occurred_at` e `expires_at` obrigatórios. |
| `20260817234500_harden_internal_tables_and_views.sql` | Aplicada | Políticas restritivas nas tabelas internas e `security_invoker=true` nas cinco views sinalizadas. |

O índice de idempotência foi confirmado como único e parcial em `(user_id, event_id)` para linhas com `event_id` não nulo. O índice de expiração também foi confirmado, limitado à telemetria versionada. A política `event_logs_manage_own` restringe operações da role `authenticated` à correspondência entre `auth.uid()` e `user_id`.

> A política de tabelas internas foi deliberadamente expressa como `RESTRICTIVE ... USING (false) WITH CHECK (false)`. Antes, RLS sem política já negava acesso direto; a alteração torna essa intenção inequívoca sem abrir leitura ou escrita para `anon` e `authenticated`.

## Avaliação independente de aceite

Um avaliador independente, usando `claude-opus-4-7`, recebeu o contrato, testes, cliente, rotas, migrações e diff relevante. O resultado completo está preservado em `.tmp/independent-telemetry-review.json` durante a execução local.

| Critério | Peso | Nota | Status | Evidência principal |
|---|---:|---:|---|---|
| EV-01 — Contrato versionado | 1,00 | 1,00 | Aprovado | União discriminada e rejeição de nomes sem versão. |
| EV-02 — Privacidade e minimização | 1,00 | 1,00 | Aprovado | Payloads estritos, `FORBIDDEN_PII_KEYS` e testes negativos. |
| EV-03 — Idempotência | 1,00 | 1,00 | Aprovado | Índice parcial, reconciliação de `P2002` e teste de repetição. |
| EV-04 — Isolamento por usuário | 1,00 | 1,00 | Aprovado | RLS, política por `auth.uid()` e escopo por `userId`. |
| EV-05 — Jornada de Check-in | 1,00 | 1,00 | Aprovado | Nove transições semânticas testadas. |
| EV-06 — Decisões canônicas | 1,00 | 1,00 | Aprovado | Eventos de apresentação e feedback por `decisionId`. |
| EV-07 — Jornadas do núcleo | 1,00 | 1,00 | Aprovado | Matriz de Home, Padrões, Diário e Objetivos. |
| EV-08 — Volume e modo offline | 0,75 | 0,50 | Parcial | Rate limit e janela temporal corretos; falta teste HTTP ponta a ponta. |
| EV-09 — Retenção e purga | 0,75 | 0,75 | Aprovado | Expiração de 180 dias e função de purga protegida. |
| EV-10 — Segurança Supabase | 1,00 | 1,00 | Aprovado | Erros críticos de views/RLS eliminados. |
| EV-11 — Qualidade de engenharia | 0,50 | 0,50 | Aprovado | Tipos, build e suítes aprovados. |
| **Total** | **10,00** | **9,75** | **Aprovado** | Sem bloqueadores ou falhas críticas. |

## Resultados de validação automatizada

| Comando ou verificação | Resultado |
|---|---|
| `npm test --workspace=@app/backend` | **117 suítes aprovadas**. |
| `npm run build --workspace=@app/backend` | **Aprovado**. |
| `npm run typecheck --workspace=@app/web` | **Aprovado**. |
| `npm test --workspace=@app/web` | **59 arquivos e 449 testes aprovados**. |
| Testes de instrumentação direcionados | **5 testes aprovados**. |
| Teste de cadeia de migrações | **Aprovado**. |
| Teste de allowlist de privacidade | **Aprovado**. |
| Inspeção do advisor após hardening | Sem erros de views `SECURITY DEFINER` nem de RLS sem política nas tabelas tratadas. |

O lint abrangente da PWA **não é uma porta verde desta entrega**: ele ainda reporta 28 erros e 109 avisos no repositório, concentrados em módulos fora do escopo de telemetria, como Planner, telas legadas de onboarding, Aura e motor de ciclo. A configuração foi ajustada para reconhecer a namespace `react-hooks` já instalada, eliminando o erro de regra inexistente; contudo, o passivo restante não foi ocultado nem reclassificado como sucesso. Os arquivos alterados de telemetria passaram em typecheck e na suíte completa.

## Riscos residuais e próxima iteração

Os riscos abaixo não bloqueiam a nota de aceite, mas devem formar a próxima trilha de endurecimento.

| Prioridade | Risco residual | Ação recomendada |
|---|---|---|
| Alta | Não existe teste HTTP real para `201`, `200 duplicate`, `400`, `429` e `401` do endpoint de eventos. | Criar teste de rota com repositório isolado e fixture de autenticação. |
| Alta | Não há teste de RLS com dois usuários reais no Supabase. | Executar teste de integração PostgREST com tokens distintos e tentativa de leitura/escrita cruzada. |
| Média | A fila offline não aplica backoff e pode reenfileirar um `400` de forma indefinida. | Classificar erros não recuperáveis e descartar com métrica técnica agregada. |
| Média | A purga depende de invocação externa por `service_role`. | Programar uma execução recorrente e registrar somente contagem de linhas removidas. |
| Média | O advisor ainda aponta `search_path` mutável em funções legadas, funções `SECURITY DEFINER` expostas e extensão `vector` no schema `public`. | Corrigir em uma migração separada, com inventário de dependências e regressão por função. |
| Média | `security_invoker=true` pode revelar dependências indevidas de views consultadas diretamente por clientes. | Validar em staging que as views são acessadas apenas por caminhos de backend autorizados. |
| Operacional | Uma chave secreta Supabase foi exposta anteriormente na conversa. | **Rotacionar a credencial antes de qualquer uso de produção** e substituir somente pelo mecanismo seguro de segredos. |

## Escopo não executado

O trabalho permaneceu local no clone `repo-supabase-audit`. Nenhum commit foi enviado e **nenhuma publicação no GitHub foi realizada**, conforme a restrição do projeto. Também não houve tentativa de publicação ou deploy do aplicativo móvel demonstrativo.

## Conclusão

A implementação atende ao objetivo de tornar os controles e resultados do núcleo ativo observáveis como dados de produto, sem transformar informações íntimas em telemetria. A combinação de contrato estrito, fila offline idempotente, persistência com índice único, retenção e políticas de banco fornece uma base técnica robusta para análise de jornada com menor risco de exposição.

O aceite é recomendado com a nota independente de **9,75/10**. As pendências remanescentes são melhorias mensuráveis de teste de integração, rotina de retenção, redução do passivo de lint e endurecimento gradual de funções legadas — não bloqueios da governança de telemetria entregue.

## Referências

[1]: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy "Supabase — RLS enabled without policy"
[2]: https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view "Supabase — SECURITY DEFINER views"
[3]: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable "Supabase — mutable function search path"
