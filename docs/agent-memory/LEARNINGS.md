# LEARNINGS — o que já foi descoberto

> Camada C. Conhecimento acumulativo que impede repetir investigação e erro.
> Cada entrada carrega um tipo: `FATO`, `DECISÃO`, `HIPÓTESE` ou
> `TENTATIVA FRACASSADA`. **Hipótese não vira fato por estar escrita aqui.**
>
> Higiene: entrada curta, acionável, sem raciocínio longo e sem log. O que o
> código já diz não entra. Quando uma entrada ficar falsa, corrija ou apague —
> memória errada é pior que memória ausente.

Formato: `### [TIPO] Título` + o que muda na prática.

---

## Ferramentas e ambiente

### [FATO] Build Android exige SDK fixo no app e Health Connect travado no alpha08
`apps/mobile/android/app/build.gradle` deixou de herdar `rootProject.ext` e fixa
`compileSdk 34`, `minSdkVersion 26`, `targetSdkVersion 34`. O `minSdk` sobe
porque o default do projeto raiz é `23` e o Health Connect não roda ali.
`androidx.health.connect:connect-client` está preso em `1.1.0-alpha08`; o cache
do Gradle mostra que `1.1.0`, `1.1.0-rc03` e `1.2.0-alpha02` foram baixadas e
descartadas. Evidência de que essa combinação funciona: APK de release gerado em
2026-08-12, `versionCode 17` / `versionName 1.0.16`.

**HIPÓTESE, não fato:** o motivo de o alpha08 ter ganhado da 1.1.0 estável nunca
foi registrado. Antes de "atualizar" essa dependência, reproduzir o build — a
troca já foi tentada e revertida por alguém.

### [FATO] versionCode do Android e do app.json desincronizam sozinhos
`app.json` e `android/app/build.gradle` guardam a versão em dois lugares e
chegaram a divergir (`16`/`1.0.15` contra `15`/`1.0.14`). Conferir os dois antes
de qualquer release; hoje ambos estão em `17`/`1.0.16`.

### [DECISÃO] O protocolo de desenvolvimento tem uma fonte única e neutra
`docs/DEVELOPMENT_ITERATION_PROTOCOL.md` é a fonte compartilhada por Codex/GPT,
Claude Code e demais agentes. `AGENTS.md`, `CLAUDE.md` e o AGENTS global do
Codex são adaptadores curtos; `docs/CLAUDE_ITERATION_PROTOCOL.md` existe apenas
como ponte de compatibilidade. Não criar uma segunda versão do protocolo.

### [DECISÃO] Commit e worktree têm gates separados
Alteração pronta precisa de commit ou de um bloqueio documentado; worktree
precisa de dono, branch, estado e handoff. `git status --short --branch` e
`git worktree list --porcelain` são verificações obrigatórias antes de começar e
encerrar trabalho. Não criar cópia para a mesma tarefa sem motivo registrado e
não deixar worktree/branch/arquivo sem destino.

### [DECISÃO] Reutilizar antes de inventar
Antes de escrever código novo, pesquisar no repositório, worktrees, histórico,
dependências, documentação oficial e fontes externas relevantes, como GitHub,
registries, templates, conectores e catálogos de aplicativos. Reutilizar ou
adaptar apenas depois de conferir comportamento, licença, segurança,
compatibilidade e manutenção; registrar escolhas relevantes e verificar a
solução no mesmo ciclo do código novo.

