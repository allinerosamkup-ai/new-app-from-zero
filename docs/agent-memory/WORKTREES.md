# WORKTREES — inventário e ciclo de vida

> Memória operacional compartilhada por Codex/GPT, Claude Code e demais
> agentes. A fonte de verdade técnica é `git worktree list --porcelain`; esta
> página existe para registrar dono, intenção, estado e handoff.

## Estados permitidos

- `ACTIVE` — agente trabalhando agora.
- `HANDOFF` — pausa intencional com commit/handoff pronto.
- `BLOCKED` — impedimento real documentado em `CURRENT_STATE.md`.
- `READY_TO_MERGE` — mudança verificada e commitada, aguardando integração.
- `CLOSED` — integrada ou abandonada conscientemente; worktree removido.
- `AUDIT_PENDING` — entrada legada encontrada no inventário, sem proprietário
  confirmado; não reutilizar nem remover até auditar.

`UNKNOWN` e `ORPHANED` não são estados aceitáveis. Ao encontrar uma entrada
sem dono ou sem próxima ação, parar de criar cópias e fazer o inventário.

## Registro obrigatório

Cada worktree ativo deve ter uma linha com:

| Campo | Valor |
|---|---|
| Tarefa | objetivo curto |
| Dono/agente | sessão ou agente responsável |
| Branch | branch do worktree |
| Caminho | caminho absoluto |
| Estado | `ACTIVE`, `HANDOFF`, `BLOCKED` ou `READY_TO_MERGE` |
| Último commit | SHA e resumo |
| Verificação | última evidência real |
| Próxima ação | ação concreta |
| Atualizado em | data |

Antes de criar ou entrar em uma cópia, consultar:

```bash
git worktree list --porcelain
git status --short --branch
```

Não criar outra cópia para o mesmo objetivo sem registrar o motivo. Ao trocar
de agente, atualizar esta página e `CURRENT_STATE.md` antes de sair.

## Auditoria inicial — 2026-08-11

`git worktree list --porcelain` encontrou 25 entradas. A lista abaixo é um
inventário inicial para impedir que fiquem invisíveis; ela não substitui o
comando Git e cada linha precisa receber dono/estado antes de ser reutilizada ou
removida.

