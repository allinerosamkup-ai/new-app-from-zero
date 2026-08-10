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

**Padrões também, desde 2026-08-09.** Ficava escondido até o 3º check-in e a
ausência foi lida como bug ("você tirou o botão Padrões") — o que é a leitura
certa, porque some sem aviso e some por defeito são a mesma coisa na tela. A
página já tinha o estado vazio que faz esse trabalho direito, dizendo quantos
check-ins faltam e o que aparece em 3, 7 e 30 dias; ele era inalcançável
justamente para quem foi escrito. `nav-access.helpers.ts` só condiciona o
Planner agora.

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

## Idioma e SEO

**O idioma segue o aparelho até a pessoa escolher outro.** `i18n/index.ts` lê
nesta ordem: `?lang=` → escolha salva → `navigator`. O detector **não guarda** o
que apenas detectou (`caches: []`) — antes guardava, e isso cravava o idioma da
primeira visita para sempre: quem trocasse o idioma do celular depois ficava
preso no antigo, com o app respeitando uma preferência que ninguém expressou.
Só `setLanguage()`, em Preferências, escreve `airia_lang`. `dropDetectorCache()`
limpa o cache antigo pelo formato — o detector gravava `pt-BR`, a escolha grava
`pt`.

**São quatro páginas públicas, e cada uma precisa declarar a própria canônica.**
A splash (`/`) e `/livro` carregam SEO por `lib/seo.ts` — função pura, testada,
que decide, e escrita boba que aplica no `<head>`. `/privacy` e `/terms` são
arquivos estáticos em `public/` e trazem a canônica escrita no próprio arquivo.
As telas internas não entram — sobrescrever o título delas com texto de
marketing não ajuda ninguém, e estão bloqueadas no `robots.txt` porque exigem
sessão.

**Canônica não é opcional em nenhuma delas.** `airia.pro` e `www.airia.pro`
servem o mesmo site com 200 de propósito (o PWA está instalado no `www`), então
`rel=canonical` é o único sinal que diz qual URL é a verdadeira. `privacy.html` e
`terms.html` ficaram sem nenhuma até 2026-08-10, sendo duas das URLs do sitemap:
o Google podia eleger a versão `www`, host fora da propriedade do Search Console.
Trava: `lib/public-pages-canonical.test.ts` + checagem nos dois hosts no
`deploy.sh`.

Cada idioma da raiz tem URL própria (`/` e `/?lang=en`); sem isso `hreflang` não
significa nada. As declarações são recíprocas, senão o Google descarta.

**`/livro` é o caso oposto: uma URL só para os dois idiomas.** A página troca de
idioma sozinha e não tem `?lang=`, então não há `hreflang` a declarar — e o que
ela herdava do `index.html` era afirmação falsa (dizia que suas versões eram a
home e a `/?lang=en`). `applyStandalonePageSeo("livro", language)` remove esses
`hreflang` e crava a canônica própria. Antes disso toda rota do SPA herdava a
canônica da raiz, e `/livro` — destino de anúncio pago — se declarava duplicata
da home, sem como ser indexada por si.

**Página pública fora da raiz ganha `<head>` estático próprio.** Injetar canônica
só em JavaScript deixaria o HTML cru contradizendo o DOM renderizado, que é o
caso em que o buscador costuma ficar com a versão errada — e não resolveria
prévia de link, que não executa JS. `scripts/build-seo-html.mjs` gera
`dist/index.en.html` e `dist/livro.html` a partir de `seo-content.json`, e o
nginx serve cada um na URL certa. Mesmos assets, mesmo bundle, só o `<head>`
muda. O gerador aborta se um padrão parar de casar com o `index.html`.

**Limite honesto:** isto roda no cliente. O Googlebot executa JS e enxerga;
prévia de link no WhatsApp e no Slack **não executa**, então o compartilhamento
sempre mostra o que está no `index.html` estático, que é português. Resolver de
verdade exige render no servidor — decisão de arquitetura, não ajuste de tag.

Nada de `aggregateRating` no JSON-LD: nota inventada é penalidade manual
garantida, e mentira para quem instala achando que houve avaliação.

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