### [DECISÃO] Orquestração entre subagentes e LLMs
Toda tarefa segue papéis separados de coordenador, executor, verificador,
verificador de integração e meta-verificador. Executores podem se comunicar
horizontalmente; entregas e aprovações seguem comunicação vertical entre LLMs.
Handoffs carregam contexto, evidência, decisão e próxima ação em registro
persistente. A Airia exige que a integração de UI/UX, i18n, dados, regras e IA
seja avaliada quando a mudança tocar essas superfícies. Verifier, integração e
meta-verificador registram nota de 0–10; menos de 8 ou falha crítica é FAIL.
**Atualizado em 2026-08-14:** “impressionante” deixou de ser só uma exigência de
evidência e virou a barra de aprovação — o verificador só libera o que o
impressiona, `8/10` é mínimo necessário e nunca suficiente, e nota alta em
entrega morna é FAIL com recalibração. A justificativa do que torna o resultado
extraordinário continua obrigatória, com critério e evidência.
Antes de inventar código, registrar fontes, candidatos reutilizáveis e decisão
de escolha/rejeição.

### [DECISÃO] A Constituição do produto impede terceirização da decisão
`docs/product/PRODUCT_CONSTITUTION.md` é a fonte canônica de comportamento da
Airia. O fluxo obrigatório é `INFERIR → PROPOR → CONFIRMAR`; a pessoa mantém
correção e veto, mas não deve ser obrigada a classificar a própria capacidade,
priorizar manualmente objetivos e devolver a decisão para a Airia quando já há
sinais suficientes. O fluxo da captura de tela de 2026-08-13 é `PRODUCT FAIL`
nessa condição, mesmo com testes técnicos passando.

### [FATO] Avaliações OpenAI locais usam a cadeia de certificados do Windows
Neste ambiente, a API da OpenAI responde HTTP 200 e a chave é válida, mas o
Node pode falhar com `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. Para `aura:eval` e
`ai:smoke`, usar `NODE_OPTIONS=--use-system-ca`; nunca desabilitar a validação
TLS. Com esse ajuste, `gpt-5.4-mini` passou em 10/12 e 11/11 respectivamente.

### [FATO] `TaskCompleted` é um evento próprio e não aceita matcher
No Claude Code atual, `Stop`, `SubagentStop` e `TaskCompleted` disparam sem
matcher. `TaskCompleted` recebe `task_subject`/`task_description` e pode impedir
uma subtarefa de ser marcada como concluída. O guard do projeto usa esse evento
apenas para a barreira determinística "código alterado nesta sessão sem nenhuma
verificação tentada"; suficiência do teste e qualidade do produto continuam no
protocolo.

### [FATO] O dev server do web roda na 5051, não na 5173
`apps/web/vite.config.ts`: `Number(process.env.PORT) || 5051`. Subir pelo
`preview_start {name: "web"}`, que já usa a porta certa de `.claude/launch.json`.
(O `CLAUDE.md` raiz dizia 5173 até 2026-08-08.)

### [FATO] `.gitignore` engole qualquer `*.js` e `*.cjs` fora das pastas de app
Linha `**/*.js` com negações só para `apps/web/src`, `apps/backend/src`,
`apps/mobile` e `packages`. Script de ferramenta escrito como `.js` em
`.claude/` ou `scripts/` **não vai para o repositório** e some no próximo clone.
Use `.mjs` (não é capturado pelo padrão) ou `.ts`.

### [FATO] `.dummy/memory/` é gitignored
Tem histórico útil de sessões antigas, mas não viaja com o repositório. Memória
durável é `docs/agent-memory/`.

### [FATO] O backend não tem script `typecheck`
`npm run build -w apps/backend` é `tsc` e faz esse papel. Procurar por
`typecheck` no backend e concluir "não dá para checar tipo" é erro de leitura.

### [FATO] Migração escrita não é migração aplicada — a lista real é o `deploy.sh`
`deploy/airia/deploy.sh` aplica **exatamente** os arquivos de `MIGRATION_FILES`,
um a um. Arquivo criado em `supabase/migrations/` e ausente dessa lista nunca
roda em produção, e nada no build reclama: em 2026-08-14 o
`20260811120000_add_objective_intelligence.sql` estava mergeado no master, com
CI verde, e o banco público não tinha nenhuma das colunas. Ao criar migração,
acrescente a linha no `deploy.sh` na posição cronológica; o
`migration-chain-safety.test.ts` agora trava a omissão e a ordem.

---

## Testes

### [FATO] O backend também descobre teste sozinho, desde 2026-08-08
`npm test -w apps/backend` roda `node scripts/run-tests.mjs`, que varre
`src/**/*.test.ts`. Antes era uma corrente de 76 comandos escritos à mão, e
**17 suítes existiam sem nunca ter rodado** — entre elas as três do check-in.
Todas passaram na primeira execução. O runner roda cada suíte em processo
próprio (várias mexem em estado global de módulo) e vai até o fim em vez de
parar na primeira falha.

### [FATO] No web é a mesma coisa — Vitest descobre sozinho
`apps/web/src/**/*.test.ts(x)` entra sem registro nenhum.

### [FATO] No web é o contrário — Vitest descobre sozinho
`apps/web/src/**/*.test.ts(x)` entra sem registro nenhum.

### [FATO] A suíte do backend termina com exit 0 imprimindo stack trace
Parte é teste de caminho de erro (intencional). Parte não parece ser. Exit code
sozinho não é leitura suficiente do resultado.

---

## Aparência e design system

### [FATO] `var()` que não resolve invalida a declaração inteira, em silêncio
Não é erro de build nem de tipo. Foi a causa dos dois piores bugs visuais do app:
texto de botão sumindo em Objetivos e "Criar objetivo" branco no branco. Origem:
`--nectarine` estava documentado no `apps/web/CLAUDE.md` e **nunca existiu no
CSS**. 27 tokens fantasmas foram encontrados de uma vez; outros 3 na primeira
execução da checagem automática.

Guarda hoje: `apps/web/src/styles/css-tokens.test.ts`.
**Regra derivada: fonte da verdade de token é `apps/web/src/styles/aura.css`,
nunca um valor escrito em documentação.**

### [DECISÃO] Identidade é verde; apelidos existem só por compatibilidade
`--accent-primary` `#BFDCCB`, forte `#8FC0A4`, texto `#4F7359`. Os apelidos
`--accent-peach*`, `--nectarine*`, `--menthe`, `--lagune` apontam para o verde.
**Código novo usa os canônicos.** O teste trava se um apelido voltar a receber
valor literal — é assim que o rosa reentraria.
Exceção deliberada: a logo mantém a paleta original (`AuraIcon.tsx` e bloco
`LOGO` de `splash-page.tsx`). Varredura de cor pula esses dois.