| Caminho | Branch/HEAD | Estado | Próxima ação |
|---|---|---|---|
| `C:\Users\allin\Projetos\Apps\new-app-fron-zero` | `master` / `1cc869f` | `ACTIVE` | usar como base atual |
| `.worktrees/objective-intelligence` | `codex/objective-intelligence` / `9396159` | `READY_TO_MERGE` | PR #10: IA real 10/12 + 11/11, backend 107 suítes, web 430 testes/build, migração validada com rollback e schema isolado, E2E autenticado persistente aprovado. Produção intacta; integrar somente com autorização |
| `C:\Users\allin\.codex\worktrees\5cd3\new-app-fron-zero` | detached / `4035e42` | `AUDIT_PENDING` | identificar dono |
| `C:\Users\allin\.codex\worktrees\6d3e\new-app-fron-zero` | detached / `aa9906d` | `AUDIT_PENDING` | identificar dono |
| `.claude/worktrees/adoring-perlman-c4c02a` | `work/intuitive-vps` / `8c42be1` | `AUDIT_PENDING` | identificar dono |
| `.claude/worktrees/agent-a387839b` | `worktree-agent-a387839b` / `4035e42` | `AUDIT_PENDING` | identificar dono |
| `.claude/worktrees/agent-a3a7478d` | `worktree-agent-a3a7478d` / `4035e42` | `AUDIT_PENDING` | identificar dono |
| `.claude/worktrees/agent-a552c7c2` | `worktree-agent-a552c7c2` / `4035e42` | `AUDIT_PENDING` | identificar dono |
| `.claude/worktrees/agent-a6c26fc0` | `worktree-agent-a6c26fc0` / `4035e42` | `AUDIT_PENDING` | identificar dono |
| `.claude/worktrees/agent-a85a35d0` | `worktree-agent-a85a35d0` / `4035e42` | `AUDIT_PENDING` | identificar dono |
| `.claude/worktrees/agent-ad05e5a1` | `worktree-agent-ad05e5a1` / `4035e42` | `AUDIT_PENDING` | identificar dono |
| `.claude/worktrees/agent-afdac1a9` | `worktree-agent-afdac1a9` / `4035e42` | `AUDIT_PENDING` | identificar dono |
| `.claude/worktrees/compassionate-poincare-6abd3a` | `claude/compassionate-poincare-6abd3a` / `4035e42` | `AUDIT_PENDING` | identificar dono |
| `.claude/worktrees/competent-swartz-8f1f90` | `claude/competent-swartz-8f1f90` / `4035e42` | `AUDIT_PENDING` | identificar dono |
| `.claude/worktrees/hungry-buck-bc7447` | `claude/hungry-buck-bc7447` / `ec82d30` | `AUDIT_PENDING` | identificar dono |
| `.claude/worktrees/mystifying-robinson-a17135` | `claude/mystifying-robinson-a17135` / `f243ba8` | `AUDIT_PENDING` | identificar dono |
| `.claude/worktrees/objective-lederberg-31b125` | `claude/objective-lederberg-31b125` / `4035e42` | `AUDIT_PENDING` | identificar dono |
| `.worktrees/airia-command-integration` | `codex/airia-command-integration` / `5580d17` | `AUDIT_PENDING` | identificar dono |
| `.worktrees/airia-integrated-checkin` | `codex/airia-integrated-checkin` / `34ce3c2` | `AUDIT_PENDING` | identificar dono |
| `.worktrees/airia-orbital-mascot` | `codex/airia-orbital-mascot` / `a1dd8e3` | `AUDIT_PENDING` | identificar dono |
| `.worktrees/onboarding-stripe-partners` | `codex/onboarding-stripe-partners` / `edc7844` | `AUDIT_PENDING` | identificar dono |
| `.worktrees/repair-checkin` | `codex/checkin-contextual-repair` / `13cc358` | `AUDIT_PENDING` | identificar dono |
| `.worktrees/repair-goals` | `codex/goals-legacy-recovery` / `282f557` | `AUDIT_PENDING` | identificar dono |
| `.worktrees/repair-pwa` | `codex/pwa-release-repair` / `b351128` | `AUDIT_PENDING` | identificar dono |
| `.worktrees/repair-voice` | `codex/voice-overlap-repair` / `4ef1d04` | `AUDIT_PENDING` | identificar dono |
| `.worktrees/routine-builder` | `codex/routine-builder` / `59778e5` | `AUDIT_PENDING` | identificar dono |
| `.worktrees/onboarding-stripe-partners` | `codex/onboarding-stripe-partners` / `a73c2b4` | `READY_TO_MERGE` | Codex: código e Stripe live configurados; 102 suítes backend, 56 arquivos/423 testes web, typecheck e builds aprovados. Integrar no `master`, publicar, validar três Checkouts sem cobrança e registrar o bloqueio cadastral de pagamentos/repasses da Stripe |
| `.worktrees/onboarding-stripe-partners` | `codex/cakto-billing` / `85e73a8` | `INTEGRATION_PASS` | Codex: migração Cakto isolada sobre `origin/master`; 109 suítes backend, 57 arquivos/435 testes web e todos os builds aprovados. Aguardar meta-verificação, publicação e validação live; cadastro financeiro Cakto ainda depende da titular |

## Retomada da sessão Codex — 2026-08-14

| Campo | Valor |
|---|---|
| Tarefa | finalizar a migração de cobrança para Cakto começada no Codex |
| Dono/agente | Claude Code, sessão remota (container efêmero, sem worktree extra) |
| Branch | `claude/codex-session-finalize-n3oeqy` |
| Caminho | `/home/user/new-app-from-zero` (checkout único da sessão) |
| Estado | `BLOCKED` — código verificado; falta cadastro Cakto e autorização de produção |
| Último commit | ver `git log -1`; parte de `39b3813` (`codex/cakto-billing`) sem rebase |
| Verificação | backend 109 suítes, web 57 arquivos/436 testes, builds e typecheck PASS em 2026-08-14 |
| Próxima ação | aplicar migrações e publicar quando houver segredo e cadastro; então E2E de compra |
| Atualizado em | 2026-08-14 |

`codex/cakto-billing` continua publicada e intocada no remoto: esta sessão
avançou por cima dela, não no lugar dela.

