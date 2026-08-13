# VERIFICATION — como se verifica coisa neste repositório

> Camada A. Comandos reais, custo real, e as verificações que **parecem** válidas
> mas produzem falso positivo. Consulte antes de escolher como provar uma
> mudança. O protocolo que diz *quando* usar cada uma é
> `docs/DEVELOPMENT_ITERATION_PROTOCOL.md`.

Para mudanças de produto, UX, IA ou fluxo, a verificação semântica também deve
consultar `docs/product/PRODUCT_CONSTITUTION.md`. Confirmar que a Airia
interpretou o contexto e fez uma proposta concreta; uma tela que apenas coleta
classificações e devolve a decisão para a pessoa é `PRODUCT FAIL`.

Tempos medidos em máquina local Windows, **2026-08-09**.

---

## Tabela de custo

| Comando | Tempo | O que prova |
|---|---|---|
| `npx ts-node-transpile-only apps/backend/src/<x>.test.ts` | **~2,5s** | um arquivo de teste backend |
| `npx vitest run <arquivo> --root apps/web` | ~5s | um arquivo de teste web |
| `npm run typecheck -w apps/web` | ~18s | tipos do frontend |
| `npm run test -w apps/web` | ~29s | suítes `apps/web/src/**/*.test.ts(x)` descobertas pelo Vitest |
| `npm run build -w apps/backend` | ~30s | tipos do backend (é o `tsc`) |
| `npm run test -w apps/backend` | **~1m28s** | todas as suítes `src/**/*.test.ts`, descobertas pelo runner |
| `npm run build -w apps/web` | ~1min | bundle de produção |
| `npm run aura:eval -w apps/backend` | minutos + custo de API | qualidade semântica da Aura |
| `npm run ai:smoke -w apps/backend` | minutos + custo de API | formato de saída em todas as superfícies |

O laço rápido durante a implementação é **teste único** (2,5s). A suíte inteira
fica para o fim.

---

## Backend: o runner descobre as suítes

`apps/backend/package.json` → `test` chama
`apps/backend/scripts/run-tests.mjs`. O runner descobre todos os arquivos
`src/**/*.test.ts`, ordena a lista, executa cada suíte em processo próprio e
continua até o fim para mostrar todas as falhas. Teste novo entra
automaticamente; não existe mais lista manual para atualizar.

```bash
npm run test -w apps/backend
```

O exit code continua sendo necessário, mas não suficiente: alguns testes de
caminho de erro imprimem stack trace intencional ou revelam stubs incompletos.
Leia o relatório final e o log entre as suítes.

**Web:** Vitest também descobre `apps/web/src/**/*.test.ts(x)` sozinho.

---

## Falsos positivos conhecidos

### 1. `tsc` e `vite build` não detectam token CSS inexistente
`var(--token-que-nao-existe)` **invalida a declaração inteira em silêncio**. Não
é erro de build nem de tipo. O sintoma é visual: texto que some, botão branco no
branco.

Guarda: `apps/web/src/styles/css-tokens.test.ts` (roda no `npm run test -w apps/web`).
Varre só o CSS efetivamente importado (`styles/main.css` e `index.css` são folhas
órfãs e ficam de fora de propósito).

**Depois de mexer em cor ou estilo, olhe a tela.** Não confie no build.

### 2. A suíte do backend imprime erro e mesmo assim retorna exit 0
A execução de `npm run test -w apps/backend` cospe stack traces no meio e termina
com sucesso. Parte é intencional (teste de caminho de erro: `Error: offline`,
`"isso não é JSON"`, `feedback unavailable`). Parte **não parece** intencional
— ver `KNOWN_ISSUES.md`.

**Consequência:** "exit 0" não é leitura suficiente. Passe o olho no log.

### 3. Build passando não é app funcionando
A CI roda build + typecheck + testes e nunca abre o navegador. Não existe E2E
versionado. Toda prova de comportamento de tela é manual, via preview ou
Playwright MCP.

### 4. Resposta 200 da IA não é resposta certa
Schema válido, JSON parseado e status 200 não dizem nada sobre a saída ser
coerente com o que a usuária pediu. Ver §8 do protocolo.

### 5. Recarregar a página não prova persistência no banco
Parte do estado vive em `localStorage` (`gtd-inbox-v1`, sessão do
routine-builder). Para provar banco: Prisma Studio ou Supabase MCP `execute_sql`.

### 6. Service worker do PWA serve versão antiga
Comportamento estranho depois de deploy ou de mudança de build costuma ser
cache do SW, não o código. Testar em aba limpa antes de investigar a fundo.

---

## Verificação de navegador

Não há Playwright instalado como dependência. As duas rotas disponíveis:

1. **Preview do app** (preferida para o dev server): `preview_start {name: "web"}`
   + `read_page`, `computer`, `read_console_messages`, `preview_logs`,
   `read_network_requests`, `resize_window`.