### [FATO] Trocar token não alcança cor escrita à mão
A virada verde trocou os tokens e **não tocou** em `rgba()` literal. O
`.home-header` — o primeiro card da Home — continuou salmão por isso, e mais três
lugares junto (`.tone-alert`, `.btn-secondary:active`, sombra do harmony).
Nenhum teste podia ter pego: não havia token envolvido.

Guarda hoje: caso "não há salmão nem rosa cravado" em `css-tokens.test.ts`. O
recorte é estreito de propósito (claro + quente + azul perto do verde) para não
alarmar sobre vermelho de erro, amarelo de aviso e marrom de texto, que ficam de
fora da paleta por decisão.

### [FATO] `display: contents` anula qualquer animação do elemento
`.page-transition` declarava `animation: page-enter` **e** `display: contents`.
Sem caixa gerada não há onde aplicar `opacity` nem `transform`: a transição
existia no CSS e nunca rodou, em nenhuma tela, desde que foi escrita.
Substituído por item flex (`flex: 1 1 auto; min-height: 0`) que repassa o layout
do `.app-viewport`, também flex-column — a rolagem das páginas continua igual.

### [FATO] `runtimeCaching` em `vite.config.ts` é config morta neste projeto
A estratégia é `injectManifest`, então o service worker é `src/sw.ts` e **só o
que está escrito lá roda**. As regras de cache de fonte no `vite.config.ts` nunca
valeram nada. Regra nova de cache vai em `src/sw.ts`; o bloco antigo ficou com
aviso em cima.

