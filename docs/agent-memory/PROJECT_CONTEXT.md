# PROJECT_CONTEXT — memória permanente

> Camada A. Conhecimento estrutural que não deve ser redescoberto a cada tarefa.
> Muda pouco. **É cache, não fonte de verdade** — em conflito com o código,
> o código ganha e este arquivo é corrigido.

Última verificação contra o repositório: **2026-08-08**.

---

## O que é o produto

Assistente pessoal de ciclagem de humor, energia e agenda adaptativa. Não é
planner genérico, tracker menstrual nem chatbot terapêutico. Público: pessoas
com TDAH, ciclotimia, transtorno depressivo, bipolar tipo II e variações
hormonais. Identidade completa em `CLAUDE.md` e `AGENTS.md`.

Produção: **https://airia.pro** (VPS Hostinger, containers `airia_backend` +
`airia_web`). Branch de produção: `master`.

---

## Estrutura

```
apps/
  web/        React 18 + Vite + TS + Tailwind + Zustand   (ativo)
  backend/    Node + Express + TS + Prisma + OpenAI       (ativo)
  mobile/     React Native + Expo                          (pausado)
packages/
  database/   schema Prisma compartilhado
deploy/       Dockerfiles, compose, nginx, deploy.sh (VPS)
docs/         documentação; plans/ desenhos; product/ contratos
skills/       skills locais do projeto (ver skills/_registry.md)
```

npm workspaces. Sempre use `-w apps/web` / `-w apps/backend` / `-w packages/database`.

### Worktrees entram na revisão, sempre

`.worktrees/` e `.claude/worktrees/` guardam trabalho real que **não está na
master**. Buscar só em `apps/` e concluir "isso não existe" já custou uma
reconstrução do zero: o mascote Airia Orbital estava pronto e com a arte
aprovada em `.worktrees/airia-orbital-mascot`, e a varredura não olhou lá.

Antes de afirmar que algo não existe ou de começar a construir:

```bash
git worktree list
git log --oneline master..<branch-do-worktree>
```

Cuidado ao ler: várias branches parecem ter trabalho pendente e não têm — a
mensagem do commit bate com algo que já chegou à master por outro caminho.
`git diff --stat master...<branch>` é o que separa um caso do outro.

---

## Escopo ligado hoje

`apps/web/src/config/features.ts` é a chave única:

```ts
FEATURES = { planner: false, habits: false }
```

O app está reduzido ao núcleo: **check-in, objetivos, padrões, diário**.
Planner e Hábitos têm **código inteiro preservado** e rotas redirecionando para
`/home`. Religar é trocar `false` por `true`.

**Consequência para debugging:** existe código vivo que não está na tela. Antes
de investigar "por que essa tela não aparece", cheque `FEATURES`.

---

## Ambiente e portas

| Serviço | Porta | Como subir |
|---|---|---|
| backend | 3001 | `preview_start {name: "backend"}` |
| web | **5051** | `preview_start {name: "web"}` |
| mobile (Expo) | 8081 | `preview_start {name: "mobile"}` |
| Prisma Studio | 5555 | `preview_start {name: "prisma-studio"}` |

Definido em `.claude/launch.json`. **Nunca subir dev server pelo Bash.**

> FATO: a porta do web é 5051, definida em `apps/web/vite.config.ts`
> (`Number(process.env.PORT) || 5051`). O `CLAUDE.md` raiz dizia 5173 na seção
> "Como rodar" — corrigido em 2026-08-08.

Variáveis: `.env.example` na raiz. Backend precisa de `DATABASE_URL`,
`SUPABASE_JWT_SECRET`, `OPENAI_API_KEY`. Web precisa de `VITE_SUPABASE_URL` e
`VITE_SUPABASE_ANON_KEY`.

Runtimes locais confirmados: Node v25.6.1, Python 3.14.3, shell PowerShell 7 +
Git Bash.

---

## Stack travada

