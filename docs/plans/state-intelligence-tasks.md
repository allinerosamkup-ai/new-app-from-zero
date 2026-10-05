# State Intelligence — tarefas executáveis

Pedido de execução: 2026-10-02. Fontes: [dossiê](../product/state-intelligence/README.md) e [plano técnico](2026-10-02-state-intelligence.md). Branch inicial: `codex/state-intelligence-foundation-2026-10-02`, base `a20500d`. Não há autorização de merge/deploy. Planejador, Rotinas, Hábitos, Pomodoro, Agenda e Corrida excluídos.

Cada tarefa é uma fatia de comportamento verificável com executor, verificador, integração e meta separados. Código escrito não muda status para DONE; dependências e validações reais prevalecem. Não há conector Notion disponível neste ambiente: este arquivo é o backlog operacional persistido no projeto, sem alegar sincronização externa.

| ID | Tarefa e resultado observável | Dependência | Aceite principal | Estado |
|---|---|---|---|---|
| SI-01 | Check-in salvo apesar de análise indisponível, com aviso explícito e risco preservado | Nenhuma; reusar contrato atual | Falha de avaliação não vira falha/sucesso falso de escrita; sem análise antiga; reload/idempotência; PT/EN e consumidores consistentes | DONE LOCAL 2026-10-05; meta 9,25; sem publicação |
| SI-02 | Reconciliar fases, baseline e janelas entre motor/constituição | Auditoria do dossiê | Decisão sobre divergência documentada; cálculo compartilhado/regressões; não mapear fases em níveis espirituais | PLANEJADA; decisão de comportamento antes do código |
| SI-03 | Observações versionadas com fonte, momento, ausência e lineage | SI-01 | Relatado/inferido/medido/interpretativo distintos; correção invalida derivados; API compatível | PLANEJADA |
| SI-04 | Segurança contextual impede amplificar aceleração e impulsividade | SI-01, critérios de segurança | Energia alta com pouco sono não expande carga; risco humano/crise prevalece; negação/citação/contexto sem diagnóstico | PLANEJADA |
| SI-05 | Preferências e consentimentos por finalidade, revogáveis | SI-03 | Prático default; espiritual opcional; inferência Diário e saúde separados; jobs/export/delete atualizados | PLANEJADA |
| SI-06 | Airia propõe estado-alvo ligado ao objetivo; pessoa confirma/corrige/veta | SI-03, SI-05 | Nada de valores inventados; versões/concorrência; objetivo antigo continua válido | PLANEJADA |
| SI-07 | Uma direção contextual e proposta real compartilhadas | SI-02–SI-06 | Acolher/Regular/Alinhar/Expandir explicáveis; insuficiência; sem score/garantia; mesmo dado nas superfícies | PLANEJADA |
| SI-08 | Experiência autoral opcional em Aura/Diário, saída livre | SI-04–SI-07 | Opção secular útil; sem mapa/RH/copy proibida; começar/interromper com recibo; sem tarefa automática | PLANEJADA |
| SI-09 | Episódio antes/depois com snapshots imutáveis e efeito neutro/piora | SI-03, SI-08 | Cache diário não sobrescreve pre; máscara/escala/alvo iguais; post opcional; revogação/exclusão efetivas | PLANEJADA |
| SI-10 | Resultado separado e próximo passo confirmado | SI-09 | Interno/comportamental/externo/sincronicidade separados; contraprovas preservadas; ações rejeitadas não ressuscitam | PLANEJADA |
| SI-11 | Home/Check-in/Insights integrados e acessíveis | SI-07–SI-10 | Fluxo autenticado, reload/erro/retry, PT/EN, dimensões alvo e acessibilidade; baixa energia/pessoa nova | PLANEJADA |
| SI-12 | Piloto de utilidade compara direções com orientação atual | SI-11 | Protocolo, ética/consentimento, métricas/amostra/parada definidos antes de pessoas; não somente satisfação | PLANEJADA; gate de pesquisa |
| SI-13 | Health Connect sem zeros inventados e origem/janela correta | SI-03, SI-05 | Permissão parcial, missing/paginação/dedupe, timestamps; coleta real em Android; RMSSD≠SDNN | PLANEJADA; validação em aparelho |
| SI-14 | Experimento PPG isolado e eventual HealthKit | SI-03, SI-05 | Referência fisiológica, qualidade/erro por aparelho, direitos/protocolo, sem obrigar sensor ou liberar antes de validar | PLANEJADA; gates físicos/éticos |
| SI-15 | Associações pessoais e seleção de experiências seguras | SI-09–SI-12 | Evidências verificadas, validação temporal, negativos incluídos, limites de amostra/precisão; sem causalidade externa | PLANEJADA; gate estatístico |

## Primeira entrega

SI-01 remove uma falha de fundamento: persistência do sinal não pode depender de disponibilidade de interpretação. A mudança não substitui IA por orientação determinística fingindo IA. Mantém o registro real, informa indisponibilidade e conserva segurança; continua sem novos scores/sensores ou ritual consumidor.

Contrato e evidências: [ticket SI-01](../quality/state-intelligence-foundation-2026-10-02/ticket.md). Próximas tarefas não são automaticamente consideradas aprovadas pela aprovação do dossiê. Busca de reuso e destino operacional são registrados por tarefa; nenhum código experimental fica solto.

Fechamento: commit de implementação `72f206f`; verificador 9,30, integração 9,2 e [meta 9,25](../quality/state-intelligence-foundation-2026-10-02/meta-review.md). Testes e UI local com dados sintéticos, sem validação de banco/provedor/produção. Próxima fatia: SI-02, reconciliar fases/baseline/janelas antes do núcleo novo; SI-03 acompanha proveniência e histórico imutável. Demais 14 tarefas permanecem planejadas.

## Cobertura do dossiê e ordem de execução

O dossiê e o plano técnico estão concluídos como documentação, com [parecer independente](../quality/state-intelligence-2026-10-02/meta-review.md). A coluna seguinte indica o destino da implementação, não funcionalidade pronta.

| Entregável do dossiê | Tarefas que o tornam comportamento verificável |
|---|---|
| 1. Pesquisa e fontes | SI-12, SI-14, SI-15; fonte/hipótese preservadas em cada ticket |
| 2. Dicionário de constructos | SI-02, SI-03, SI-07 |
| 3. Matriz de medição | SI-03, SI-13, SI-14 |
| 4. Especificação de cálculo | SI-02, SI-09, SI-15 |
| 5. Modelo de confiança | SI-03, SI-07, SI-15 |
| 6. Estado-alvo por objetivo | SI-06 |
| 7. Matriz de intervenções | SI-04, SI-07, SI-08 |
| 8. Protocolo antes/depois | SI-09 |
| 9. Personalização | SI-05, SI-15 |
| 10. Resultados e sincronicidades relatadas | SI-10 |
| 11. Fluxo de experiência | SI-01, SI-06–SI-11 |
| 12. Privacidade, direitos e comunicação | SI-03–SI-05, SI-08, SI-12–SI-15 |
| 13. Escopo mínimo | SI-01–SI-11; liberação somente após integração e meta |
| 14. Plano técnico | Este backlog e os tickets/evidências de cada fatia |

**Ordem:** terminar SI-01 com prova integrada; resolver SI-02 e o contrato de SI-03; avançar segurança/consentimento antes de alvo/direção; depois experiência, episódios, resultados e integração. Piloto e sensores são trilhas com gates próprios. Nenhuma fase exige implementar vinte scores. Cada próxima fatia recebe ticket antes do código e autorização de conclusão própria; este pedido autoriza começar a implementação, não publicar nem validar experiências humanas por simulação.
