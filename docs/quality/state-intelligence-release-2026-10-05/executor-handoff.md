# Executor de publicação — AIRIA-SI-01-RELEASE

Contexto: publicação autorizada da entrega SI-01/dossiê, sem integrar arquivos alheios, outros PRs ou tarefas restantes. Governança, protocolo, constituição, revisão de PR, memória e workflows consultados. Executor não aprova a própria entrega.

Branch publicada: codex/state-intelligence-foundation-2026-10-02. Candidata congelada cfb2e14721e5dd5074b16a6b0dacb5f33f3862ad; commits de release c075c03/cfb2e14 são somente documentação. Código implementado permanece 72f206f, aprovação local ab5f5ae.

PR criado e anexado à tarefa: https://github.com/allinerosamkup-ai/new-app-from-zero/pull/21. Corpo exato em pr-body.md. Pré-release independente PASS 9,25; CI candidata https://github.com/allinerosamkup-ai/new-app-from-zero/actions/runs/37349774349 em andamento. Não há merge/deploy nesta atualização.

Gate operacional: após CI verde, merge com SHA esperado; CI de master verde e SHA completo remoto conferido imediatamente antes do dispatch Deploy VPS. O script permite ref arbitrária apesar da descrição do workflow, então igualdade será conferida pelo executor. Deploy usa configuração existente do cofre, migrações legadas e rollback; nenhuma credencial/migração nova. Logs brutos de deploy não serão capturados por conterem URL autenticada.

Próxima ação: acompanhar CI; corrigir falha real se houver, com revisão independente; depois publicar SHA exato e entregar identidade /opt/airia/app-src, containers e release pública para integração/meta. /opt/airia/app é cópia operacional legada e pode manter HEAD antigo por desenho do script; não confundir com fonte real do build.

## Merge e gates remotos

CI da candidata 37349774349 SUCCESS: build database/backend/web, typecheck web, 74 arquivos web, autenticação backend e 121 suítes backend completas. Log consultado somente para contagens/marcadores de testes, sem segredos. PR21 merge autorizado em 2026-10-05T17:45:08Z, com guarda match-head cfb2e14721e5dd5074b16a6b0dacb5f33f3862ad.

SHA de master congelado: 7a2acc960a12a99955300581f7dc2ca0b8d438ba, confirmado por API e fetch. CI de master https://github.com/allinerosamkup-ai/new-app-from-zero/actions/runs/37350767099 em andamento nesta atualização; deploy ainda não iniciado. Evidência local SI-01 sintética não substitui CI/produção. Nenhum novo commit documental durante o congelamento.

CI master 37350767099 concluído SUCCESS (gates completos). API master consultada imediatamente antes de workflow_dispatch e comparada com SHA completo congelado; igualdade confirmada, caso contrário o comando recusaria publicar. Deploy VPS iniciado: https://github.com/allinerosamkup-ai/new-app-from-zero/actions/runs/37351506586, headSha/ref 7a2acc960a12a99955300581f7dc2ca0b8d438ba, rótulo airia-si01-20261005-7a2acc9. Resultado pendente nesta atualização; logs brutos não publicados.

## Entrega para verificação independente

**READY_VERIFY**: operação concluída, aprovação da própria entrega reservada aos revisores. Deploy 37351506586 SUCCESS em 5m8s: SSH, configuração existente, publicação e conferência públicas concluídos. Não houve falha, retry ou rollback acionado. Logs brutos de deploy não capturados.

Após deploy, API de master consultada novamente: 7a2acc960a12a99955300581f7dc2ca0b8d438ba, igual ao congelado. Sondagens diretas com timeout 25s: https://airia.pro/api/health HTTP200; https://airia.pro/home HTTP200; https://airia.pro/release.json HTTP200 e JSON release 7a2acc960a12a99955300581f7dc2ca0b8d438ba; https://airia.pro/sw.js HTTP200, contendo o mesmo SHA. Nenhum dado privado enviado/modificado nessas sondagens.

Próxima ação: release_review/root conferem fonte real /opt/airia/app-src e labels dos containers por SSH somente leitura, navegador público e limitação autenticada; meta independente audita e registra meta-approve. Root registra protocolo/estado e dá destino a pr-body.md/este handoff, sem modificar o SHA da release antes dos gates. Este executor não autoriza DONE e não declara PostgreSQL/CAS/IA privados validados em produção por sondagens públicas.
