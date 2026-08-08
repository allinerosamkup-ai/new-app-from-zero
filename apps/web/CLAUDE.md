# Mood Cycling — Web Frontend

## Stack
- React 18 + Vite
- TypeScript
- Tailwind CSS
- Zustand (`src/features/aura/store.ts`)
- Lucide React (ícones)

## Funcionalidades ligadas e desligadas

`src/config/features.ts` é a chave única. Hoje: `planner: false`, `habits: false`.

O app foi reduzido ao núcleo — **check-in, objetivos, padrões e diário**. Planner
e Hábitos saíram de circulação **sem nada ser apagado**: as rotas seguem
registradas redirecionando para a home, porque notificação push já entregue no
celular de alguém e link salvo não podem cair em 404.

Trocar `false` por `true` devolve barra de navegação, rotas, pré-carregamentos,
alvo das notificações, ação principal da home e todos os CTAs. Por isso o
`planner` continua declarado em `NAV_ITEMS` e nas regras de `nav-access.helpers` —
esconder é responsabilidade da camada de cima, não das regras de destrave.

Barra inferior: **Hoje · Objetivos | Airia | Padrões · Diário**. Objetivos entra
no essencial destravado — esperar check-in para deixar criar meta não faz sentido
quando metas são o núcleo.

## Estrutura de Rotas (`src/routes/`)
| Rota | Arquivo | Descrição |
|------|---------|-----------|
| `/auth` | `auth-page.tsx` | Login/Cadastro Supabase (só e-mail e senha) |
| `/home` | `home-page.tsx` | Próximas ações, objetivo em foco, ciclagem |
| `/checkin` | `checkin-page.tsx` | Registro de humor, energia e contexto |
| `/checkin-result` | `checkin-result-page.tsx` | Release do dia + sugestões para Próximas ações |
| `/journal` | `journal-page.tsx` | Diário com chat SSE; propõe check-in e meta |
| `/insights` | `insights-page.tsx` | Padrões e relatórios por período |
| `/goals` | `goals-page.tsx` | Objetivos com execução ordenada |
| `/pomodoro` | `pomodoro-page.tsx` | Timer de foco |
| `/run` | `run-page.tsx` | Execução passo a passo |
| `/planner` | — | **Desligado.** Redireciona para `/home` |
| `/habits` | — | **Desligado.** Redireciona para `/home` |

## Home — o que ela responde

A pergunta mudou: era "o que tenho hoje" e virou **"o que eu faço agora"**. As
585 linhas de agenda por blocos saíram.

- **`components/NextActionsCard.tsx`** — Próximas ações. Até 5 itens, **sem data
  nenhuma**: a regra é conclusão, não prazo, e a ação fica até ser concluída.
  Combina o próximo passo de cada objetivo com os itens do Inbox
  (`localStorage["gtd-inbox-v1"]`), passando por dedupe. Ouve o evento
  `gtd-inbox-updated` para não esperar recarregar a tela.
- **`components/GoalFocusCard.tsx`** — objetivo mais perto de fechar, com a
  próxima ação concluível ali mesmo, e a lista compacta dos demais. Quando o
  objetivo em foco conclui, o seguinte assume sozinho: `selectFocusGoal` refaz a
  escolha a cada reidratação, **sem estado persistido de "qual é o foco"**.
- Acesso rápido não tem mais o card "Fechar" — levava a uma tela que depende do
  Planner.

## Dedupe de ações — duas camadas, nesta ordem

1. **`utils/action-similarity.ts`** — lexical, instantâneo, de graça. Normaliza
   acento, palavra vazia e variação de verbo, e mede sobreposição (Jaccard,
   limiar 0.6). Pega paráfrase: "ligar para a médica" ≈ "ligar pra médica".
   Roda em toda exibição da lista.
2. **`utils/save-next-action.ts`** → `POST /api/actions/check-equivalent` — LLM,
   só quando o lexical não achou nada. Pega sinônimo real: "comprar pão" ≈
   "passar na padaria", que sobreposição de palavras nunca identifica.

**Qualquer falha cria a ação.** Ver dois itens parecidos incomoda; perder o que a
pessoa pediu para anotar é grave. Ao gravar em lote (sugestões do check-in), a
verificação é **em série** — cada uma precisa enxergar o que a anterior gravou.

## Relatórios por período (`utils/period-report.ts`)

O relatório falava do dia atual porque era isso que recebia: o payload mandava a
fase de hoje e o contexto "leitura atual". Agora manda **agregados da janela
inteira**, calculados por função pura: médias, variabilidade, melhor e pior dia,
dias com humor baixo e energia alta ao mesmo tempo, média por dia da semana,
fatores com amostra mínima de 3 dias, maior sequência sem registro e comparação
entre as duas metades do período.