2. **Playwright MCP** (`mcp__playwright__*`): útil para navegação em produção
   (`https://airia.pro`) e screenshot.

O breakpoint que importa é **mobile** — o produto é PWA mobile-first. Depois de
`resize_window` com preset mobile, **recarregue**: há gates que rodam no load.

Dados de teste: o app exige sessão Supabase autenticada. Sem login não há home,
objetivo nem check-in — planeje isso antes de prometer verificação de fluxo.

---

## Verificação de IA

| Ferramenta | Quando |
|---|---|
| `npm run aura:eval -w apps/backend` | mexeu em `aura-prompt.ts` ou em política de domínio |
| `npm run ai:smoke -w apps/backend` | trocou de modelo — testa **todas** as superfícies |
| `npm run ai:judge-bench -w apps/backend` | escolhendo modelo validador |
| `src/lib/model-consistency.test.ts` | trava modelo divergente entre pontas |

Fixtures de avaliação: `apps/backend/src/lib/aura-eval/cases.ts`.
Invariantes disponíveis em `matchers.ts`: `mustInclude`, `mustNotInclude`,
`mustNotEndWithQuestion`, `mustEndWithQuestionOrCallToAction`,
`maxSentences`/`minSentences`, `mustReferenceAnchorFromContext`.

Critério de passagem: `AURA_EVAL_PASS_THRESHOLD` (padrão 10 de 12).

**Prefira vários invariantes baratos a um julgamento subjetivo grande.**
Quando um bug semântico real for encontrado no produto, ele vira caso aqui —
descrevendo comportamento esperado e proibido, nunca texto idêntico.

Ambos exigem `OPENAI_API_KEY`. Sem a chave, isso é bloqueio legítimo — declare,
não simule.

---

## Verificação de banco

```bash
npm run generate -w packages/database     # depois de mexer no schema; não precisa de DATABASE_URL
npm run db:studio                          # inspeção visual (porta 5555)
```

DDL de produção: Supabase MCP `apply_migration` (não precisa de `DATABASE_URL`),
sempre com RLS + policy + trigger. Depois, confirmar com `execute_sql` que a
tabela existe.

Testes que guardam o alinhamento: `src/contracts/schema-alignment.test.ts` e
`src/contracts/migration-chain-safety.test.ts`.

---

## Verificação de produção

```bash
curl -s https://airia.pro/api/health
curl -sI https://airia.pro/home
```

Regra de release (`AGENTS.md`): GitHub, VPS e produção no mesmo SHA, com
healthcheck público 200 nos dois endpoints.

## Verificação do contrato de subagentes e LLMs

O contrato operacional tem CLI e testes isolados. Eles não substituem a
verificação do produto; provam apenas que as barreiras de inicialização,
transição, comunicação e meta-aprovação estão funcionando.

```bash
node scripts/agent-protocol.mjs init --task-id <id> --objective "<objetivo>"
node scripts/agent-protocol.mjs role --role executor --agent <llm> --status assigned --evidence "Escopo recebido"
node scripts/agent-protocol.mjs meta-approve --score 8 --evidence "Notas e evidências conferidas"
node --test scripts/agent-protocol.test.mjs scripts/orchestration-guard.test.mjs
node --check .claude/hooks/orchestration-guard.mjs
node --check .claude/hooks/verification-guard.mjs
```

O estado em `.claude/.state/` é operacional e ignorado pelo Git. Handoffs
entre sessões, plataformas ou worktrees devem ir para `CURRENT_STATE.md` e
`WORKTREES.md`, com fato, evidência, decisão e próxima ação.

---

## Verificação de Git e worktrees

Antes de iniciar trabalho paralelo ou retomar uma tarefa:

```bash
git status --short --branch
git worktree list --porcelain
git branch --all --verbose --no-abbrev
```

Depois de uma troca de agente ou worktree, conferir `docs/agent-memory/WORKTREES.md`
e `CURRENT_STATE.md`. Antes de fechar, executar:

```bash
git diff --check
git status --short --branch
git log -1 --oneline
```

Um `M`, `A` ou `??` restante precisa ser commitado, removido conscientemente ou
explicado como bloqueio; o status não pode ser ignorado. `git worktree prune` só
é permitido depois de confirmar que o diretório ausente não contém trabalho
único e que nenhum branch/commit precisa ser preservado.

---

## Sequência padrão antes de fechar PR / deploy

```
1. testes focados do que mudou           (segundos)
2. typecheck web / build backend         (~20-30s cada)
3. npm run test -w apps/web              (~29s)
4. npm run test -w apps/backend          (~1m30s)
5. build web
6. fluxo real no navegador
7. skills/airia-pr-review/SKILL.md
8. commit → push → deploy → healthcheck
```
