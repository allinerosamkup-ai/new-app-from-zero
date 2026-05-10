---
name: airia-pr-review
description: Use antes de finalizar, aprovar, publicar ou revisar PRs da Airia. Cobre produto final vs demo, grounding de IA, fluxo real, contratos, timezone, seguranca emocional e release.
---

# Airia PR Review

Use esta skill sempre que houver PR, revisao de codigo, entrega de feature, preparacao de deploy ou fechamento de tarefa relevante na Airia.

## Regra Central

Nenhum PR relevante termina sem evidencias concretas. A revisao precisa apontar arquivos, testes, commits, comentarios de revisao ou problemas recorrentes. Conselho generico nao passa.

## Checklist Obrigatoria

1. Produto final antes de apresentacao
   - Evidencia recorrente: PR #1 removeu botoes mortos, `user-temp-id` e placeholders; os commits `74348d1` e `7baaffe` introduziram superficies de demo; `42a287f` removeu 463 linhas de modo/copy de demo.
   - Revisar: nada em `apps/web/src` ou `apps/backend/src` pode ser pitch, demo, narrativa de investidor, lista de espera ou explicacao comercial interna.
   - Decisao: copy de venda fica em docs, landing externa ou apresentacao. Produto consumidor ajuda a usuaria a agir agora.

2. Fluxo real sem estado falso
   - Evidencia recorrente: PR #1 conectou navegacao, auth real, Planner e Diario ao backend; PR #3 corrigiu sync persistente.
   - Revisar: nao aceitar seed, usuario temporario, botao morto, sucesso simulado, `Alert` placeholder ou navegacao fake.
   - Decisao: feature so esta pronta se tiver entrada da usuaria, chamada real, persistencia confirmada, erro visivel, retorno util e proxima acao.

3. Contratos API e erro visivel
   - Evidencia recorrente: PR #3 corrigiu Prisma `P2025`, trocou `update` por `upsert`, priorizou `err.response.data.error` e evitou fechar modal quando sync falha.
   - Revisar: escrita backend precisa ter contrato claro de sucesso/erro. UI nao fecha modal nem atualiza estado definitivo antes da confirmacao real.
   - Decisao: Check-in, Diario, Aura e Planner devem validar payload/resposta com Zod quando houver escrita, streaming concluido ou protocolo de risco.

4. Tempo e agenda sem drift
   - Evidencia recorrente: PR #3 corrigiu `setHours` para `setUTCHours`; `b8b35f2` adicionou teste de preservacao UTC em Planner.
   - Revisar: servicos de agenda backend nao usam `setHours()` sem refatoracao explicita para helper UTC.
   - Decisao: backend guarda horario de agenda de forma UTC-consistente; UI trabalha com data local explicita.

5. IA ancorada em contexto atual
   - Evidencia recorrente: `f8f7db4`, `9267dba` e `20128b2` reforcaram grounding, Decision Brain e raciocinio operacional.
   - Revisar: cada sugestao operacional responde "qual dado atual sustenta essa acao?".
   - Decisao: so valem agenda pendente, habito devido, meta ativa, subtarefa pendente ou acao explicitamente aceita. Memoria RAG explica padrao, nao cria tarefa.

6. Seguranca emocional sem terapeuta falsa
   - Evidencia recorrente: `b8b35f2` adicionou contrato unico de `riskSafety`; Check-in, Diario e Aura devem renderizar protocolo de apoio humano/crise quando necessario.
   - Revisar: a Airia nao diagnostica, nao promete cura, nao vende tratamento e nao substitui psicologa, psiquiatra, terapia ou emergencia.
   - Decisao: linguagem de risco adapta carga, sinaliza apoio humano e aciona protocolo. Termos clinicos so entram como limite, educacao ou contexto da usuaria.

7. Higiene de release
   - Evidencia recorrente: `e34f16d` alinhou healthcheck; operacoes recentes exigiram GitHub, VPS e producao no mesmo SHA.
   - Revisar: PR importante precisa de testes/builds relevantes e, se houver deploy, healthcheck publico.
   - Decisao: sequencia padrao e backend tests, backend build, web tests, web build, commit, push, deploy quando aplicavel, `/api/health` 200 e `/home` 200.

## Saida Esperada

Quando encontrar problema, responder com achados primeiro, ordenados por severidade, com arquivo/linha quando disponivel. Depois incluir perguntas abertas e um resumo curto. Se nao houver problema, declarar isso e citar quais testes/builds foram executados ou ficaram pendentes.

## Comandos de Verificacao

```bash
npm run test --workspace=@app/backend
npm run build --workspace=@app/backend
npm run test --workspace=@app/web
npm run build --workspace=@app/web
```

Para deploy de producao, usar tambem a skill `deploy-airia`.