| Camada | Tecnologia |
|---|---|
| Web | React 18 + Vite 5 + TypeScript + Tailwind |
| Estado global | Zustand (`apps/web/src/features/aura/`) |
| Backend | Node + Express 4 + TypeScript |
| ORM | Prisma 6 (`packages/database/prisma/schema.prisma`) |
| Banco + Auth | Supabase (PostgreSQL + JWT) |
| IA | OpenAI SDK — modelo em `apps/backend/src/lib/openai-config.ts` |
| Testes web | Vitest + jsdom |
| Testes backend | `ts-node-transpile-only` executando arquivos `*.test.ts` diretamente |
| PWA | vite-plugin-pwa + Workbox |

Não há Jest no web, não há Playwright instalado como dependência (só o MCP), não
há suíte E2E versionada.

---

## Módulos centrais

| Papel | Arquivo |
|---|---|
| Motor de fase de humor | `apps/web/src/utils/mood-cycle-engine.ts` |
| Contexto diário (fonte da verdade operacional) | `apps/backend/src/services/context-grounding.service.ts` |
| Cérebro de decisão | `apps/backend/src/services/decision-engine.service.ts` |
| Agenda adaptativa | `apps/backend/src/services/adaptive-agenda-engine.service.ts` |
| Persona/prompt da Aura | `apps/backend/src/lib/aura-prompt.ts` |
| Segurança de risco | `apps/backend/src/lib/risk-safety.ts` |
| Execução passo a passo | `apps/backend/src/services/routine-run.service.ts` |
| Progresso/XP | `apps/backend/src/services/progress-rewards.service.ts` |
| Avaliação de IA | `apps/backend/src/lib/aura-eval/` |
| Tokens de design | `apps/web/src/styles/aura.css` |

As 8 fases visíveis oficiais: `Voo Alto`, `Fluindo`, `Estável`, `Desacelerando`,
`Recolhimento`, `Pausa`, `Retomada`, `Turbulência`.

---

## Invariantes que não se negociam

1. **Toda query do backend filtra por `userId`** extraído do JWT.
2. **Toda tabela nova tem RLS + policy + trigger `updated_at`**
   (`packages/database/CLAUDE.md`).
3. **Nada de demo/pitch/copy comercial** em `apps/web/src` ou `apps/backend/src`
   — travado por `product-guardrails.test.ts`.
4. **Sem botão morto, sucesso simulado ou placeholder** em fluxo de produto.
5. **A IA não inventa tarefa:** sugestão operacional precisa de âncora real —
   agenda pendente, hábito devido, meta ativa, subtarefa pendente ou aceite
   explícito. Memória RAG explica padrão, não cria ação.
6. **Limite clínico:** nunca nomear transtorno, comentar medicação ou apresentar
   leitura de padrão como diagnóstico.
7. **Identidade verde:** `--accent-primary` `#BFDCCB`. Não reintroduzir rosa nos
   apelidos. A logo é exceção deliberada (`AuraIcon.tsx`, bloco `LOGO` em
   `splash-page.tsx`).
8. **Servidor de agenda em UTC** — `setUTCHours`, nunca `setHours` cru.

---

## Onde as coisas são documentadas

| Tipo | Lugar |
|---|---|
| Regra de identidade e escopo | `CLAUDE.md` (raiz), `AGENTS.md` |
| Regra por app | `apps/web/CLAUDE.md`, `apps/backend/CLAUDE.md`, `packages/database/CLAUDE.md` |
| Desenho e plano de feature | `docs/plans/AAAA-MM-DD-nome.md` |
| Contrato de produto / API | `docs/product/` |
| Base clínica | `docs/product/base-clinica-padroes-e-acoes.md` |
| Processo de verificação | `docs/CLAUDE_ITERATION_PROTOCOL.md` |
| Memória operacional | `docs/agent-memory/` (este diretório) |
| Skills do projeto | `skills/<nome>/SKILL.md` + `skills/_registry.md` |

**Não criar arquivo solto.** Cada tipo tem destino.

> NOTA: `.dummy/memory/` existe com histórico de sessões antigas do D.U.M.M.Y. OS,
> mas está **no `.gitignore`** — não é memória durável do repositório e outro
> clone não a enxerga. A memória durável é `docs/agent-memory/`.