### [DECISÃO] Assets do mascote não entram no precache
`globPatterns` não lista `webp` de propósito: as 16 imagens somam ~420 KB e
ninguém precisa das oito fases baixadas para ver a primeira tela. Uma rota
`CacheFirst` em `src/sw.ts` (`airia-mascot-v1`) resolve o offline depois da
primeira exibição. Os PNGs-mestres (1,4 MB cada, 11,4 MB no total) **não estão na
master** — vivem na branch `codex/airia-orbital-mascot`, e
`apps/web/scripts/build-mascot-assets.mjs` regenera os WebP a partir deles.

---

## IA

### [FATO] Saída ruim de IA nem sempre é prompt ruim
O relatório de período falava do dia atual porque **recebia** `phaseLabel` e
"leitura atual" no payload. O prompt estava correto. Antes de reescrever prompt,
inspecione o que chegou ao modelo.
Regra derivada: investigar o pipeline inteiro — entrada, contexto, system prompt,
modelo, saída, pós-processamento, filtro, banco, UI.

### [FATO] Mandar `temperature: 0` cru quebra gpt-5/o-series com HTTP 400
E como a falha costuma ser engolida, o serviço morre calado. Use
`openAiTemperature()` de `lib/openai-config.ts`. Foi assim que o dedupe
semântico quase morreu em silêncio.

### [DECISÃO] Exemplo no prompt pesa mais que regra no prompt
O prompt trazia, como *exemplo bom*, "se você tivesse que fazer UMA coisa mínima
com isso hoje, qual seria?" — e a Airia passou a devolver a escolha da ação para
quem estava sem combustível. Hoje é proibição explícita, com teste que trava
regressão. Ao adicionar exemplo em prompt, verifique se ele não contradiz a regra.

### [DECISÃO] Pedir permissão ≠ devolver a escolha
"Posso colocar no seu plano?" depois de já ter formulado a meta é autorização
para salvar. O guardrail distingue os dois casos — sem essa asserção, alguém
"conserta" e apaga a funcionalidade do diário.

### [DECISÃO] Onboarding-história: conta e espelho são determinísticos de propósito
`apps/web/src/features/story-onboarding/reading.ts` não chama modelo. É onde um
número errado destruiria a confiança do fluxo e onde o modelo não acrescenta
nada. Verificação correta ali é teste unitário, não `aura:eval`.

### [DECISÃO] gpt-5.4-nano gera bem e reprova tudo como validador
Não usar nano como juiz. Ver `ai:judge-bench`.

---

## Arquitetura de produto

### [DECISÃO] Planner e Hábitos estão desligados, com o código inteiro vivo
`apps/web/src/config/features.ts`. As rotas continuam registradas redirecionando
para `/home`, porque notificação push já entregue e link salvo não podem cair em
404.
**Consequência para debugging:** existe código executável que não aparece na tela.
Antes de investigar "essa tela sumiu", cheque `FEATURES`.

### [FATO] Gamificação de objetivos usa `EventLog`, não tabela nova
`subgoals` é JSONB sem data de conclusão, então não dá para derivar "quando".
`EventLog` já tem índice por `(userId, eventName)` e já está na allowlist de
privacidade. Custo: zero migração. Os contadores têm piso derivado do estado
atual; a sequência de dias começa do zero e isso é honesto, não bug.

### [FATO] `Consent` existia, era exportada e nunca era escrita
O app não conseguia provar consentimento LGPD. Corrigido em
`consent.service.ts`, gravando no primeiro acesso autenticado, idempotente por
`(userId, consentType, version)` com `update: {}` — reexecutar não sobrescreve a
data, que é o dado com valor legal. Revogação **marca, não apaga**.

### [DECISÃO] Falha no dedupe cria a ação
Ver dois itens parecidos incomoda; perder o que a pessoa pediu para anotar é
grave. Vale para as duas camadas (lexical e LLM). Gravação em lote é **em série**,
para cada verificação enxergar o que a anterior gravou.

