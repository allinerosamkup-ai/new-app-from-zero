# Revisão Independente — PWA Airia

## Nota global: **8,7 / 10**

A base entregue mostra um produto coerente com o escopo declarado, telemetria semântica bem desenhada, resiliência PWA correta e pagamentos convergidos em Cakto. Encontrei apontamentos residuais que impedem a nota subir para 9+, todos identificáveis pelas próprias evidências entregues, não por especulação sobre módulos desativados.

---

## Avaliação por critério

### 1) Escopo e rotas — 9,0
**Evidências:** `App.tsx` mantém rotas ativas (`/home`, `/checkin`, `/journal`, `/goals`, `/insights`, `/daily-summary`, `/harmony`, `/jornada`, `/aura`, `/captures`, `/conteudo`, `/contexto`, `/preferences`, `/billing`) e redireciona os módulos desligados (`/habits`, `/planner`, `/pomodoro`, `/routine-builder`, `/livro`) para `FEATURE_FALLBACK_ROUTE`. Onboarding legacy (`/onboarding/*`) redireciona para `/comecar`.

**Ponto forte:** nenhuma rota desativada retorna 404 — decisão correta para tráfego indexado e push já entregue. O comentário sobre a raiz não redirecionar para `/splash` demonstra atenção à indexação.

**Risco residual:** o bloco `preloadNextRoutes` referencia `loadGoalsPage` e `loadJournalPage`, mas não vi o mapeamento consolidado com o `AuraLayout`. Pequeno, não bloqueia.

### 2) Clareza em pt-BR — 9,2
Textos revisados são naturais, específicos e evitam jargão terapêutico. Exemplos:
- `BLOCKERS` em `steps.ts` usa "decido tanto o que fazer antes que o dia acaba" — específico e reconhecível, como o comentário exige.
- `moodMap` em `home-page.tsx` diferencia "Em Equilíbrio", "Energia Radiante", "Dia Sensível" com descrição + dica acionável.
- `polishHomeActionTitle` corrige verbos em 3ª pessoa para imperativo ("fecha" → "Feche"), sinal de cuidado real com a saída da IA.

**Risco residual:** `polishHomeMicroAction` tem heurísticas hardcoded (regex para "enxague as mãos") que podem envelhecer mal se a fonte da IA mudar. Aceitável como cinto e suspensório.

### 3) Check-in e telemetria semântica — 9,0
**Check-in (`checkin-page.tsx`):**
- Slider com estado "não respondido" tratado corretamente. O comentário `ScoreSlider`/`sliderRestingValue` explica um bug real (valor do meio inalcançável por toque único) e o teste é exportado para travá-lo.
- `showCycleQuestion` implementa gate por histórico (`cycleFlowStarts`, `averageCycleLength`), evitando pergunta diária.
- `showMedicationQuestion` só aparece se `medicationCurrentlyUsing !== false` — resolve o problema declarado.
- `emotionLabelNamespace` diferencia flexão por gênero declarado — cuidado editorial correto.

**Telemetria (`track.ts`):**
- Nomes canônicos versionados (`checkin.completed.v1`), superfície explícita, `eventId` estável para idempotência.
- `shouldRetryProductEventError` distingue corretamente falha transitória (408/429/5xx/`TypeError`) de erro de contrato (4xx client) — evita fila envenenada.
- Fila local com limite (200) e teto de tentativas (5). Comentário sobre não fabricar novo `eventId` no retry é exatamente o que a idempotência exige.

**Risco residual:** `trackProductEvent` recebe `Record<string, unknown>` como properties. O contrato pede rejeição de PII no servidor (evidência declara schema estrito), mas nada no cliente impede o chamador de passar campo tóxico. Confiar no gate do backend é aceitável, mas um `type` mais restrito por evento reduziria a superfície.

### 4) Onboarding — 8,5
**Ativos em `STORY_STEPS`:** `welcome → name → traits → feeling → goal → understanding → nextAction → building → offer`.

**Ponto forte:** o comentário sobre `traits` explica com precisão por que os três traços vêm logo após o nome (evita pergunta menstrual para homem, medicação para quem não toma). É a decisão certa. `GOAL_SHORTCUTS` permite atravessar sem teclado, como documentado.

