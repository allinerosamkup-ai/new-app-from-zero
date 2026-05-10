# Airia PR Review Skill Roadmap

Fonte: PRs recentes do GitHub, commits de correção e revisão direta da Home em 2026-05-10.

## Habilidades a Aprofundar

1. **Produto final antes de apresentação**
   - Evidência: PR #1 começou removendo botões mortos, `user-temp-id` e placeholders; depois os commits `74348d1`/`7baaffe` introduziram superfícies de demo, e `42a287f` removeu 463 linhas de modo/copy de demo.
   - Prática obrigatória: qualquer PR de UI deve responder se a mudança ajuda a usuária a usar o app agora. Se for pitch, venda, demo ou explicação para investidor, não entra no app.

2. **Fluxos reais sem estado falso**
   - Evidência: PR #1 conectou navegação, auth real, planner e journal ao backend real; PR #3 corrigiu falhas persistentes de sync.
   - Prática obrigatória: não usar seed, usuário temporário, botão morto, Alert placeholder ou navegação simulada em fluxo consumidor.

3. **Contratos API e erro visível**
   - Evidência: PR #3 corrigiu Prisma `P2025`, trocou `update` por `upsert`, melhorou extração de `err.response.data.error` e evitou fechar modal quando sync falha.
   - Prática obrigatória: toda ação de escrita precisa ter sucesso/erro explícito; UI só atualiza ou fecha modal depois de confirmação real.

4. **Tempo e agenda sem drift**
   - Evidência: PR #3 corrigiu `setHours` para `setUTCHours` para evitar drift entre escrita e leitura de blocos.
   - Prática obrigatória: backend guarda horário de agenda de forma UTC-consistente e UI trabalha com data local explícita.

5. **IA ancorada em contexto atual**
   - Evidência: commits `0af5d58`, `4f362be`, `f8f7db4`, `9267dba` e `20128b2` reforçaram grounding, Decision Brain e raciocínio operacional.
   - Prática obrigatória: sugestão operacional da Airia precisa citar âncora real do dia: tarefa, hábito, meta, check-in, diário ou pedido explícito. Sem âncora, perguntar.

6. **Segurança sem terapeuta falsa**
   - Evidência: `riskSafety` foi adicionado a Check-in, Diário e Aura; revisão recente exigiu produto final, não copy de clínica/pitch.
   - Prática obrigatória: linguagem de risco usa protocolo, apoio humano e adaptação de carga; nunca diagnóstico, promessa de cura ou substituição clínica.

7. **Higiene de release**
   - Evidência: `e34f16d` ajustou healthcheck; a operação recente exigiu GitHub, VPS e produção no mesmo SHA.
   - Prática obrigatória: PR importante só fecha com testes/builds relevantes, branch limpa, GitHub atualizado, VPS no mesmo commit e healthcheck `200` quando houver deploy.

## Checklist de Revisão

- A mudança melhora um fluxo de usuária real?
- Não há demo, seed, pitch ou copy para investidor em `apps/web/src` ou `apps/backend/src`?
- Toda sugestão IA tem âncora operacional atual?
- Toda escrita backend tem contrato claro de sucesso/erro?
- Datas de planner preservam horário local sem drift?
- Risco emocional aciona `riskSafety` e protocolo humano/crise?
- Testes e build cobrem a área tocada?