### [FATO] Campo pode existir em três camadas e nunca ser perguntado
`irritabilityScore` tinha coluna no Prisma, campo no contrato, leitor no motor
(`aggregateCheckinsByDay`) e consumidor no backend (`risk-safety`, limiar ≥ 9), e
a tela do check-in **nunca perguntou**. `clarityScore` idem, sem nem consumidor.
No sentido inverso, `capacity` e `priorityGoalId` eram perguntados e viajavam só
pelo `navigate(state)`, morrendo ao fechar a tela.
**Regra que ficou:** para cada pergunta da tela, provar que o valor chega ao
banco e que alguma análise consome — ou registrar por que existe sem consumidor.
Build verde não prova nada disso; a prova está em
`features/aura/checkin-submission.test.ts` (tela → payload) e
`services/checkin-application.service.test.ts` (payload → persistência).

### [FATO] `signalMetadata` é `.strict()` — chave nova exige mudar o contrato
`contracts/checkin-draft.contract.ts`. Não é saco de JSON livre. O diário
mandava `{ surface: 'journal' }`, o `parse` lançava, e o endpoint de streaming
engolia a exceção num `catch` mudo: **a proposta de check-in do diário nunca
funcionou**, e a de meta morria junto por vir depois no mesmo laço. Hoje o
esquema aceita `surface` e `dayPlan`.

### [FATO] Um pool de conexões por processo, e o dono é `lib/prisma.ts`
`P2024` em produção não era banco cheio: existiam **nove** `new PrismaClient()`
(index, middleware de auth e sete serviços), cada um com pool próprio. O pool de
uma rota estourava enquanto os outros oito seguravam conexões paradas.
O limite de 5 vinha do Prisma derivando `núcleos × 2 + 1` — o contêiner enxerga
2 CPUs. Número que descreve a CPU, não o banco, ainda mais com `DATABASE_URL`
no pooler do Supabase (porta 6543, `pgbouncer=true`).
Hoje: cliente único com `connection_limit=15` explícito na URL, medido contra
`max_connections=60`. Efeito real após o deploy: conexões do app caíram de 17
para 3 e o total no banco de 35 para 17.
`lib/prisma.test.ts` varre o código e falha se alguém instanciar de novo fora
desse arquivo.

### [FATO] O app não estava no Google, e a causa era a rota raiz
`/` fazia `Navigate` para `/splash`. O Googlebot executa JS, via o
redirecionamento, e o Search Console classificava a home como "Página com
redirecionamento" — nunca indexada, zero cliques de busca. Hoje `/` renderiza a
splash e `/splash` manda para a raiz.
Segundo problema no mesmo diagnóstico: `www.airia.pro` e `airia.pro` serviam o
site com 200, e o Google elegeu o **www** como canônico — host que nem estava na
propriedade cadastrada. A correção por 301 foi revertida no mesmo dia (ver
"Tentativas que já falharam"): os dois hosts continuam servindo 200 de propósito,
e a consolidação é feita **só** por `rel=canonical`. O deploy valida que o `www`
responde 200 e que a canônica aponta para o host sem `www` nas duas versões.
**Propriedade no Search Console:** `https://airia.pro/` (prefixo de URL), na
conta allinerosamkup@gmail.com. Não existe propriedade de domínio — e por isso
qualquer URL que o Google resolva eleger no `www` fica invisível no relatório e
sem como pedir indexação. Propriedade de domínio cobriria os dois hosts de uma
vez; exige um registro TXT no DNS (Hostinger, zona `airia.pro`).

### [FATO] O DNS de `airia.pro` cobre os dois hosts e as duas famílias de IP
Medido em 2026-08-10, via DoH: `airia.pro` tinha `A → 195.35.17.102` e
`www.airia.pro` tem `CNAME → airia.pro`, ambos em `ns1/ns2.dns-parking.com`
(Hostinger). Os dois hosts servem HTTP 200 com o mesmo `etag`, o certificado
Let's Encrypt cobre os dois (`CN=airia.pro` + SAN `www.airia.pro`) e o `http://`
de cada um faz 301 para o próprio `https://`. Portanto, a reclamação de página
não encontrada no `www` não era falta do `CNAME` nem de TLS.