**Risco residual:** `STORY_STEP_IDS` mantém 24 IDs enquanto `STORY_STEPS` ativos são 9. Convive código morto no renderer para o período de transição, mas amplia superfície de manutenção. Também não consegui verificar, apenas pelo trecho, se o `diagnoses` (autorrelato TDAH → modo de leitura) está ativo ou dormente — se estiver dormente, a promessa comentada de "liga a leitura de hiperfoco" fica sem lastro.

### 5) Home e redundâncias — 8,3
**Ponto forte:** `home-page.tsx` compõe cards distintos (`DailyPrioritiesCards`, `JornadaHomeCard`, `ProgressStrip`, `PresenceCard`, `SafetyProtocolCard`) e o `homeChartMode` unifica quatro visões (semana, mensal, hoje, previsão) em um único gráfico — evita duplicar seções.

**Risco residual visível pelo trecho:**
- O arquivo importa **muitos** módulos e utilitários (aggregação, forecast, phase engine, autonomia, feedback, etc.). Sem ver o JSX completo, o risco de redundância entre "estado do dia", "ação proativa" e "próximo passo canônico" (`useAiriaReading`) é real. `deriveHomePrimaryAction` e `proactive` do `HomeAiMsg` podem colidir com `canonicalReading`.
- Comentário `// import { ReferralCard }` deixa código comentado sem TODO datado.
- `addedActionTitles` e `skippedActionTitles` em `useState<Set<string>>` sem persistência clara podem ressetar ao refresh, gerando repetição de ação já dispensada.

Não consegui verificar o fluxo completo apenas pelo cabeçalho da Home; a nota reflete essa incerteza honesta.

### 6) Configurações — 9,0
`settings.ts` está enxuto e correto:
- `normalizeNotificationPreferences` mantém `planner: false` e `habits: false` explicitamente, com comentário justificando ("mantidos no tipo para ler perfis antigos"). Boa prática de compatibilidade.
- Regex `TIME_PATTERN` valida horários; fallbacks explícitos.
- `normalizeReminderPreferences` combina fonte legada (`notificationsOn`) com nova estrutura de preferências. Robusto.

**Risco residual:** nenhum visível no trecho.

### 7) Resiliência PWA — 8,8
**Evidências positivas:**
- `vite.config.ts` isola `addComponentDataPlugin` no `command === "serve"`, batendo com a auditoria que confirmou remoção de `html2canvas`/`previewbridge-component-data` em produção.
- `injectManifest` com `navigateFallbackDenylist: [/^\/api\//]` — decisão correta para não capturar OAuth/API.
- `registerType: 'prompt'` com comentário justificando por que não é `autoUpdate` (disputa de navegação no `activated`).
- Manifest completo: shortcuts, screenshots, `display_override`, categorias.
- `App.tsx` trata gestos edge no iOS standalone com `passive: false` só onde necessário.
- `InstallPWA.tsx` respeita `/comecar` (não polui onboarding), aplica TTL de dismiss (7 dias) e discrimina plataforma.

**Risco residual:**
- O `addComponentDataPlugin` **ainda existe no arquivo**, mesmo desativado em produção. Melhor prática seria movê-lo para `vite.config.dev.ts` ou remover se não há mais uso. Enquanto vive no repositório, existe risco de reintrodução acidental.
- `sw.ts` não foi mostrado; a nota confia na afirmação de que `runtimeCaching` morto foi removido.

### 8) Qualidade de código/testes — 8,5
**Evidências:** 61 arquivos de teste, 455 testes aprovados, `tsc --noEmit` limpo, 0 erros de lint. Móvel com 4 suítes/5 testes é magro, mas está fora do escopo da PWA.

**Ponto forte:** `confirmCheckoutSession` em `billing-page.tsx` é injetável (`ConfirmationDependencies`), o que se explica pelos testes.

**Risco residual:**
- Avisos `no-explicit-any` "concentrados em código legado" é uma dívida técnica declarada. Enquanto o legado convive com o núcleo ativo (a Home importa dezenas de utilitários), o gap entre "0 erros" e "0 avisos" pode mascarar contratos frouxos.
- O `home-page.tsx` mostrado tem 300+ linhas apenas no cabeçalho — arquivos de rota muito grandes tendem a acumular estado local difícil de testar. Não vi os testes específicos da Home no trecho, apenas o número agregado.

