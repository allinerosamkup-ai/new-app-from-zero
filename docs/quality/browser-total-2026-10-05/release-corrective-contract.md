# Contrato operacional — release corretiva Airia PR22

Data: 2026-10-07. Meta independente: release_meta_final. Este contrato delimita a publicação corretiva autorizada pela titular ("ATUALIZAR VPS CASO ESTEJA TUDO CERTO"). Não substitui nem encerra AIRIA-BROWSER-TOTAL-20261005. O contrato JSON desse pedido permanece ativo; cadastro, login/logout legítimos, PostgreSQL/provedor real e jornadas não executadas continuam abertos na matriz.

## Escopo e identidade

Publicar exclusivamente o pacote do PR22, mais o reparo isolado de login-page.test.tsx após revisão independente. Nenhum módulo desligado é reativado. Arquivos alheios, material Realnews, credenciais e capturas privadas não pertencem a esta release. A aprovação identifica o SHA final; revisão/CI de SHA anterior não o substituem.

## Evidência já disponível

- Técnico independente: PASS delimitado 9,05/10; produtores/consumidores strict, confirmação parcial, ausência de dados e erro explícito.
- Visual independente: PASS 8,1/10, somente gráfico/nav Home320/390 e apresentação modal320; não mede WCAG nem oito superfícies.
- Integração independente: PASS delimitado 8,5/10; Home/histórico, prévia→criação strict→readback sintético e modal/foco. Auth/repos/IA da fixture são sintéticos.
- Regressão fonte inicial: 529 testes web/78 arquivos e build/PWA PASS. CI37643681503 falhou em um teste login React/i18next; backend completo ficou SKIPPED. Esse CI é FAIL, preservado.
- Patch posterior examinado por esta meta: apenas teste, mantém LoginPage/renderer/router reais, tradução real, ampliação PT/EN, erro genérico e cleanup. Não prova integração do provider i18next. Parecer técnico independente e CI completo do SHA final são obrigatórios.

## Portões de autorização

Estado atual: PENDING, sem autorização de merge/deploy nesta versão do parecer.

1. Verificador independente aprova o patch final, com typecheck e regressão proporcional.
2. Commit final escopado, PR revisável e CI remoto completo SUCCESS no mesmo SHA; nenhum job essencial skipped/fail.
3. Meta registra PASS delimitado com nota ponderada >=8, todas dimensões >=7 e zero bloqueio crítico no pacote; dois diferenciais extraordinários vinculados a evidência.
4. Merge somente após esses portões; CI master SUCCESS e despacho Deploy VPS com SHA completo exato. Autorização humana já existe.
5. Após deploy, conferir master=fonte /opt/airia/app-src=versões backend/web=release.json/sw e HTTP/api/health + /home. Observar UI real da correção dentro do acesso legítimo disponível, preservando limitações.

A igualdade acima refere-se ao SHA da fonte real, não ao checkout operacional antigo /opt/airia/app. Falha de qualquer portão impede conclusão da publicação. Uma autorização pré-deploy não equivale ao PASS pós-deploy.

## Critérios extraordinários e limites

Dois ganhos concretos sustentam a candidatura: o adapter UI satisfaz o backend strict e preserva ordem sem relaxar schema; fonte vazia/histórico/erro parcial deixam de produzir falso zero ou falso salvo e preservam o próximo passo. A navegação320 e o modal voltam a conservar controles legíveis e acionáveis no escopo evidenciado. Nenhum desses ganhos comprova eficácia de IA, sensores ou cadastro integral.

Handoff: coordenador é dono serial do protocolo e entrega SHA final/CI e parecer do patch; meta decide autorização específica aqui. CLI do contrato total recebe somente mensagem de handoff/PASS delimitado, nunca meta-approve global para contornar casos abertos. DONE integral permanece BLOCKED. Próximo passo: receber os portões 1–2 e emitir parecer meta final da release.

## Meta-aprovação pré-publicação — 2026-10-07

**PASS DELIMITADO — 8,75/10. Autorizado avançar merge do PR22 e atualização VPS**, exclusivamente no pacote b37d3214564d5f45bcec8882d34ad8c265b546c9 (ou SHA de merge que preserve este conteúdo e passe CI master). Meta release_meta_final independente dos executores e verificadores. Autorização humana explícita já registrada. Este é o meta-approve do contrato operacional corretivo, não do contrato JSON de QA total.

Conferência independente executada: git rev-parse HEAD retornou b37d3214564d5f45bcec8882d34ad8c265b546c9; gh run view37682606803 retornou completed/success e o mesmo headSha. Job build-and-test SUCCESS; Prisma/database build, backend tsc, web vite, web typecheck, web tests e backend contract/unit SUCCESS, nenhum passo essencial skipped. CI anterior37643681503 permanece FAIL histórico; este CI posterior comprova resolução do gate remoto no pacote corrigido. Patch independente PASS8,8/23 testes3arquivos/typecheck sem diagnóstico, conforme login-ci-verifier-final.md. Não houve código de produto novo depois do pacote aprovado, somente teste e evidência.

