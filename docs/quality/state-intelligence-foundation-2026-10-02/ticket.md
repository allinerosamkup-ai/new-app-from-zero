# AIRIA-SI-01 — Persistência independente da análise

Data: 2026-10-02. Titular: “DIVIDIR DOSSIE E PLANO TECNICOO EM TAREFAS E COMECAR A IMPLEMENTAR”. Base `a20500d`; branch `codex/state-intelligence-foundation-2026-10-02`; checkout principal existente. Coordenador: root; executor e revisores independentes atribuídos via handoff.

## Comportamento esperado

Quando a Airia já salvou humor/energia/contexto e a análise falha, a pessoa recebe confirmação real do registro, aviso de análise indisponível e segurança proporcional. Não vê erro que sugira perda do registro, análise antiga ou orientação simulada. Falha de escrita continua erro real. Retry/readback não duplica nem esquece risco.

## Escopo

Primeira fatia do backlog. Reusar CheckinApplicationService, contratos, riskSafety, telas de resultado/consumidores e idiomas existentes. Não reescrever fases, criar scores, migrar banco, coletar saúde/Diário adicional, implementar sensores/rituais ou publicar. Sem alteração de constituição ou destinos desligados.

## Aceite antes do código

- [x] Reproduzir o problema atual com teste que falha na versão anterior (`a20500d` isolada, RED executado).
- [x] Erro de avaliação depois da escrita retorna recibo persistido + estado explícito indisponível, sem mensagem bruta/segreto.
- [x] Atualização no mesmo slot limpa derivação antiga; idempotência/readback mantêm fonte e estado correto.
- [x] Segurança pode ser obtida sem depender da IA; crise/apoio humano não somem em falha da interpretação.
- [x] Falha de escrita não retorna persisted; erro de persistência da avaliação não produz falso status definitivo.
- [x] Contratos e consumidores recebem distinção salva/analise indisponível, PT/EN; sem instruções de implementação na UI (código/testes; prova de tela ainda no item seguinte).
- [x] Prova integrada da entrada à resposta/UI e readback com ambiente isolado/fixtures declaradas, sem conta ou banco privado; parecer integração PASS 9,2 em 2026-10-05.
- [x] Testes focados, regressão proporcional, builds dos apps alterados; verificador 9,30, integração 9,2, meta 9,25; commit de implementação 72f206f e fechamento/handoff nesta branch.

## Busca e reuso

Consultados antes de código: dossiê/plano/constituição/protocolo; git status/worktrees/branches e histórico de CheckinApplicationService (`fdb8f02`, `6b0cc5e`, `10b4417`); serviço/contratos/tests atuais e consumidores Check-in/Aura/resultado. Escolher adaptação do serviço existente e JSON aiState compatível; não nova dependência/migração. Busca em docs/memória não autoriza usar snapshot aprovado do dossiê para aprovar implementação.

## Gates e destino

Branch proprietária e checkout existentes, sem worktree adicional. Commit local autorizado pelo pedido/protocolo; sem push/merge/deploy. Notion sem ferramenta disponível, backlog local explícito. Documentar qualquer limitação de browser/IA real; fixture isolada não valida provedor ou produção. Estado inicial: EM_EXECUÇÃO.

Estado final 2026-10-05: DONE LOCAL autorizado pelo meta independente, restrito SI-01 e decomposição em tarefas. Snapshot protocol-final.json. Nenhuma direção/sensor/eficácia/produção aprovado. Fixture encerrado; branch HANDOFF para SI-02–SI-15.
