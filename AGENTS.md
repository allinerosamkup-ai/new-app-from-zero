# Mood Energy — Monorepo

## O que é este projeto
Sincronizador biológico: ajuda pessoas a entender seus ciclos de humor/energia e adaptar o dia de forma prática.

**Não é:** app de produtividade genérica, chatbot terapêutico, diário passivo, tracker de hábitos.

## Estrutura do Monorepo
```
apps/
  web/          → Frontend React + Vite + TypeScript (preview em phone-frame)
  backend/      → API Node.js + Express + Prisma
  mobile/       → React Native + Expo (pausado, foco atual é web)
packages/
  database/     → Schema Prisma compartilhado
```

## Stack Travada (não mude sem aprovação)
| Camada | Tecnologia |
|--------|-----------|
| Web frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| Estado global | Zustand (stores em `apps/web/src/stores/`) |
| Backend API | Node.js + Express + TypeScript |
| ORM | Prisma (schema em `packages/database/prisma/schema.prisma`) |
| Banco | Supabase (PostgreSQL + Auth) |
| IA | OpenAI GPT-4o-mini via SSE streaming |
| Auth | Supabase JWT → Bearer token no backend |

## AGENTS.md Hierárquicos
Cada pacote tem seu próprio AGENTS.md com regras específicas:
- `apps/web/AGENTS.md` — frontend, telas, stores, design system
- `apps/backend/AGENTS.md` — endpoints, Prisma, middleware, SSE
- `packages/database/AGENTS.md` — schema, migrations, RLS

## Regras Universais
- UI sempre em **PT-BR**; nomes de arquivo/componente sempre em **inglês**
- Nunca armazene tokens/chaves no código frontend
- Toda query ao banco deve ser user-scoped (RLS ativa em todas as tabelas)
- Nunca adicione dependências sem justificar
- Antes de editar qualquer arquivo: **leia-o primeiro**

## Como rodar
```bash
# Backend (porta 3001)
cd apps/backend && npm run dev

# Frontend (porta 5173)
cd apps/web && npm run dev
```

## Agentes Paralelos (worktrees)
Para trabalhar frontend e backend simultaneamente sem conflito:
```bash
git worktree add ../worktree-web feat/web-changes
git worktree add ../worktree-backend feat/backend-changes
```
Cada Codex instance trabalha em seu próprio worktree isolado.

## IA Persona — Aura (atualizado 2026-04-01)

- Função: `buildAuraSystemPrompt(userName, profileSummary?)` em `apps/backend/src/index.ts`
- Injetada em **todos** os calls OpenAI via `role: 'system'`
- Personas: **Babá Digital** + **Copiloto Autônomo de Vida**
- Metodologia: Terapia de Exposição (principal) + TCC gentil + Psicologia somática + Autocompaixão
- Perfil do usuário: aprendido via DB (`onboardingResponse.aiProfileSummary`) — **nunca hardcoded**
- Profile é genérico — descrito pela própria IA a partir das interações do usuário real
- Tipos de sugestão: `home-messages`, `checkin-response`, `day-tasks`, `planner-insight`
- **Regra inviolável**: Nenhuma tela exibe texto pré-pronto como fallback de IA. Padrão: skeleton → dado IA → empty state neutro

## Status do Design System — Aura Editorial Clean (atualizado 2026-04-07)

### ✅ Fonte de verdade atual
- Fundo base branco/off-white em todas as superfícies principais.
- Cor entra como acento, não como massa: botões, chips, gráficos, estados, indicadores e detalhes.
- Cards claros, sombras suaves, bordas discretas e respiro editorial.
- Navegação, headers e shells com presença visual menor que o conteúdo.
- Fluxos interativos devem priorizar gesto natural: swipe, scrub horizontal, scroll por toque.

### Paleta ativa
- Neutros: branco quente, creme muito claro, cinzas suaves.
- Acentos: salmão rosado pastel, verde sálvia claro, azul céu suave, lilás leve e pêssego aberto.
- Evitar qualquer cor escura dominante no app.
- Evitar blocos inteiros em cor saturada quando uma superfície clara resolver melhor.

### Regras visuais obrigatórias
- Não usar o mockup antigo do sistema anterior como referência de implementação.
- Não reintroduzir headers escuros, gradientes pesados ou superfícies “glass” densas do sistema anterior.
- Não concentrar identidade visual em um único tom saturado ou em massa cromática contínua.
- Toda tela nova ou refatorada deve conversar com o shell clean atual antes de qualquer detalhe local.

### Estado atual consolidado
- Redesign global clean aplicado nas páginas principais do app.
- Home com hero claro, popup premium de hábitos e cards mais leves.
- Planner com estética contínua de agenda, inclusive quando vazio.
- Check-in com sliders táteis, escala `1–10` e swipe entre etapas.
- Hábitos sincronizados entre modal da Home e página completa.

### Próxima sessão
- Polimento fino nas telas densas restantes para eliminar resíduos visuais do sistema antigo.
- Revisar docs e artefatos históricos sempre que algum deles puder voltar a influenciar a UI atual.
