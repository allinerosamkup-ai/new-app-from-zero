# Matriz de aceite provisória — 2026-10-06

Compilada pelo meta independente a partir de `browser-evidence.md`, pareceres e handoff do coordenador. Não é nova execução do navegador. Produção antiga: SHA 7a2acc9. Harness corrigido: fonte local sem commit final, autenticação/repositório/IA sintéticos. PASS parcial significa subpasso observado, **não PASS do caso inteiro**. Aceite humano “aprovado integralmente/pass” registrado; mínimo visual 8 mantido.

| Caso | Estado do caso completo | Evidência e lacuna |
|---|---|---|
| AUTH-01 | NÃO_EXECUTADO | Privacidade pública abriu; alternância anônima/rotas protegidas/retorno não comprovados |
| AUTH-02 | NÃO_EXECUTADO | Testes técnicos de login não substituem validação humana de credenciais/Enter |
| AUTH-03 | BLOCKED | Identidade de cadastro e confirmação legítima indisponíveis; não aceitar termos por inferência |
| AUTH-04 | BLOCKED | Sessão preexistente observada; login válido e lembrar não executados |
| AUTH-05 | BLOCKED | Link legítimo/reset não disponíveis; não alterar senha real |
| ONB-01 | NÃO_EXECUTADO | Rerun em conta existente não representa conta nova autenticada |
| ONB-02 | FAIL | Rerun produção mostrou conclusão sem novo objetivo após reload; patch técnico ainda exige repetição UI |
| ONB-03 | NÃO_EXECUTADO | Opcionais puderam ser omitidos; escolhas biológicas/retomada não comprovadas |
| HOME-01 | FAIL | Produção escondeu gráfico e ação no accordion; patch local tem subpassos observados, jornada final pendente |
| HOME-02 | NÃO_EXECUTADO | Vazio semanal com histórico antigo observado; sem-histórico/reload completo não comprovado |
| HOME-03 | FAIL | Abas e pontos reais observados em produção, acesso/legibilidade falharam; Mensal local um ponto e Week vazio são PASS parciais |
| HOME-04 | FAIL | Captura320 anterior recebeu6,4, utilities ausentes limitam diagnóstico; nova captura fiel e navegação completa pendentes |
| CHK-01 | PASS parcial | Registro real5/5, resposta e reload confirmados; unicidade/horário e histórico completo não auditados para PASS total |
| CHK-02 | NÃO_EXECUTADO | Nota enviada; edição/correção e não duplicação não executadas |
| CHK-03 | NÃO_EXECUTADO | Gate SI-01 anterior não é execução deste roteiro no diff final |
| CHK-04 | NÃO_EXECUTADO | Falha de escrita e recuperação não observadas nesta rodada |
| GOAL-01 | FAIL | Produção Confirmar400/order e modal coberto; harness novo criação+reload PASS parcial, cancelamento/caminho nested aguardam |
| GOAL-02 | NÃO_EXECUTADO | Conclusão de ação e concordância Home não executadas |
| GOAL-03 | NÃO_EXECUTADO | Nota/transformação/cancelamento não executados |
| GOAL-04 | NÃO_EXECUTADO | Edição/pausa/reagendamento/exclusão não comprovados |
| GOAL-05 | NÃO_EXECUTADO | Falha parcial/expansão/retry não observados humanamente |
| JOUR-01 | FAIL | Resposta e resumo em Anteriores após reload PASS parciais; reimportação repetida de nota em produção; patch ainda exige UI |
| JOUR-02 | NÃO_EXECUTADO | Streaming interrompido/mensagem longa/segurança não executados nesta rodada |
| INS-01 | PASS parcial | Insuficiência explícita e histórico antigo observados; padrão suficiente/coerência longitudinal incompletos |
| INS-02 | FAIL | Períodos mudam dados; cartão exibiu enum cru/zeros falsos, patch técnico sem repetição visual final |
| AURA-01 | PASS parcial | Mensagem neutra respondeu e persistiu; proposta operacional/confirmar ação não executadas |
| AURA-02 | NÃO_EXECUTADO | Correção/rejeição operacional e bloqueio de recriação não executados |
| AURA-03 | NÃO_EXECUTADO | Escrita textual/erro/streaming adversarial não executados |
| PREF-01 | FAIL | EN e reload persistiram; tabs/Presence PT em produção e oito superfícies não repetidas após patch |
| PREF-02 | PASS parcial | Dark persistiu e PT/Light restaurados; período quieto/preferência não sensível adicionais não comprovados |
| PREF-03 | FAIL | Privacidade pública referencia Planner/Google Calendar desligados; nenhuma ação destrutiva realizada |
| AUTH-06 | BLOCKED | Logout não executado para preservar sessão sem credencial legítima de reentrada |
| UI-01 | FAIL | Parecer visual parcial6,4 e oito superfícies finais incompletas |
| UI-02 | FAIL | EN/mobile com nav truncada e copy parcial; repetição final completa pendente |
| UI-03 | FAIL | Sobreposição320 na captura parcial; zoom200%/teclado virtual não executados |
| UI-04 | PASS parcial | Enter em Goal antigo; modal local cancelar restaura foco e hitTest correto; travessia geral/composers corrigidos pendentes |
| UI-05 | FAIL | Accordion perde expansão ao reload e nav cobriu modal antigos; readback objetivo local é PASS parcial |
| UI-06 | FAIL | Onboarding antigo falso salvo/Goals400 sem feedback; patch tem testes, erros UI finais pendentes |
| UI-07 | NÃO_EXECUTADO | Persona recorrente parcial; nova e pouca energia não percorridas integralmente |
| UI-08 | NÃO_APLICÁVEL parcial | Sensores/manifestação SI-02–SI-15 não implementados; ausência/erro da fundação ainda exigem casos isolados, não PASS |

Nenhum caso completo recebe PASS por inferência nesta matriz conservadora. Os FAIL descrevem a versão observada e ficam como histórico até reverificação identificada da correção; não atribuem defeito à build final sem prova. A integração pode atualizar esta matriz com artefato, versão, ambiente, readback e saída específicos. Aprovação manual não apaga os registros.

Destino: coordenador mantém task total aberta ou delimita explicitamente um pacote de correções validado. Publicação exige CI/revisão/versão correspondente; após deploy repetir observações do produto real. Não converter fixtures em validação de banco/provedor/cadastro.