Em 2026-08-12 foi confirmado um buraco diferente: a VPS tinha o IPv6 global
`2a02:4780:14:ddb2::1`, funcional em SNI/TLS e no `/api/health`, mas a zona não
tinha `AAAA`. Isso deixava redes móveis IPv6-only dependentes de NAT64/DNS64 da
operadora. O `AAAA` foi publicado somente na raiz; o `www` o herda pelo CNAME.
Hostinger, nameserver autoritativo, Google DNS e Cloudflare DoH confirmaram a
propagação; IPv4 e IPv6 responderam 200. Não usar o IPv6 fictício do teste nem
reativar o redirecionamento de host.

O que faltava: `privacy.html` e `terms.html` são arquivos estáticos servidos
fora do `<head>` da SPA e **não tinham `rel=canonical` nenhum**, sendo duas das
quatro URLs do sitemap. Com dois hosts em 200 e nenhum sinal de consolidação,
o Google pode eleger `www.airia.pro/privacy` — host fora da propriedade do
Search Console. As rotas do SPA nunca tiveram esse problema porque herdam a
canônica do `index.html` estático.
Trava: `apps/web/src/lib/public-pages-canonical.test.ts` (arquivo) + checagem de
canônica nos dois hosts no `deploy.sh` (produção).
**Aviso para rota pública nova:** toda rota do SPA herda a canônica do
`index.html`, que aponta para a raiz — então nasce se declarando duplicata da
home e sem como ser indexada por si. Foi o caso de `/livro`, corrigido com
`<head>` estático próprio e depois removido junto com a página (o e-book saiu do
produto em 2026-08-10; a rota ficou redirecionando para a home, como Planner e
Hábitos). O caminho está provado e documentado em `apps/web/CLAUDE.md`: gerar o
`<head>` em `build-seo-html.mjs` e servir pelo nginx. Canônica só em JavaScript
não resolve — deixa o HTML cru contradizendo o DOM renderizado, e prévia de link
não executa JS.

### [FATO] Deploy verde não significa build completa
`Dockerfile.web` chamava `node ./node_modules/vite/bin/vite.js build`, então
tudo que o script `build` faz além do Vite era pulado — `index.en.html` saiu
verde no build local e simplesmente não existia na imagem, com `?lang=en` em
404 na produção, e o deploy passou inteiro. Hoje o Dockerfile usa `npm run
build` e o deploy valida `/?lang=en`, `/robots.txt`, `/sitemap.xml`, o 200 do
`www` e a canônica das páginas indexáveis nos dois hosts. O `build` invoca o
Vite pelo caminho do node porque no Alpine o atalho em `.bin` chega sem permissão
de execução.

### [FATO] `input[type=range]` não dispara evento ao tocar onde o polegar já está
Campo opcional começa com o polegar no meio da escala, então o valor do meio —
6 numa escala de 1 a 10 — era o único impossível de responder com um toque: a
pessoa via o polegar no lugar certo e o app gravava `null`. O `ScoreSlider`
confirma o valor exibido no `pointerup`/`keyup` enquanto o campo estiver vazio.
`sliderRestingValue()` existe para o teste travar o número.

---

### [FATO] O cliente web `api` já inclui o prefixo `/api`
`apps/web/src/lib/api.ts` monta cada chamada como `API_URL + endpoint`, e o
`API_URL` padrão já termina em `/api`. Portanto componentes devem chamar
`api.get('/billing/status')`, nunca `api.get('/api/billing/status')`; o segundo
formato vira `/api/api/...` e só costuma passar em teste quando o método inteiro
é mockado. `billing-page.test.tsx` agora varre as superfícies novas para impedir
essa regressão.