Sobre a irritabilidade, o buraco era maior e do outro lado: a agregação passou a
carregar o valor, mas **a tela nunca perguntou**. Corrigido em 2026-08-08. Ela
entra no `aiContext` como carga do dia — nunca em `weightedComposite` nem em
`warningFlags`, porque `base-clinica-padroes-e-acoes.md` é explícito em dizer que
irritabilidade **não discrimina** desregulação de TDAH de episódio bipolar. O que
ela informa é conduta: acima de 7, baixar a exigência do dia.

## O que se pergunta tem que virar dado

Regra do check-in, e ela vale para qualquer campo novo: **toda pergunta da tela
precisa chegar ao banco e ter algum consumidor** — ou ficar registrado por que
existe sem um.

O que quebrou essa regra, nas duas direções: `clarityScore` e `irritabilityScore`
tinham coluna, contrato e (no caso da irritabilidade) leitor, e nenhuma pergunta;
`capacity` e `priorityGoalId` tinham pergunta e nenhum destino, viajando só pelo
`navigate(state)` e morrendo ao fechar a tela. Os dois últimos vivem hoje em
`signalMetadata.dayPlan` — coluna `Json` que já existia, zero migração.

Provas: `features/aura/checkin-submission.test.ts` cobre tela → payload, e
`checkin-application.service.test.ts` no backend cobre payload → persistência.

**`input[type=range]` não avisa quando o toque cai onde o polegar já está.**
Campo opcional começa com o polegar no meio da escala, então 6 era o único valor
de 1 a 10 impossível de responder com um toque: a pessoa via o polegar no lugar
certo e o app gravava `null`. O `ScoreSlider` confirma o valor exibido no
`pointerup`/`keyup` enquanto o campo estiver vazio.

## Mascote Airia Orbital

`components/airia/AiriaMascot.tsx`, presente em Home, Objetivos, Padrões, Diário,
Aura e no resultado do check-in.

- **Recebe a fase pronta e nunca infere humor.** A fase sai do `MoodCycleEngine`;
  componente que adivinhasse estado local diria uma coisa enquanto a tela ao lado
  diz outra. Sem dado suficiente, cai em Estável — ausência de leitura não vira
  cara triste.
- **No check-in ele só reage depois do registro confirmado**, e por isso mora na
  tela de resultado, não no formulário. Fica no herói, que aparece sempre: dentro
  do bloco de fase ele sumiria justo para quem registra pela primeira vez.
- `decorative` some da leitura de tela quando o nome da fase já está escrito ao
  lado, que é o caso em todas as superfícies hoje.
- Assets: WebP de 320 e 640 px, ~420 KB no total, **fora do precache** (rota
  `CacheFirst` em `src/sw.ts`). Os PNGs-mestres (11,4 MB) ficam na branch
  `codex/airia-orbital-mascot`; `scripts/build-mascot-assets.mjs` regenera.
- O mestre é RGB sem alfa, com fundo creme chapado. A máscara radial do script é
  o que impede um quadrado creme no card branco.

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
`src/styles/css-tokens.test.ts` é a checagem, e roda no `npm test`. Um `var()`
que não resolve não gera erro de build nem de tipo — só some da tela, e você
descobre pelo relato de quem usa.

Ela varre **só o CSS que alguém importa**: `styles/main.css` e `index.css` são
folhas órfãs, e alarme sobre arquivo morto é o que faz uma checagem ser ignorada.
Token definido inline (`style={{ "--i": 2 }}`) conta como declarado.

Na primeira execução achou três fantasmas em código vivo, todos da mesma família
dos 27 anteriores: `--accent-butter` na faixa do `.btn-info-row` (só existia no
`index.css` órfão; o amarelo real é `--buttercup`), `--text-secondary` num botão
de Preferências (é `--text-2`) e `--bg-base` no `PhoneFrame` (é `--warm-bg`).

**Código novo usa os tokens canônicos `--accent-primary*`, não os apelidos
`--accent-peach*`.** Os apelidos existem para não quebrar o que já estava
escrito; nascer apoiado neles é dívida de graça. O teste também trava se algum
apelido voltar a receber valor literal — é assim que o rosa reentraria.
