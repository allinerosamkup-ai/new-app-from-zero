# Verificador independente — AIRIA-SI-01

Contexto: ticket da primeira implementação da State Intelligence; ramo `codex/state-intelligence-foundation-2026-10-02`. Executor separado; este papel não modifica código nem aprova sua própria entrega. Critérios: ticket, constituição e rubrica local. Estado inicial: revisão pendente, sem aprovação herdada do dossiê.

## Evidência de baseline

- `CheckinApplicationService.record` salva por `upsertBySlot` antes de `evaluate`, mas propagava erro de avaliação e de `updateEvaluation` como erro da operação inteira.
- `PrismaCheckinApplicationRepository.upsertBySlot` atualizava fonte mantendo `stateLabel`, `stateSummary` e `aiState` de registro anterior.
- `afterPersist` era chamado somente depois da avaliação gravada; no produtor real esse callback reconstrói `AiriaReading`. Falha de avaliação também precisa invalidar interpretação anterior.
- `command-checkin-receipt.ts` consumia somente identificador, scores e label/summary; avisos e segurança devem atravessar consumidores de Aura.

## Matriz adversarial para aprovação

1. Escrita rejeitada: rejeição real, nenhum recibo persistido.
2. Avaliação rejeitada após escrita: fonte recuperável, estado indisponível explícito, mensagem sanitizada.
3. Mesmo slot antes avaliado: fonte atual e derivados antigos eliminados inclusive em readback.
4. Retry idempotente: mesmo registro, ausência de duplicação, indisponibilidade e risco preservados.
5. Persistência da avaliação rejeitada: nenhuma declaração falsa de análise disponível; fonte permanece recuperável.
6. Crise e apoio humano: segurança obtida antes da interpretação e preservada em falhas/retry.
7. Falha no rebuild derivado: UI não apresenta leitura anterior como interpretação do sinal novo.
8. Caminho feliz e legados: contrato compatível e orientação atual preservada.
9. Tela/Aura PT/EN: salvo sem alegar compreensão quando indisponível; nenhuma mensagem técnica ou orientação fabricada.

Decisão: sem nota final até código, evidência independente e prova integrada. Findings enviados ao executor e coordenador; próxima ação: revisar diff e executar testes proporcionais quando entrega disponível. Fixture sintética não valida produção, provedor ou hardware.