| Dimensão | Peso | Nota | Fundamentação delimitada |
|---|---:|---:|---|
| Fidelidade |20%|9,0|Corrige desaparecimento do histórico/ação e confirmação incorreta preservando núcleo ativo |
| Funcionamento/dados |20%|9,0|Strict endpoint e readback sintéticos; confirmação/ausência/erro explícitos; CI completo |
| UI/UX/acessibilidade |20%|8,1|Parecer visual320/390/modal e integração foco/alcance; WCAG e jornada total não certificados |
| Segurança/privacidade |15%|9,0|Erro genérico, isolamento corrigido, capturas privadas excluídas e limites preservados |
| IA/conteúdo |15%|8,5|Janela/ausência honestas, sem inventar continuidade ou dados; provider real não certificado |
| Manutenibilidade |10%|9,0|Reuso do adapter strict e reparo de teste sem alteração produto/dependência |

Ponderada8,745, arredondada8,75. Nenhuma dimensão abaixo7; nenhum bloqueio crítico identificado neste escopo. Duas evidências extraordinárias: produtor UI satisfaz consumidor strict com ordem preservada sem afrouxar contrato; histórico mínimo/cache vazio/falha parcial mantêm informação e próximo passo honestos, evitando falso zero ou falso salvo entre superfícies. A correção do teste amplia PT/EN e cleanup sem remover assertions. Não se infere excelência global da Airia dessas notas delimitadas.

### Condições posteriores ainda obrigatórias

Merge no conteúdo aprovado, CI master verde, workflow VPS com SHA completo exato e readback independente de fonte real/containers/release/sw/HTTP. Divergência ou falha interrompe conclusão operacional. CUA de produção está indisponível por erro sandboxsetup na retomada, conforme coordenador; inspeção de assets/SHA/health não recebe nome de avaliação humana nem valida UI autenticada. Essa lacuna fica registrada após publicação e não reabre código/CI já aprovados sem finding novo. Não declarar DONE total de cadastro/jornada, nem PASS de UI real posterior ao deploy. A publicação só recebe seu estado operacional final após verificação independente dos portões pós-deploy.

Handoff vertical ao root: evidênciaCI37682606803/SHA/parecerpatch+três pareceres delimitados; decisão PASS8,75 e autorização merge/VPS corretivos; próxima ação executor merge/CI master/Deploy exato, verificador independente readback. Root registra mensagem delimitada via CLI, preservando contrato total ativo e sem meta-approve global. Esta meta não executou Git mutation ou deploy.

## Meta-aprovação final operacional — 2026-10-07

**PASS DELIMITADO — 9,15/10. Fechamento da release corretiva operacional autorizado.** Versão publicada: 516b654c335d820b588357b137742531852a8fd8. Esta decisão refere-se ao contrato documental de publicação; não encerra AIRIA-BROWSER-TOTAL e não autoriza meta-approve global no JSON desse pedido.

Meta release_meta_final leu o parecer independente release-integration-final.md (PASS9,10). Ele comprovou por consultas próprias GitHubmaster=fonte efetiva /opt/airia/app-src=labels backend/web=release.json=marcador sw.js, containers running, HTTPS health/home200 e asset Home público200. Saúde JSONok na consulta2026-10-07T20:56:18Z. A meta reconfirmou diretamente por gh run view os workflows master37683834440 e VPS37684732132: ambos completed/success, headSha516b654c335d820b588357b137742531852a8fd8, sessão55333exit0. Não reproduziu SSH; usa essa parte como evidência independente do verificador de integração, sem atribuir execução própria.

Rubrica operacional: identidade fonte/runtime9,5; regressão e CI vinculados9,0; disponibilidade e entrega9,0; segurança/limites9,0; rastreabilidade/destino9,25. Média uniforme9,15. Zero falha crítica operacional observada. Qualidade de UI do produto não recebe nota nova por healthcheck. Dois diferenciais extraordinários: prova cruza a fonte efetivamente compilada, os dois runtimes e o service worker, evitando confundir checkout legado com release real; asset Home entregue por HTTPS e CI do SHA publicado impedem confundir serviço vivo com pacote correto. A prova cobre atualização operacional concreta, excedendo um mero workflow verde.

**PUBLICADO — RELEASE CORRETIVA OPERACIONAL CONCLUÍDA. UI humana em produção NÃO VERIFICADA; QA total permanece aberto.** CUA indisponível é limite instrumental registrado, não evidência de aprovação visual nem defeito confirmado do produto. Cadastro integral, login/logout legítimos, jornadas completas, PostgreSQL/provedor real e demais casos não executados da matriz mantêm seus estados. Visual8,1 é local e delimitado, nunca promovido a produção. A versão publicada não deve ser redeployada para publicar somente esta documentação.

Destino: root registra mensagem PASS delimitada via CLI do contrato total, sem alterar seus papéis para PASS global, sem meta-approve global/reset. Evidências/estado documental devem receber commit e push escopados na branch existente, sem merge master e preservando SHA de produção acima. Esta meta não escreveu Git, não operou VPS e não aprovou o próprio código. Próxima ação futura: recuperar CUA e reverificação humana da versão publicada nos casos abertos, em vez de reconstruir/deployar novamente sem mudança.
