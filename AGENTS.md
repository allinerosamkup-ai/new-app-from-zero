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

## Status do Design System — Aura v2 (atualizado 2026-03-18)

### ✅ Concluído
- CSS foundation (`index.css`): tokens nectarine, classes `.btn-aura`, `.interactive-card`, `.glass-card`, `.aura-slider`
- Mockup de referência completo: `apps/web/public/mockup-aura-v2.html` (13 telas + 6 variantes de estado)
- Mockup aprovado com paleta 100% nectarine (sem orange/peche em estados de humor/energia)
- **Implementação Aura v2 em TODAS as 13 telas** (2026-03-18):
  1. `CheckinResultScreen.tsx` — gradientes opacos, 4 variantes (radiant/stable/sensitive/overloaded)
  2. `HomeScreen.tsx` — header nectarine + radial gradient, state card nectarine-a3, bug EN/PT corrigido
  3. `CheckinScreen.tsx` — sliders visuais com thumb, emotion grid 4-col, botão Aura 52px
  4. `PlannerScreen.tsx` — category chips com dot colorido, borders 4px semânticas, FAB nectarine
  5. `InsightsScreen.tsx` — bar chart menthe/nectarine, stats Poppins 17px, pattern cards
  6. `JournalScreen.tsx` — bubbles assimétricas, avatar nectarine-a3, input com send nectarine
  7. `AuthScreen.tsx` — hero card nectarine, tab switcher Aura, inputs 52px com ícones Lucide
  8. `ConfigScreen.tsx` — config rows agrupadas, toggles nectarine, profile card 52px
  9. `ObjectivesScreen.tsx` — progress bars lagune, subtask checkmarks menthe, cards com border-left
  10. `PomodoroScreen.tsx` — timer circle nectarine, phase tabs, session dots
  11. `OnboardingScreen.tsx` — chat bubbles nectarine/menthe, progress bar
  12. `HarmonyCircleScreen.tsx` — radar chart nectarine, dimension bars
  13. `DailySummaryScreen.tsx` — emotion chips nectarine palette, synthesis card

### Variantes do CheckinResult implementadas
| Estado | Cor dominante | BG topo | Emoji |
|--------|--------------|---------|-------|
| `radiant` | Nectarine | `#F5E9E7` | ✨ |
| `stable` | Menthe | `#E6F2EC` | 😌 |
| `sensitive` | Nectarine suave | `#F3E8E5` | 🌸 |
| `overloaded` | Warm rose | `#F0E4E2` | 😤 |

### ✅ Atualizações 2026-04-01
- IA persona Aura implementada (`buildAuraSystemPrompt`) — injetada em todos os calls OpenAI
- HomeScreen: skeleton de carregamento + empty state neutro (sem texto fixo de fallback)
- CheckinResult: "Aura diz:" com resposta dinâmica da IA (`checkin-response`)
- CheckinPage v3: botões nativos corrigidos + sintomas do ciclo (cólica + dor de cabeça)
- `CheckinEntry` expandido: `isFlowing`, `flowDay`, `flowIntensity`, `symptomLevels`

### 🔜 Próxima sessão
- Persistir campos ciclo menstrual no backend (schema `daily_checkins`)
- Testar `checkin-response` end-to-end (IA retorna mensagem real no resultado)
- Testar responsividade do phone-frame em todas as telas
- Ajustar micro-interações (hover/active states)

### Referência visual
Para cada tela: consultar `mockup-aura-v2.html` antes de ajustar o `.tsx`.
Regra: **gradientes de fundo usam cores OPACAS** (não rgba sobre #111).