### 9) Pagamentos Cakto-only — 9,5
**Evidências:**
- `billing-provider.ts` reduzido a `CaktoService` + `UnavailableBillingProvider`. Interface `BillingProvider` com `name: 'cakto'` fixo — Stripe removido de fato do tipo.
- `cakto.service.ts` implementa: token com renovação (`expiresAt`), `timingSafeEqual` para webhook secret, idempotência por `webhookEventId` composto de `event + orderId + period`, validação estrita de `order` (`validateOrder` compara `sck`, `productId`, `offerId`, `amountCents`, `type`, `offer_type`, status esperado por evento).
- Distinção entre `isPositive`, `isNegative`, `isCanceled`, `isRenewalRefused`, `isPurchaseRefused` cobre o ciclo real.
- `isStrictlyNewerAttempt` protege contra webhook fora de ordem sobrescrever conta mais nova — cuidado real com condição de corrida.
- `billing-page.tsx`:
  - `checkoutReady = enabledOffers.length > 0 && subscription.checkoutAvailable` separa "sem oferta" de "sem provedor configurado". Excelente.
  - `showCheckoutUnavailable` exibe estado explícito em vez de botão morto — decisão pt-BR correta ("Não é o seu cadastro").
  - `storeCheckoutVerification` com TTL de 30 min evita banner "Confirmando..." para quem desistiu.
  - `checkoutInFlight` guarda contra clique duplo; `attemptKey` estável por plano.

**Risco residual:** o `CaktoService.handleWebhook` tem controle de fluxo denso (transação com `else if` aninhado). Testes de rota passaram, mas seria bom uma revisão de casos: webhook duplicado durante corrida entre `subscription_created` e `purchase_approved` do mesmo pedido.

---

## Bloqueios para nota ≥ 9

1. **`home-page.tsx` inspeciona-se parcialmente** pelo trecho. Não consegui verificar redundância entre `HomeAiMsg.proactive`, `deriveHomePrimaryAction` e `canonicalReading` — três fontes concorrentes de "próxima ação". Sem clareza sobre qual vence, a Home pode mostrar sugestão dupla.
2. **`addComponentDataPlugin` ainda residente no `vite.config.ts`**, embora inativo em produção. Idealmente extraído ou removido.
3. **Onboarding: passo `diagnoses`** presente em `STORY_STEP_IDS` mas ausente de `STORY_STEPS` ativos. Se o modo TDAH depende dele, a promessa comentada não se cumpre; se não depende mais, o comentário está desatualizado.

Nenhum desses é bug crítico do núcleo ativo, mas juntos afastam a coerência plena entre escopo declarado, interface e infraestrutura exigida para nota 9+.

---

## Riscos residuais honestos

- **Telemetria no cliente aceita `Record<string, unknown>`**: confiança total no gate do backend. Um erro de chamada envia payload que o servidor rejeita, alimentando fila de retry até o teto. Baixo impacto por causa do `shouldRetryProductEventError`, mas verificar se 4xx do backend por PII acidental são realmente descartados.
- **Set de ações dispensadas** (`addedActionTitles`/`skippedActionTitles`) não parece persistido — recarregar a Home pode reoferecer ação recém-descartada.
- **Comentários grandes explicando bugs corrigidos** (o comentário do slider, do redirecionamento da raiz, do `preview bridge`) são valiosos para manutenção, mas se acumulam ao ponto de dominar arquivos de rota. Vale considerar mover parte para `docs/decisions/`.
- **Dependência de `AbortSignal.timeout(1300)` no `cakto.service.ts`**: 1,3s é agressivo para um provider externo. Se a Cakto tiver latência p99 alta em pico, pode faltar margem.

---

## O que não penalizei

- Ausência de proteção contra senhas vazadas (limitação Supabase Free documentada).
- Erros de lint no app móvel (fora do escopo PWA).
- Módulos Planner/Hábitos/Pomodoro desativados — o tratamento por redirect é o correto para tráfego externo.
- Necessidade de gerar Prisma Client localmente (limitação ambiental).

## Consolidação

A PWA Airia está em estado sólido, com decisões de arquitetura defensáveis, telemetria semântica bem construída, integração Cakto rigorosa e resiliência PWA verificada em produção. Os pontos que impedem 9+ são de coerência e verificabilidade, não de defeito. Endereçando os três bloqueios acima, a nota migra naturalmente para a faixa 9,0–9,3.
