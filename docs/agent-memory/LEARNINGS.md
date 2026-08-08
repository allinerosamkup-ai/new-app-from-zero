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

---

## Testes

### [FATO] Teste novo do backend não roda até entrar na string do `npm test`
`apps/backend/package.json` lista os arquivos um a um em
`ts-node-transpile-only ... && ...`. Sem descoberta automática. Criar um teste,
vê-lo passar local e commitar não coloca nada na CI. Ver `KNOWN_ISSUES.md`.

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

---

## Tentativas que já falharam

> Antes de tentar uma correção para problema já investigado, leia esta seção.
> Repetir só com informação nova, código alterado, ambiente diferente ou
> hipótese diferente.

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
