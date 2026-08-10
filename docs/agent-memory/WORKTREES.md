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

## Auditoria inicial — 2026-08-09

`git worktree list --porcelain` encontrou 24 entradas. A lista abaixo é um
inventário inicial para impedir que fiquem invisíveis; ela não substitui o
comando Git e cada linha precisa receber dono/estado antes de ser reutilizada ou
removida.

| Caminho | Branch/HEAD | Estado | Próxima ação |
|---|---|---|---|
| `C:\Users\allin\Projetos\Apps\new-app-fron-zero` | `master` / `1cc869f` | `ACTIVE` | usar como base atual |
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
| `.worktrees/repair-checkin` | `codex/checkin-contextual-repair` / `13cc358` | `AUDIT_PENDING` | identificar dono |
| `.worktrees/repair-goals` | `codex/goals-legacy-recovery` / `282f557` | `AUDIT_PENDING` | identificar dono |
| `.worktrees/repair-pwa` | `codex/pwa-release-repair` / `b351128` | `AUDIT_PENDING` | identificar dono |
| `.worktrees/repair-voice` | `codex/voice-overlap-repair` / `4ef1d04` | `AUDIT_PENDING` | identificar dono |
| `.worktrees/routine-builder` | `codex/routine-builder` / `59778e5` | `AUDIT_PENDING` | identificar dono |
| `.worktrees/onboarding-stripe-partners` | `codex/onboarding-stripe-partners` / `6512a7f` | `BLOCKED` | Codex: código Tasks 1–11 verificado; mesmo após instalar o plugin, a leitura oficial ainda exige reautenticação OAuth do conector Stripe. Configurar live quando houver canal autenticado operável; migração/deploy seguem sem autorização |

Nenhuma entrada acima deve ser removida automaticamente. A limpeza é uma tarefa
separada: revisar status/diff, confirmar que não há commit único, integrar ou
descartar conscientemente, remover a cópia e atualizar esta tabela para
`CLOSED`.
