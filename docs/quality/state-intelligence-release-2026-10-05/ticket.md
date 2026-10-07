# AIRIA-SI-01-RELEASE — GitHub e VPS

Autorização humana 2026-10-05: “vps git hub atualização completa”. Escopo concreto: publicar os cinco commits da entrega atual (dossiê, backlog e SI-01), branch codex/state-intelligence-foundation-2026-10-02, HEAD ab5f5ae, base origin/master 5dcf2ad. Não integrar outros PRs/worktrees, arquivos alheios ou funcionalidades ainda planejadas. Sem mudança nativa Android/APK requerida: app mobile consome web existente.

## Reuso e decisão

Governança, constituição, protocolo e skills airia-governanca/airia-pr-review/deploy-airia lidos. Skill deploy-airia aponta branch antiga feat/navigation-planner-ui-backend; esse trecho está superado pelo workflow versionado e overlay de governança, que exigem master/CI/autorização/SHA exato. Usar PR → CI → merge master → Deploy VPS workflow_dispatch com SHA exato; nunca script bat antigo ou pull de branch obsoleta. Código e docs já possuem verificador 9,30, integração 9,2 e meta local 9,25. CI remoto é gate adicional, não herdado desses testes.

## Aceite

- [x] Branch publicada e PR anexado à tarefa; diff restrito à entrega e registro desta release.
- [x] Parecer independente pré-release nota ≥8 e CI verde antes de merge.
- [x] Merge autorizado em master; SHA publicado congelado e CI confirmado.
- [x] Deploy VPS conclui, com rollback existente disponível; sem segredos em evidências.
- [x] GitHub/master, código VPS, imagens/containers e release.json/sw.js correspondem ao mesmo SHA.
- [ ] /api/health e /home respondem 200; browser público e autenticado quando sessão legítima disponível, sem inventar prova privada ou provocar crise/provedor artificial em produção.
- [ ] Verificador/integrador/meta independentes emitem notas/evidência; estado e limites persistidos, commits locais/remotos com destino.

## Destino e limitações

Mesmo checkout/branch existente, sem nova worktree; preservados supabase/.temp/cli-latest, diretórios untracked de skills/.claude/.codex, backend/scripts/test-goal-fallback.ts, skills-lock.json. Notion sem conector; ticket persistido local. Aprovação publica somente recurso implementado SI-01; quatro direções/sensores/piloto não estão prontos. Não mudar credenciais, dados pessoais ou outro serviço na VPS. DONE exige fatos vivos e revisão meta de release própria.

Clarificação operacional do workflow existente: a autorização de publicação abrange a sincronização automática de configuração já versionada em deploy.yml com os valores já existentes nos secrets do GitHub, além das migrações legadas idempotentes do script. Isso é manutenção do caminho de produção atual, não autorização para criar, emitir, rotacionar ou introduzir novos valores de credenciais; nenhuma alteração manual de secrets/banco ou outro serviço. Valores não serão exibidos nos registros. O trecho acima veda alteração nova/manual, não essa etapa existente do workflow. Rollback de imagens e verificação pública permanecem obrigatórios.

## Resultado operacional 2026-10-05

PUBLICADO_VERIFICACAO_UI_BLOQUEADA. PR21 integrado; CI candidata37349774349 e master37350767099 verdes; Deploy37351506586 SUCCESS. SHA master/fonte app-src/labels backend e web/release.json/sw.js: 7a2acc960a12a99955300581f7dc2ca0b8d438ba. Health e Home HTTP200. Pré-release9,25 e integração operacional9,10 independentes. Browser público obrigatório bloqueado por quatro timeouts CUA e alternativas documentadas esgotadas; sessão legítima autenticada ausente. Sem aprovação meta final/DONE. Fonte compilada comprovada, comportamento privado/visual em produção não comprovado. Próxima ação: restabelecer captura browser e reverificar gate visual, sem repetir deploy sem mudança.

Evidências de fechamento terão commit/push suplementar nesta branch, sem alterar master/VPS ou redeploy documental. Mudanças alheias preservadas; nenhum arquivo de entrega sem destino.

## Decisão humana posterior — conclusão manual

Em 2026-10-05, titular solicitou: Fazer a conclusão. Tentar a conclusão agora que eu vou aprovar manualmente. Eu tirei o pass. Essa decisão autoriza o fechamento da publicação operacional já comprovada, dispensando nesta release o gate impeditivo de captura visual indisponível. Não transforma UI/fluxo autenticado em verificados nem autoriza modificar hook, código ou redeploy. Aceite anterior preservado como histórico; exceção humana explícita registrada para reavaliação independente da integração/meta.

Fechamento sob decisão humana: DONE PUBLICAÇÃO OPERACIONAL. Integração independente PASS9,10; meta independente PASS9,15 e meta-approve emitido, snapshot protocol-final.json atualizado. UI visual e fluxo autenticado permanecem NÃO VERIFICADOS, dispensados como impedimento desta conclusão por decisão explícita da titular. Versão publicada7a2acc960a12a99955300581f7dc2ca0b8d438ba inalterada; aprovação não abrange tarefas SI-02–SI-15.
