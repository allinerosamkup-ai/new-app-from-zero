# Integração independente operacional — release corretiva Airia PR22

Data: 2026-10-07. Papel: release_integration_final, separado de executor e meta. **PASS operacional delimitado, 9,10/10.** Este parecer não encerra AIRIA-BROWSER-TOTAL-20261005 nem comprova UI humana em produção.

## Evidência própria pós-deploy

Consultas somente leitura executadas após liberação do coordenador e sucesso do deploy. GitHub API commits/master devolveu `516b654c335d820b588357b137742531852a8fd8`. CI candidata [37682606803](https://github.com/allinerosamkup-ai/new-app-from-zero/actions/runs/37682606803) SUCCESS no head `b37d3214564d5f45bcec8882d34ad8c265b546c9`; CI master [37683834440](https://github.com/allinerosamkup-ai/new-app-from-zero/actions/runs/37683834440) e Deploy VPS [37684732132](https://github.com/allinerosamkup-ai/new-app-from-zero/actions/runs/37684732132) COMPLETED SUCCESS no SHA master integral acima. Estes resultados foram consultados diretamente por este verificador.

SSH com BatchMode e StrictHostKeyChecking=yes: `/opt/airia/app-src` HEAD corresponde ao mesmo SHA. Containers `airia_backend` e `airia_web` running; ambos labels `org.opencontainers.image.revision` iguais ao master, e label público `airia.release` web também igual. Somente labels/estado foram lidos, nunca env/credenciais. `/opt/airia/app` é checkout operacional legado e não foi usado como fonte compilada.

Sondagens HTTPS com TLS normal: `/release.json` HTTP200 declara o SHA exato; `/sw.js` contém o mesmo SHA; `/api/health` HTTP200 e JSON status `ok`; `/home` HTTP200. Asset real identificado no container `/usr/share/nginx/html/assets/home-page-OK-7YsDP.js` responde publicamente HTTP200. Última consulta própria: 2026-10-07T20:56:18Z, 17:56:18 America/Sao_Paulo. Identidade fonte/runtime/service worker/asset foi comprovada, sem inferir renderização visual.

Falhas instrumentais preservadas: primeiro comando docker format teve erro de aspas, corrigido por consulta de labels públicos; pipe inicial sw para head causou curl23 e não foi usado como prova do marcador. Consulta posterior buscou o SHA completo e passou. Um timeout GitHub e um SSH foram repetidos com consultas idênticas somente leitura, e obtiveram resposta válida. Nenhuma alteração de TLS, proxy, host key ou credenciais.

## Nota e critérios extraordinários

Identidade e rastreabilidade 9,5; disponibilidade/entrega de artefatos 9,0; regressão remota vinculada ao SHA 9,0; honestidade de escopo e privacidade 9,0; ponderação uniforme 9,125, arredondada conservadoramente 9,10. Nenhuma falha crítica operacional observada.

Dois diferenciais extraordinários com evidência: (1) a comparação independente cruza master, fonte efetiva, dois runtimes, release e service worker, detectando tanto drift de checkout quanto publicação parcial/cache antigo; (2) a confirmação do asset Home público, além de health e CI do SHA publicado, evita tratar serviço vivo como prova de entrega do bundle correto. A nota avalia integração operacional, sem adicionar pontos por UI ou persistência não exercitadas.

## Limites e handoff

CUA indisponível nesta retomada: **UI humana em produção NÃO VERIFICADA**. Visual local 8,1/10 anterior permanece restrito à fixture; não foi reexecutado nem promovido a prova produção. Cadastro, login/logout legítimos integrais, PostgreSQL e provedor real, jornadas completas e casos não executados continuam abertos. Sem escrita em conta privada, banco, IA, Git, merge, deploy ou JSON de protocolo por este papel.

Decisão: PASS do gate operacional pós-deploy da release corretiva; não DONE total. Próxima ação: coordenador registra este handoff delimitado no protocolo; meta independente decide fechamento operacional e guarda os limites. Arquivo tem destino documental no suplemento de evidências da branch existente, conforme coordenador; nenhum arquivo sem destino.