Seletor: semana, mês, 90 dias, semestre e **intervalo personalizado** com data
inicial e final. Cobertura abaixo de 30% obriga o relatório a declarar amostragem
baixa em vez de inventar conclusão.

## Execução e Recompensa
- `RewardBurst` (`components/RewardBurst.tsx`) é o retorno de cada conclusão. Dura pouco, sai sozinho e respeita `prefers-reduced-motion`. O texto vem do backend para ser igual em toda superfície. **Mostra o XP ganho** — o campo `xpEarned` sempre existiu no contrato e nunca era renderizado: a pessoa ganhava pontos sem ver.
- **Cada micro-ação de objetivo paga.** Antes só o objetivo inteiro comemorava. Agora concluir um passo dá 12 XP e fechar o objetivo dá 60, com frase própria e comemoração grande.
- `ProgressStrip` (`components/ProgressStrip.tsx`) mostra nível, XP, ações concluídas, objetivos completados e sequência, a partir de `GET /api/progress`. Atualiza sem recarregar, ouvindo `PROGRESS_UPDATED_EVENT`. **Contador só aparece depois de existir** — zero na tela no primeiro dia leria como cobrança.
- Reabrir um bloco não comemora. Só fechar.
- Na tela de execução, pular é saída legítima: não pede justificativa e não conta tempo.

## MoodCycleEngine — três correções que valem saber

O motor mede desvio do **baseline pessoal**, e isso criava pontos cegos. Base em
`docs/product/base-clinica-padroes-e-acoes.md`.

1. **Traços mistos eram invisíveis.** O composto (`humor*0.6 + energia*0.4`)
   colapsava humor 2 com energia 8 em 4,4 — o quadro que mais exige cautela
   passava por dia intermediário. Agora a divergência entre os dois é medida no
   mesmo dia e acende `mixed_features`.
2. **O sinal do sono estava invertido.** Dormir pouco era sempre fator negativo.
   Dormir pouco **e estar acima do baseline** é redução da necessidade de sono,
   marcador de elevação → `reduced_sleep_need`.
3. **As horas de sono nunca chegavam ao motor.** `aggregateCheckinsByDay`
   descartava `sleepHours` e `irritabilidade` em silêncio: o check-in coletava e
   a agregação jogava fora.

Estabilidade agora tem **valência**: `stableReading` distingue platô alto de
platô baixo pelo nível **absoluto**, não pelo desvio. Quem está deprimido há meses
tem baseline rebaixado, os contadores de dia ruim zeram, e o app dizia
"Estável 💚" para depressão sustentada. Um segundo critério absoluto acende
`sustained_low` mesmo sem desvio nenhum.

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

**Fonte da verdade é `src/styles/aura.css`. Nunca um valor escrito aqui.**

Este bloco já documentou `--nectarine (#D7897F)` como acento — token que **não
existia no CSS**. Custou dois bugs de aparência: `var()` que não resolve invalida
a declaração inteira, então o texto dos botões da página de Objetivos herdava a
cor e sumia no fundo claro, e o botão "Criar objetivo" (branco sobre fundo que
virava transparente) ficava branco no branco. Parecia botão sem título e botão
desaparecido; era token fantasma.

| Papel | Token | Valor atual |
|---|---|---|
| Acento primário | `--accent-primary` | `#BFDCCB` (verde claro) |
| Acento forte | `--accent-primary-strong` | `#8FC0A4` |
| Acento para texto | `--accent-primary-ink` | `#4F7359` |
| Saúde/Humor | `--accent-sage` | `#BFDCCB` |
| Trabalho/Energia | `--accent-sky` | `#BEE6F3` |
| Unidade base | `--a` | 13px |

Apelidos mantidos por compatibilidade, todos apontando para os acima:
`--accent-peach*`, `--nectarine*`, `--menthe`, `--lagune`. **Não reintroduza
rosa nesses tokens** — a identidade é verde desde a virada.

**A logo é exceção e não acompanha a paleta.** `components/AuraIcon.tsx` e o
bloco `LOGO` em `routes/splash-page.tsx` mantêm as cores originais (salmão, rosa,
menta, azul) de propósito. Varredura de cor deve pular esses dois trechos.

### Antes de usar um token novo
Rode a checagem de tokens indefinidos. Um `var()` que não resolve não gera erro
de build nem de tipo — só some da tela, e você descobre pelo relato de quem usa.
