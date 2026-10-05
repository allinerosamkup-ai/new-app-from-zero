# AIRIA-SI-01 — Parecer independente de integração

Data: 2026-10-05. Papel: resume_integration, independente do executor. Decisão: **PASS**, nota **9,2/10** para o escopo local do ticket. Publicação não autorizada nem realizada.

## Evidência executada nesta retomada

Harness `integration-fixture.cjs`, somente 127.0.0.1:4190/4191, liga app Vite completo ao `createApp` compilado e `CheckinApplicationService` real. Autenticação e repositório em memória são sintéticos; avaliador lança falha controlada. A leitura canônica injetada contém uma decisão antiga proposital. Nenhum banco ou conta privada usado.

1. Formulário real PT: humor 5, energia 4, fator explicitamente ausente, nota sintética. Registrar levou a `/checkin-result`, com “Seu check-in está salvo” e aviso explícito “A análise está indisponível agora”. Reload manteve o recibo via GET. Evidência: `ui-pt-reload.txt` e `ui-pt-reload.png`.
2. Formulário real EN: humor 4, energia 3, mesma ausência explícita de fator. Save levou ao recibo “Your check-in is saved” e “Analysis is unavailable right now”. Sem proposta antiga. Evidência: `ui-en-result.txt` e `.png`.
3. Cenário de crise explicitamente sintético, interface EN, viewport 390×844: humor/energia 2 e texto reconhecido pelo detector existente. Registro continuou salvo/indisponível; cartão exibiu **CRISIS PROTOCOL**, mensagem de segurança e rótulos de sinais em inglês (“language indicating crisis or self-harm”, “very low mood and energy”). Reload manteve cartão e aviso. Evidência: `ui-en-crisis-mobile.txt/.png`, `ui-en-crisis-reload.txt/.png`. Viewport resetado após prova.
4. Readback independente de browser: `integration-live-readback-2026-10-05.json` contém três observações com notas/escores correspondentes, `analysisStatus=unavailable`, terceira com `riskSafety.route=crisis_protocol`; tráfego contém três POST `/api/checkins` e GET `/api/checkins?days=90`. Fonte registrada corresponde ao formulário, não somente estado transitório de tela.
5. Em todos os snapshots finais, marcador “STALE FIXTURE DECISION MUST NOT APPEAR” e controles de aceitação da decisão antiga ausentes. Núcleo renderizado: Hoje, Metas, Airia, Padrões, Diário; nenhum Planejador/Rotina. O cartão de segurança permanece visível apesar da análise indisponível. Localização recente do executor foi validada pelo texto EN final.

## Critérios e justificativa da nota

O resultado excede uma mensagem de erro melhorada: mantém contrato fonte → recibo → leitura após reload, desacopla segurança da avaliação que falhou e bloqueia a decisão velha intencionalmente adversarial. A combinação de formulário real, transportes reais da API, fonte independente e falha controlada torna a evidência reexecutável. A atenção à crise mobile e à localização dos sinais, preservada após nova leitura, justifica o caráter extraordinário dentro da primeira fatia. Não aprova as quinze tarefas do backlog.

## Limites e próxima ação

Os arquivos `ui-pt-reload.txt`, `ui-en-result.txt` e `ui-en-crisis-mobile.txt` podem conter metadados/deltas da API de acessibilidade, não árvores completas. Os PNGs e as strings observadas acima são a evidência primária desses estados; `ui-en-crisis-reload.txt` foi regravado com `disableDiffing: true`, contendo a árvore completa final. Não usar um delta vazio como prova de conteúdo.

PASS de integração local desta falha, sem alegar validação de Prisma/PostgreSQL, CAS operacional em banco, provedor de IA, eficácia clínica, sensores, produção ou dispositivo nativo. Repositório/auth/reading adjacente são fixtures declaradas; persistência dura aqui significa memória do servidor sobrevivendo ao reload do cliente. Não foram clicados contatos de emergência externos. Falha inicial de conexão foi resolvida iniciando harness; `visibility` não suportado no subagente foi resolvido omitindo opção. Testes/builds finais e meta-approve pertencem aos papéis correspondentes; coordenador deve cruzar esses gates antes de commit/DONE. Handoff: aceitar item integrado do ticket, conservar os limites e encaminhar ao meta-verificador.
