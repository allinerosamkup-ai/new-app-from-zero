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

## CLAUDE.md Hierárquicos
Cada pacote tem seu próprio CLAUDE.md com regras específicas:
- `apps/web/CLAUDE.md` — frontend, telas, stores, design system
- `apps/backend/CLAUDE.md` — endpoints, Prisma, middleware, SSE
- `packages/database/CLAUDE.md` — schema, migrations, RLS

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
Cada Claude instance trabalha em seu próprio worktree isolado.

## Status do Design System — Aura v2 (atualizado 2026-03-18)

### ✅ Concluído
- CSS foundation (`index.css`): tokens nectarine, classes `.btn-aura`, `.interactive-card`, `.glass-card`
- Mockup de referência completo: `apps/web/public/mockup-aura-v2.html` (13 telas)
- Mockup aprovado com paleta 100% nectarine (sem orange/peche em estados de humor/energia)

### 🔜 Próxima sessão — Implementar tela por tela no código React
Ordem sugerida (começar pelas com mais delta visual):
1. `CheckinResultScreen.tsx` — fundo gradiente nectarine + cores corrigidas
2. `HomeScreen.tsx` — state card nectarine (icon colors já corrigidos no git)
3. `CheckinScreen.tsx` — sliders lagune/menthe, emoções
4. `PlannerScreen.tsx` — blocos com border-left semântica
5. `InsightsScreen.tsx` — bar chart menthe/nectarine
6. `JournalScreen.tsx` — bubbles, inputs Aura
7. `AuthScreen.tsx` — inputs 52px height, 6.5px radius, ícones internos
8. `ConfigScreen.tsx` — toggles nectarine, icon-bg
9. `ObjectivesScreen.tsx` — progress bars nectarine
10. `PomodoroScreen.tsx` — timer circle nectarine
11. `OnboardingScreen.tsx` — chat bubbles nectarine
12. `HarmonyCircleScreen.tsx` — radar chart
13. `DailySummaryScreen.tsx` — emotion chips, synthesis card

### Variantes do CheckinResult (seção ⑤-B no mockup)
| Estado | Cor dominante | BG topo | Círculo |
|--------|--------------|---------|---------|
| Radiante ✨ | Nectarine | `#F5E9E7` | `rgba(215,137,127,…)` |
| Em Equilíbrio 😌 | Menthe | `#E6F2EC` | `rgba(150,199,179,…)` |
| No Fluxo 🔥 | Lagune | `#E2EBF3` | `rgba(99,152,169,…)` |
| Ansiosa 😰 | Warm sand | `#F2EAD8` | `rgba(184,160,112,…)` |
| Cansada 😴 | Lavender | `#EAE5F2` | `rgba(176,160,200,…)` |
| Sensível 🌸 | Nectarine suave | `#F3E8E5` | `rgba(215,137,127,…)` leve |
| Dia Difícil 😤 | Rose muted | `#F0E4E2` | `rgba(210,100,100,…)` |

### Referência visual
Para cada tela: consultar `mockup-aura-v2.html` antes de editar o `.tsx`.
Regra: **gradientes de fundo usam cores OPACAS** (não rgba sobre #111).