### [FATO] Login no Dashboard Stripe não reautentica o conector Stripe do Codex
A sessão do navegador e o OAuth do conector são independentes. Em 2026-08-10,
o Chrome mostrou a conta AIRIA autenticada enquanto as chamadas do conector
continuaram retornando `oauth_token_invalid_grant`. Não tratar login no painel
como recuperação da API; reautenticar o conector ou usar uma sessão de navegador
controlável, sem copiar chave secreta para o chat.

### [FATO] Objetivo é direção versionada; Home recebe só a ação vigente
Desde 2026-08-11, `GoalIntelligenceService` é o motor único para objetivos. O
contrato separa resultado, realidade atual, marcos futuros resumidos e ações
detalhadas somente da etapa vigente. Ações concluídas ou editadas pela pessoa
impedem regeneração direta: contexto novo cria `pathProposal` cercada por
`pathVersion`, e só a confirmação na mesma versão altera o futuro. A estrela
humana fica em `UserPreference.primaryObjectiveId` e sempre vence a sugestão da
Airia. Prazo do objetivo e data da ação ajudam a leitura, mas nunca substituem
significado e contexto. Planner, Hábitos e Google Agenda permanecem capacidades
desligadas; fluxo de objetivo não cria timeline.

### [FATO] Escritas versionadas de Objetivos não aceitam envelope global do web
O cliente injeta horário, contexto adaptativo e idioma em mutações genéricas,
mas `/objectives` e suas subrotas usam contratos estritos e devem receber o body
exato. Enriquecê-las no wrapper gera `unrecognized_keys` antes da criação.

### [FATO] Consulta informativa da Aura não é contexto novo
Perguntar qual é o objetivo, realidade ou prioridade apenas lê o estado e não
autoriza proposta de revisão. Mudança material declarada continua acionando a
revisão. Ao combinar etapas preservadas com etapas geradas, normalize IDs para
unicidade antes de persistir a proposta; modelos podem repetir IDs existentes.

### [DECISÃO] `BILLING_PROVIDER` não tem fallback automático, e o padrão é `cakto`
`billing-provider.ts` só usa Stripe quando alguém escreve `stripe`; sem os
segredos da Cakto o provedor vira `UnavailableBillingProvider` e
`checkoutAvailable` fica `false` — a tela de plano deixa de vender em vez de
cair para o Stripe calado. É de propósito: dois provedores ativos ao mesmo tempo
duplicariam cobrança. Consequência operacional: **subir o código sem os segredos
desliga a compra**; o contorno explícito é `BILLING_PROVIDER=stripe`.

### [FATO] Aviso de "confirmando pagamento" precisa de prazo, não de confirmação
O retorno do checkout Cakto não traz `session_id` na URL, então a tentativa fica
em `sessionStorage`. Apagar só quando confirma faz quem desistiu do pagamento
reencontrar "Confirmando seu pagamento" para sempre. A chave vale 30 minutos;
perder o aviso não perde compra, porque quem libera acesso é o webhook.

### [DECISÃO] Divergência de histórico bloqueia `supabase db push`, não a validação segura
Quando as migrações locais e remotas divergem, não reparar histórico durante uma
feature. Validar o SQL integral contra os dados reais em transação revertida e
exercitar o runtime em schema isolado. Aplicação pública fica para uma janela de
produção autorizada com reconciliação explícita.

---

## Tentativas que já falharam

> Antes de tentar uma correção para problema já investigado, leia esta seção.
> Repetir só com informação nova, código alterado, ambiente diferente ou
> hipótese diferente.

