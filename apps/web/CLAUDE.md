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
- **Grounding**: sugestões operacionais devem usar o contexto diário do backend. O frontend pode enviar contexto local, mas o backend é a fonte de verdade para pendentes, concluídos e feedback.
- **Decision Brain**: quando a resposta do backend trouxer `decisionBrain` ou `adaptiveAgenda`, a UI deve respeitar `kind`, `requiresConfirmation` e `notificationAllowed`.
- **Feedback**: quando uma ação sugerida for marcada como feita, pulada, excluída ou agendada, registrar também em `/api/ai/action-feedback`.
- **Não repetir**: se uma sugestão saiu da tela por ação da usuária, ela não deve voltar após refresh.

## Home e Análise/Autonomia
- O card “Análise e Autonomia” continua renderizando `stabilityScore`, `state`, `pattern`, `insight`, `actions`.
- A Home mantém feedback local para resposta imediata e envia o mesmo feedback ao backend para memória entre sessões.
- O card deve mostrar menos ações ou nenhuma ação se não houver sugestão ancorada no dia real.
- Sugestão opcional pode aparecer, mas precisa ser apresentada como proposta. Não criar tarefa, bloco ou notificação sem aceite explícito.

## Planner
- O botão “Adiar” em um bloco move o compromisso para o dia seguinte.
- Blocos locais usam `POST /api/timeline/:id/postpone`.
- Eventos do Google Agenda usam `PATCH /api/gcal/events/:eventId` com a data do dia seguinte e registram feedback `scheduled`.
- Botões dentro de cards precisam manter alvo de toque confortável no mobile.

## Fases Oficiais
Todas as superfícies devem usar as mesmas 8 fases visíveis:
`Voo Alto`, `Fluindo`, `Estável`, `Desacelerando`, `Recolhimento`, `Pausa`, `Retomada`, `Turbulência`.

Estado do check-in pode ser descritivo, mas não deve parecer fase de humor.

## Design System Tokens
- Accent: `--nectarine` (#D7897F)
- Saúde/Humor: `--menthe` (#96C7B3)
- Trabalho/Energia: `--lagune` (#6398A9)
- Unidade base: `--a` (13px)
