# AIRIA-SI-01-RELEASE — GitHub e VPS

Autorização humana 2026-10-05: “vps git hub atualização completa”. Escopo concreto: publicar os cinco commits da entrega atual (dossiê, backlog e SI-01), branch codex/state-intelligence-foundation-2026-10-02, HEAD ab5f5ae, base origin/master 5dcf2ad. Não integrar outros PRs/worktrees, arquivos alheios ou funcionalidades ainda planejadas. Sem mudança nativa Android/APK requerida: app mobile consome web existente.

## Reuso e decisão

Governança, constituição, protocolo e skills airia-governanca/airia-pr-review/deploy-airia lidos. Skill deploy-airia aponta branch antiga feat/navigation-planner-ui-backend; esse trecho está superado pelo workflow versionado e overlay de governança, que exigem master/CI/autorização/SHA exato. Usar PR → CI → merge master → Deploy VPS workflow_dispatch com SHA exato; nunca script bat antigo ou pull de branch obsoleta. Código e docs já possuem verificador 9,30, integração 9,2 e meta local 9,25. CI remoto é gate adicional, não herdado desses testes.

## Aceite

- [ ] Branch publicada e PR anexado à tarefa; diff restrito à entrega e registro desta release.
- [ ] Parecer independente pré-release nota ≥8 e CI verde antes de merge.
- [ ] Merge autorizado em master; SHA publicado congelado e CI confirmado.
- [ ] Deploy VPS conclui, com rollback existente disponível; sem segredos em evidências.
- [ ] GitHub/master, código VPS, imagens/containers e release.json/sw.js correspondem ao mesmo SHA.
- [ ] /api/health e /home respondem 200; browser público e autenticado quando sessão legítima disponível, sem inventar prova privada ou provocar crise/provedor artificial em produção.
- [ ] Verificador/integrador/meta independentes emitem notas/evidência; estado e limites persistidos, commits locais/remotos com destino.

## Destino e limitações

Mesmo checkout/branch existente, sem nova worktree; preservados supabase/.temp/cli-latest, diretórios untracked de skills/.claude/.codex, backend/scripts/test-goal-fallback.ts, skills-lock.json. Notion sem conector; ticket persistido local. Aprovação publica somente recurso implementado SI-01; quatro direções/sensores/piloto não estão prontos. Não mudar credenciais, dados pessoais ou outro serviço na VPS. DONE exige fatos vivos e revisão meta de release própria.
