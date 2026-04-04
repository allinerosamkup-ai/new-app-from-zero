# Mood Cycling — Web Frontend

## Stack
- React 18 + Vite
- TypeScript
- Tailwind CSS
- Zustand (`src/features/aura/store.ts`)
- Lucide React (ícones)

## Estrutura de Rotas (`src/routes/`)
| Rota | Arquivo | Descrição |
|------|---------|-----------|
| `/auth` | `auth-page.tsx` | Login/Cadastro Supabase |
| `/home` | `home-page.tsx` | Dashboard principal com painel de Ciclagem |
| `/checkin` | `checkin-page.tsx` | Registro de humor, energia e sintomas |
| `/checkin-result` | `checkin-result-page.tsx` | Resposta da Aura ao check-in + Ajuste IA |
| `/planner` | `planner-page.tsx` | Gestão de tarefas com badges de energia |
| `/journal` | `journal-page.tsx` | Diário reflexivo com chat SSE |
| `/insights` | `insights-page.tsx` | Gráficos e padrões de humor |
| `/goals` | `goals-page.tsx` | Hub de Metas & GTD (Captura Glass + Organização) |
| `/pomodoro` | `pomodoro-page.tsx` | Timer de foco integrado |
| `/config` | `config-page.tsx` | Preferências do usuário |

## Core Logic — MoodCycleEngine
Arquivo: `src/utils/mood-cycle-engine.ts`
Exporta:
- `computeMoodCycle(history)`: Retorna `MoodCycleReport` com fase, estabilidade e flags.
- `getPhaseColor(phase)`: Retorna o token CSS da cor da fase.
- `getStabilityLabel(score)`: Label humanizado da estabilidade.

## Padrão de IA (Inviolável)
- **Carregamento**: Começa com `Loading: true`. Exibe `Skeleton`.
- **Contexto**: Sempre passar `moodCycleContext: cycleReport.aiContext` no payload.
- **Renderização**: Só exibe conteúdo após resposta da IA. Nunca usar texto fixo como fallback.

## Design System Tokens
- Accent: `--nectarine` (#D7897F)
- Saúde/Humor: `--menthe` (#96C7B3)
- Trabalho/Energia: `--lagune` (#6398A9)
- Unidade base: `--a` (13px)