### [TENTATIVA FRACASSADA] Redirecionar `www` para o host sem `www`
Durou duas horas em 2026-08-09 e quebrou o app em produção. **O PWA está
instalado em `www.airia.pro`**, e redirecionamento de host atinge todas as
rotas, inclusive `/api/`: `POST /api/checkins` virou 301 (POST redirecionado não
é reenviado como POST) e os GET voltaram 401 (o `Authorization` é descartado no
salto entre origens). Sintoma para quem usa: app abre sem histórico e check-in
não salva. Pior, `localStorage` é por origem — sessão e cache do PWA vivem em
www e não acompanhariam a mudança.
A consolidação de busca é feita por `rel=canonical`, que aponta para
`https://airia.pro/` nas duas versões e é sinal legítimo sem redirecionar.
Se um dia unificar de verdade: excluir `/api/`, avisar quem tem o PWA instalado
que precisará entrar de novo, e só então ligar.
**Lição transversal:** validação de deploy que confere só a home não vê API
quebrada. A checagem que eu tinha escrito exigia o 301 — ela teria aprovado
exatamente esta quebra.

### [TENTATIVA FRACASSADA] Documentar valor de token de design em `CLAUDE.md`
Resultado: documentação e CSS divergiram, nasceram tokens fantasmas, dois bugs
visuais em produção. Substituído por: fonte única em `aura.css` + teste
automático. Não voltar a escrever valor de cor em documentação como se fosse
fonte.

### [TENTATIVA FRACASSADA] Bloqueio global de scroll no PWA Android
Congela a tela. A rolagem tem que acontecer dentro de `.page-transition`; no iOS,
bloquear apenas o gesto horizontal de borda.

### [TENTATIVA FRACASSADA] Trocar o modelo global só olhando a superfície que falhava
Conserta a validação e quebra o contrato de saída de outra superfície. Por isso
existe `npm run ai:smoke` — ele manda um prompt representativo de **todas** as
superfícies.

### [FATO] A capacidade do dia tem uma implementação só: `lib/capacity.ts`

Era calculada em cinco pontos com fórmulas diferentes. Hoje `inferCapacity()`
decide e os antigos viram adaptadores (`toGoalCapacity`, `toDecisionFlags`).
Escala: `protecao | baixa | media | alta`. Antes de escrever qualquer regra de
"quanto cabe hoje", use esta função — uma sexta fórmula é o bug, não a solução.

`phase-capacity.ts` fica de fora **de propósito**: decide a semana do Routine
Builder (feature desligada), não o momento. Não é esquecimento.

### [FATO] O `DecisionEngine` já ligou `lowCapacity` e `highCapacity` juntos

Fase alta com sono medido ruim satisfazia as duas condições, que são lidas em
pontos diferentes do motor: o dia saía protegido num trecho e ampliado no outro.
Corrigido ao passar a um nível único. `capacity.test.ts` exercita o estado
contraditório e exige que ele resolva protegendo.

### [DECISÃO] Unificar escalas nunca pode aumentar o que o app pede

Ao juntar as cinco fórmulas, três energias divergiam (4, 5 e 7) e em todas o
código antigo era o que pedia mais. A regra virou asserção em `capacity.test.ts`:
para energia 1..10, o canônico jamais pede mais que o legado. Qualquer mudança
futura de corte passa por essa trava.

### [FATO] Prompt que afirma origem falsa é tão grave quanto pergunta na tela

`goal-intelligence.service.ts` dizia ao modelo "CAPACIDADE DE HOJE (dita por ela
agora)" sobre um valor derivado de `energyScore`. O modelo respondia "como você
pediu" sobre algo que ninguém perguntou. Guardrail novo em
`product-guardrails.test.ts` (`falseCapacityProvenancePatterns`) reprova a frase.

### [FATO] `npm run build -w apps/backend` falha com 6 erros de `billingProvider` se o Prisma Client estiver velho

Parecem bug de cobrança e não são. Rode `npx prisma generate` antes de
investigar. O `generate` falha com `EPERM` se o servidor de dev estiver rodando —
pare o backend antes.

### [FATO] `.catch()` não pega método de stub inexistente

`prisma.x.findMany(...)` quando `findMany` é `undefined` estoura de forma
síncrona; o `.catch()` encadeado nunca roda. Em caminho best-effort sobre Prisma,
use `try/catch`.
