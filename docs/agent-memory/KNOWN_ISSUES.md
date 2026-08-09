# KNOWN_ISSUES — problemas conhecidos ainda abertos

> Camada C. Só problema **ainda relevante**. Item resolvido sai daqui — este
> arquivo não é depósito de bug antigo. Se virar histórico, ele deixa de ser lido.

Formato de cada item: sintoma, causa, status, contorno, arquivos, e o que **não**
confundir com isso.

---

## 1. A suíte do backend imprime erro de runtime e ainda retorna exit 0

### Sintoma
`npm run test -w apps/backend` termina com `EXIT=0` depois de imprimir, entre
outros:

```
[micro-step] AI generation failed: TypeError: prisma.timelineBlock.update is not a function   (4x)
Error: TypeError: Cannot read properties of undefined (reading 'findFirst')                   (2x)
```

### Causa
**HIPÓTESE, não confirmada.** O stub de Prisma usado por esses testes
provavelmente não implementa `timelineBlock.update` nem o model consultado por
`findFirst`, e o caminho de erro é engolido por um `catch` que só registra log.
O teste segue verde porque a asserção não cobre esse ramo.

Parte do ruído da suíte **é intencional** e não deve ser confundida: `Error:
offline`, `"isso não é JSON" is not valid JSON`, `feedback unavailable` são
testes de caminho de erro.

### Status
**Aberto, não diagnosticado.** Ninguém investigou a fundo.

### Contorno
Ler o log, não só o exit code. Ao mexer em `timeline`, micro-steps ou geração de
ação, tratar essas linhas como sinal e verificar se o ramo está mesmo coberto.

### Arquivos relacionados
`apps/backend/src/index.ts:4405` (micro-step), `src/index.timeline.test.ts`,
`src/index.onboarding.test.ts`.

### Não confundir com
Falha de conexão real com o banco — os testes não tocam Postgres, usam stub.

---

## 2. Credenciais reais versionadas em `.claude/settings.local.json`

### Sintoma
O arquivo está rastreado pelo git (`git ls-files .claude`) e traz, dentro de
`permissions.allow`, um `EXPO_TOKEN` e a senha do Postgres/Supabase em texto puro.

### Causa
Entradas de permissão foram gravadas com o comando literal completo, segredo
incluído.

### Status
**Aberto.** Fora do escopo da tarefa que descobriu isso; existe tarefa em
segundo plano proposta para rotacionar e remover.

### Contorno
Nenhum. Rotação das credenciais é obrigatória — o segredo permanece no histórico
do git mesmo depois de removido do HEAD.

### Não confundir com
Problema de configuração de permissão do Claude Code. As permissões funcionam; o
problema é o conteúdo delas.

---

## 3. Worktrees existentes sem inventário completo de proprietário

### Sintoma
Há várias cópias e branches de trabalho no repositório, incluindo entradas em
`.worktrees/`, `.claude/worktrees/` e `C:\Users\allin\.codex\worktrees`. Sem um
inventário de dono e estado, um agente pode duplicar tarefa, ignorar commit de
outra cópia ou deixar trabalho pronto sem integração.

### Causa
Worktrees foram criados por sessões e agentes diferentes sem um ciclo comum de
registro, handoff, commit e remoção.

### Status
**Aberto.** A auditoria de 2026-08-09 encontrou 24 entradas em
`git worktree list --porcelain`. Nenhuma foi removida automaticamente porque a
propriedade e o valor de cada branch ainda precisam ser confirmados.

### Contorno
Consultar `docs/agent-memory/WORKTREES.md` e executar `git worktree list
--porcelain` antes de criar outra cópia. Não usar `git worktree prune` como faxina
cega.

### Arquivos relacionados
`docs/DEVELOPMENT_ITERATION_PROTOCOL.md` §22,
`docs/agent-memory/WORKTREES.md`, `docs/agent-memory/CURRENT_STATE.md`.

### Não confundir com
Uma branch antiga que já foi integrada: confirme com `git log` e `git diff`, não
apague apenas pela idade do nome.