Nenhuma entrada acima deve ser removida automaticamente. A limpeza é uma tarefa
separada: revisar status/diff, confirmar que não há commit único, integrar ou
descartar conscientemente, remover a cópia e atualizar esta tabela para
`CLOSED`.

## 2026-10-02 — AIRIA-SI-20261002 (checkout existente)
| Campo | Valor |
|---|---|
| Tarefa | Dossiê de pesquisa State Intelligence; somente documentação |
| Dono | Codex coordenador, executores ciência/referências e revisores independentes |
| Branch | codex/state-intelligence-dossier-2026-10-02 |
| Caminho | C:/Users/allin/Projetos/Apps/new-app-fron-zero |
| Estado | HANDOFF documental; gate meta final registrado nos pareceres |
| Base | 5dcf2ad |
| Verificação | docs/quality/state-intelligence-2026-10-02/verification.md e pareceres |
| Último commit de entrega | fb806ce; registro final em commit de fechamento subsequente |
| Próxima ação | Consultar/revisar dossiê nesta branch; implementação exige novo ticket; sem push/merge/deploy |
| Destino | Reutilizar esta branch para consultar/revisar o dossiê, sem criar outra worktree |

Nenhuma nova worktree física criada. Inventário Git consultado antes da escolha; alterações alheias listadas em verification.md permanecem fora da tarefa.

## 2026-10-02 — AIRIA-SI-01 (primeiro fundamento)

Branch `codex/state-intelligence-foundation-2026-10-02`, base `a20500d`, checkout principal `C:/Users/allin/Projetos/Apps/new-app-fron-zero`. Dono: coordenador root; retomada com resume_executor, resume_integration e resume_meta; verificador técnico foundation_verifier. Estado: HANDOFF, gates finais em 2026-10-05. Sem nova worktree física; inventário Git consultado, dossiê preservado na branch anterior. Destino: entrega local commitada nesta branch, meta antes de DONE, próximos itens em `docs/plans/state-intelligence-tasks.md`; sem push, merge ou deploy. Mudanças alheias permanecem fora desta tarefa.

SI-01 DONE LOCAL após meta 9,25 em 2026-10-05; implementação72f206f, aprovação em commit de fechamento subsequente. Fixture de validação encerrado; scripts e artefatos preservados na branch. HANDOFF válido para SI-02/SI-03, sem recriar checkout ou herdar aprovação para novo escopo.

## 2026-10-05 — AIRIA-SI-01-RELEASE

Mesmo checkout principal e branch codex/state-intelligence-foundation-2026-10-02, base de publicação ab5f5ae. Estado ACTIVE. Dono root/release_executor com release_review e release_meta independentes. Destino: PR/CI → master → Deploy VPS SHA exato por autorização da titular neste turno. Sem nova worktree; inventário consultado no início. Arquivos alheios preservados. Registros em docs/quality/state-intelligence-release-2026-10-05; fechar com commit/snapshot e handoff da release verificada.

Fechamento release: estado BLOCKED para verificação UI; operação de publicação concluída master/VPS7a2acc9, PR21 integrado. Mesmo checkout/branch, sem cópia física nova. Destino das evidências: commit/push suplementar codex/state-intelligence-foundation-2026-10-02; não integrado em master para evitar alterar versão validada só por documentos. Handoff persistido no ticket release; retomar browser visual obrigatório antes de DONE. Não remover branch/arquivos alheios.

Decisão posterior: bloqueio de fechamento resolvido por dispensa humana explícita; meta aprovou publicação operacional9,15. Estado HANDOFF, sem nova worktree. Branch existente mantém registros suplementares publicados; implementação integrada em master7a2acc9. Próxima ação SI-02/SI-03 conforme novo ticket; UI/auth não verificados são limites preservados, não prova obtida.

2026-10-05 AIRIA-BROWSER-TOTAL: branch codex/browser-total-2026-10-05, mesmo checkout principal, base5800901. InventárioGit consultado, semworktree físico novo. Donoroot/executoreshome_chart_diagnosis e release_executor, auditorrelease_meta. EstadoACTIVE. Destino correções e evidência comcommit restrito/PR, CI e nova confirmação browser; autorização de publicação da sessão GitHub/VPS cobre correções concretas da atualização atual, não outros PRs/sensores. Dados teste e alterações alheias preservados. Não herdar metaaprovação anterior.
