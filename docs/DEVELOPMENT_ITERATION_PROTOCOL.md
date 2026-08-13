# Protocolo de Desenvolvimento, Iteração e Conclusão — Airia

> **IMPLEMENTATION IS NOT COMPLETION.
> VERIFICATION IS PART OF IMPLEMENTATION.**

Este documento é obrigatório para qualquer agente que altere código neste
repositório — Codex/GPT, Claude Code ou outro agente que carregue as instruções
do projeto. Ele existe porque o modo de falha mais caro de um agente de código
não é escrever código errado — é **parar cedo demais**: receber tarefa, alterar
arquivos, declarar pronto.

Neste projeto, **alterar arquivos não conclui tarefa nenhuma.** Uma tarefa está
`DONE` quando existe evidência verificável de que o comportamento pedido
funciona no contexto real em que vai ser usado.

Entradas das plataformas:
- `AGENTS.md` — adaptador obrigatório para Codex/GPT e agentes que carregam instruções de projeto.
- `CLAUDE.md` — adaptador obrigatório para Claude Code.
- `C:\Users\allin\.codex\AGENTS.md` — regra global do Codex para descobrir este documento quando ele existir.

Memória e documentação relacionadas:
- `docs/agent-memory/` — memória persistente (o que já foi descoberto).
- `docs/product/PRODUCT_CONSTITUTION.md` — fonte canônica do comportamento,
  da carga cognitiva e das decisões de produto da Airia.
- `skills/airia-pr-review/SKILL.md` — revisão obrigatória de PR/feature/deploy.
- `AGENTS.md` e `CLAUDE.md` — identidade de produto e regras de conteúdo.

---

## 0. Como usar este documento

Não leia inteiro toda vez. O caminho normal é:

1. Ler §1 (ciclo) e §3 (Definition of Done) — sempre.
2. Consultar §6 (matriz de verificação) para escolher **quais** verificações a
   tarefa exige.
3. Copiar os comandos reais de §5.
4. Passar pelo gate de §15 e pelo ciclo Git/worktree de §22 antes de responder
   `DONE`.

Tarefa trivial (corrigir uma string, renomear variável interna) atravessa isso
em trinta segundos. Tarefa de fluxo de usuário ou de IA não atravessa.

---

## 1. O ciclo obrigatório

```
LER MEMÓRIA
   ↓
UNDERSTAND ──→ DEFINE DONE ──→ INSPECT ──→ SEARCH/REUSE ──→ IMPLEMENT ──→ RUN ──→ VERIFY
                                                                    │
                                             ┌──────────────────────┤
                                          FALHOU                 PASSOU
                                             │                      │
                                        DIAGNOSE               REGRESSION CHECK
                                             │                      │
                                    CHECAR TENTATIVAS          ATUALIZAR MEMÓRIA
                                        ANTERIORES                  │
                                             │                     DONE
                                     NOVA TENTATIVA
                                       INFORMADA
                                             │
                                        RE-VERIFY ──┘
```

Cada volta do laço tem que **aumentar o que se sabe sobre o problema**. Três
voltas sem aprender nada significa que o laço está sendo executado errado — vá
para §11.

### UNDERSTAND

Antes de editar:

- entender o comportamento pedido, não a frase pedida;
- quando a tarefa afetar produto, UX, IA, fluxo ou arquitetura, ler
  `docs/product/PRODUCT_CONSTITUTION.md` e transformar seus princípios em
  critérios de aceite;
- localizar **todos** os arquivos relevantes — este repo tem funcionalidade
  espelhada em `apps/web`, `apps/backend` e `apps/mobile`, e mudar só o primeiro
  arquivo encontrado é o erro clássico daqui;
- identificar dependências (contrato de API, schema Prisma, tokens CSS,
  chaves de i18n, `FEATURES` em `apps/web/src/config/features.ts`);
- identificar o padrão já usado pelo projeto e seguir esse padrão;
- identificar impacto colateral: quem mais consome esse dado?

Perguntas específicas deste repo que evitam retrabalho:

| Pergunta | Onde conferir |
|---|---|
| A tela está ligada? | `apps/web/src/config/features.ts` (Planner e Hábitos estão `false`) |
| O token CSS existe mesmo? | `apps/web/src/styles/aura.css` — ver §"token fantasma" em `apps/web/CLAUDE.md` |
| Esse texto é traduzido? | `apps/web/src/i18n/` — `source-audit.test.ts` trava string solta |
| Esse teste roda na CI? | `.github/workflows/ci.yml` + `apps/backend/scripts/run-tests.mjs` — o backend descobre `src/**/*.test.ts` |
| Já mexeram nisso? | `docs/agent-memory/LEARNINGS.md` e `docs/plans/` |

### DEFINE DONE

Ver §3.

### INSPECT

Ler o código atual antes de escrever o novo. Rodar o app quando o
comportamento atual for parte do diagnóstico (bug) — ver §9.

### SEARCH / REUSE BEFORE INVENT

Antes de escrever qualquer código novo, procurar se uma solução compatível já
existe. **Criar do zero é a última opção razoável, não o reflexo padrão.** A
busca deve seguir esta ordem, adaptando o alcance ao risco e à natureza da
tarefa:

1. código e padrões já existentes no repositório;
2. todas as worktrees e branches relevantes, histórico Git, planos e memória;
3. dependências já instaladas, scripts, componentes, serviços e contratos do
   monorepo;
4. documentação oficial e exemplos oficiais da tecnologia ou integração;
5. quando autorizado e necessário, GitHub/code search, repositórios open source
   mantidos, package registries, bibliotecas de componentes, templates,
   conectores e catálogos/bancos de aplicativos que ofereçam a mesma função ou
   uma função próxima;
6. somente depois, projetar e escrever uma solução nova.

Para cada candidato externo relevante, conferir antes de copiar ou adaptar:

- se resolve o comportamento pedido, e não apenas algo visualmente parecido;
- licença, atribuição e compatibilidade com o uso deste projeto;
- manutenção, atividade, releases, issues e compatibilidade com as versões
  atuais;
- segurança, dependências transitivas, permissões, coleta de dados e risco de
  supply chain;
- qualidade dos testes, tratamento de erro, acessibilidade e performance;
- custo de adotar e manter a solução contra o custo de implementá-la aqui.

Preferir reutilizar e adaptar uma solução compreendida, pequena e compatível.
Não copiar código cegamente, não incorporar dependência sem necessidade e não
trazer código cuja licença, origem ou comportamento não possam ser explicados.
Não executar scripts de instalação remotos ou introduzir credenciais para
experimentar um candidato.

Registrar em `CURRENT_STATE.md` ou `LEARNINGS.md`, quando a busca for relevante,
o que foi encontrado, o que foi escolhido ou rejeitado e o motivo. Se nada
adequado existir, registrar brevemente quais fontes foram consultadas antes de
inventar a implementação. A busca não substitui os testes: código reutilizado
entra no mesmo ciclo de verificação, segurança e regressão do código novo.

Para qualquer tarefa que crie ou altere código, a evidência de busca é parte do
contrato de execução: registrar as fontes consultadas, os candidatos relevantes,
a decisão de reutilizar/adaptar ou a rejeição fundamentada. “Não encontrei” sem
fontes, consultas e justificativa não satisfaz o gate.

### IMPLEMENT

Ver §4 (incremental).

### RUN / VERIFY / DIAGNOSE / FIX / RE-VERIFY

Ver §5, §6, §7, §10.

### REGRESSION CHECK

Ver §6-J.

---

## 2. O que **não** conclui uma tarefa

Nenhum destes eventos, sozinho ou combinado, autoriza dizer "pronto":

- o código foi escrito;
- o componente foi criado;
- os arquivos foram alterados;
- `tsc --noEmit` passou;
- `vite build` passou;
- um teste isolado passou;
- o código "parece certo" na leitura.

São etapas intermediárias. A CI deste projeto (`.github/workflows/ci.yml`)
roda exatamente esses checks — e ainda assim os três bugs de aparência mais
caros do app passaram por ela inteira: `var(--token)` que não resolve não gera
erro de build nem de tipo, só some da tela.

---

## 3. Definition of Done antes de implementar

Transformar o pedido em critérios verificáveis **antes** de editar. Isso impede
o agente de redefinir silenciosamente "pronto" depois de ver o que conseguiu
construir.

Ruim:

```
- botão corrigido
```

Aceitável:

```
- botão visível com contraste legível no fundo claro
- clique dispara a chamada real (não console.log, não Alert)
- loading aparece durante a operação
- erro do backend aparece na tela com texto útil
- sucesso atualiza a interface
- dado persiste
- F5 mantém o estado salvo
- nenhuma regressão no fluxo vizinho
```

Regra de tamanho:

| Tarefa | Formato do DoD |
|---|---|
| Trivial (copy, constante, comentário) | mental, uma linha na resposta final |
| Média (componente, endpoint, regra) | checklist explícita na resposta |
| Grande (feature, fluxo, migração) | `docs/agent-memory/CURRENT_STATE.md` + Sprint Contract (§14) |

---

## 4. Implementação incremental

Preferir **uma unidade coerente → verificar → próxima unidade** em vez de
**alterar 15 arquivos → testar tudo no fim**.

Para tarefa grande:

1. decompor em unidades verificáveis;
2. implementar uma;
3. verificar aquela;
4. corrigir;
5. só então avançar.

Uma subtarefa não é marcada como concluída sem o comportamento correspondente
ter sido verificado.

Neste monorepo a decomposição natural é vertical, não horizontal: **schema →
serviço → rota → contrato → UI → tela real**, uma fatia de cada vez. Fazer "todo
o backend" e depois "todo o frontend" adia a descoberta do desalinhamento de
contrato para o pior momento possível.

---

## 5. Comandos reais deste repositório

**Não invente comando.** Esta é a lista verificada (2026-08-08), com tempo medido
em máquina local Windows.

### Verificação estática

```bash
npm run typecheck -w apps/web
```
`tsc --noEmit` no frontend. ~18s. É o check barato número um do web.

```bash
npm run build -w apps/backend
```
No backend **não existe** script `typecheck`: `build` é `tsc`, e é ele que faz o
papel de typecheck. ~30s.

```bash
npm run lint -w apps/web
```
ESLint com `--max-warnings 0`. Não está na CI — rode quando mexer em muito
arquivo.

```bash
npm run build -w apps/web
```
Build Vite. É o que a VPS roda no deploy.

```bash
npm run generate -w packages/database
```
Obrigatório depois de mexer em `packages/database/prisma/schema.prisma`.
Não precisa de `DATABASE_URL`.

### Testes

```bash
npm run test -w apps/web
```
Vitest descobre automaticamente os arquivos `*.test.ts(x)` dentro de
`apps/web/src`; leia a contagem efetiva da execução em vez de copiar um número
fixo para a documentação.

```bash
npm run test -w apps/backend
```
O runner `apps/backend/scripts/run-tests.mjs` descobre `src/**/*.test.ts`,
executa cada suíte em processo próprio e continua até o fim para reportar todas
as falhas. Um teste novo entra automaticamente; ainda assim, leia o log inteiro:
há testes de caminho de erro que imprimem stack trace e a suíte pode terminar
com exit 0.

```bash
npm run test:auth -w apps/backend
npm run test:memory -w apps/backend
npm run test:routine -w apps/backend
```
Recortes temáticos. `test:auth` é gate separado na CI.

```bash
npx ts-node-transpile-only apps/backend/src/lib/risk-safety.test.ts
```
**Teste único do backend: ~2,5s.** É o laço rápido. Use isto durante a
implementação e deixe a cadeia inteira para o fim.

```bash
npx vitest run src/routes/goals-page.test.tsx --root apps/web
```
Teste único do web.

### Avaliação de IA

```bash
npm run aura:eval -w apps/backend
```
Chama a OpenAI de verdade contra os fixtures de
`apps/backend/src/lib/aura-eval/cases.ts` e pontua contra invariantes
determinísticos (`matchers.ts`). Precisa de `OPENAI_API_KEY`. Critério:
`AURA_EVAL_PASS_THRESHOLD` (padrão 10 de 12).

```bash
npm run ai:smoke -w apps/backend
```
Manda um prompt representativo de **cada superfície de IA** e valida o formato
de saída contra o que o app espera. Obrigatório ao trocar de modelo.

```bash
npm run ai:judge-bench -w apps/backend
```
Compara modelos como validador.

### Rodar o app

Use `preview_start` com os nomes de `.claude/launch.json` — nunca `npm run dev`
solto pelo Bash:

| Nome | Porta | O que é |
|---|---|---|
| `backend` | 3001 | Express + Prisma |
| `web` | **5051** | Vite dev server |
| `mobile` | 8081 | Expo (pausado) |
| `prisma-studio` | 5555 | inspeção de banco |

> A porta do web é **5051** (`apps/web/vite.config.ts`), não 5173.

Healthcheck de produção: `https://airia.pro/api/health` e `https://airia.pro/home`.

### Ordem da CI (`.github/workflows/ci.yml`)

```
npm ci
→ generate (database)  → build (database)
→ build backend (tsc)  → build web (vite)
→ typecheck web
→ test web (vitest)
→ test:auth backend    → test backend
```

Se sua mudança precisa passar na CI, esta é a sequência que ela vai enfrentar.

---

## 6. Verification Context Matrix

Nem toda alteração exige todas as verificações. A pergunta que seleciona é:

> **“Em quais contextos esta alteração pode estar correta em código e ainda
> assim estar errada para a usuária ou para o sistema?”**

### A. Static Verification
Sintaxe, TypeScript, lint, imports, schema, build.
Detecta problema estrutural. **Não prova que a funcionalidade funciona.**
Comandos: §5 "Verificação estática".

### B. Unit Verification
Para funções puras, regras, transformações, cálculos, parsers, validações.
Onde este projeto concentra isso: `mood-cycle-engine.ts`, `period-report.ts`,
`action-similarity.ts`, `phase-capacity.ts`, `risk-safety.ts`, helpers `*.helpers.ts`.
Verificar caso normal, limite e falha.

### C. Integration Verification
Quando a mudança atravessa frontend ↔ backend, API ↔ Prisma, serviço ↔ serviço,
auth, Supabase, Google Agenda, Stripe, push.
Os testes de `apps/backend/src/contracts/` existem exatamente para isso.
**Duas partes corretas isoladamente não provam que a integração funciona.**

### D. Runtime Verification
Rodar o software. Observar erro de runtime, console, log do servidor, falha de
rede, exception, estado inesperado.
Ferramentas: `preview_logs`, `read_console_messages`, `read_network_requests`.

### E. UI / Browser Verification
Para qualquer coisa visível ou interativa. Abrir a tela e agir nela:
renderização, clique, digitação, navegação, loading, empty, erro, sucesso,
disabled, refresh, back/forward, scroll, modal, overlay, estado persistido.
Ferramentas: preview do app (`preview_start`) ou Playwright MCP.
**App que builda mas não funciona no navegador não está concluído.**

### F. Visual Verification
Layout, hierarquia, espaçamento, alinhamento, clipping, overflow, contraste,
tamanho. Abrir a tela e olhar; screenshot quando disponível.
Inspecionar CSS/JSX **não** é prova — este projeto já perdeu botões inteiros
para `var()` que não resolvia e continuava lindo no código.

### G. Responsive Verification
O produto é PWA mobile-first. O breakpoint que importa é **mobile**; desktop é
secundário. `resize_window` com preset `mobile` e recarregar (há gates de
dispositivo que rodam no load).

### H. Data Verification
Onde há persistência, o ciclo completo:
`CREATE → READ → UPDATE → RELOAD → VERIFY` e, quando relevante, `DELETE → VERIFY`.
Confirmar que o que a tela mostra corresponde ao que está gravado (Prisma
Studio ou Supabase MCP `execute_sql`).
Cuidado local: parte do estado do app vive em `localStorage`
(`gtd-inbox-v1`, sessões do routine-builder). Recarregar não prova banco.

### I. API Verification
Request, response, status, payload, validação Zod, auth (JWT + filtro por
`userId`), erro, efeito colateral, persistência.
Contrato documentado em `docs/product/api-contracts.md`.

### J. Regression Verification
Depois da correção específica, o vizinho. Estratégia progressiva:
1. o teste mais próximo da alteração;
2. os testes do módulo;
3. a integração relacionada;
4. regressão ampla quando o risco justificar.
Não rodar a suíte inteira a cada linha; não terminar sem rodar nada.

### K. Accessibility Verification
Label, navegação por teclado, foco, elemento semântico, contraste, ARIA, alvo de
toque confortável no mobile.

### L. Security Verification
Para auth, autorização, dado sensível, upload, input externo, API, permissão,
token, banco.
Invariantes deste projeto: **toda query filtra por `userId` do JWT**; toda tabela
nova tem RLS + policy (`packages/database/CLAUDE.md`); exportação de privacidade
tem allowlist (`privacy-allowlist.test.ts`); segredo nunca entra em código.
`/security-review` quando a superfície justificar.

### M. Performance Verification
Query, laço, lista grande, imagem, renderização, startup, rede, bundle, chamada
repetida. Verificar que não houve regressão óbvia.

### N. Semantic Verification (IA) — ver §8
Específica deste produto. Resposta tecnicamente válida e semanticamente errada é
`FAIL`.

---

## 7. Verificação por comportamento, não por arquivo

Nunca pensar:

> "Terminei `home-page.tsx`, então terminei a tarefa."

Pensar:

> "De qual comportamento este arquivo participa, e como provo que esse
> comportamento funciona?"

Arquivos são unidades de implementação. **Comportamentos são unidades de
conclusão.**

### Verificação end-to-end do fluxo do usuário

Quando a tarefa representa uma ação real da usuária, testar da perspectiva dela.
Para "corrigir criação de objetivo", não basta `createGoal()` retornar sucesso:

```
abrir /goals
→ iniciar criação
→ preencher
→ confirmar
→ objetivo aparece na lista
→ próxima ação aparece concluível
→ concluir a micro-ação → XP aparece
→ F5
→ objetivo continua lá com o progresso certo
→ a Home mostra o mesmo objetivo em foco
```

O teste tem que corresponder à experiência que motivou a tarefa.

---

## 8. Comportamento real, browser e IA

> **CODE CORRECTNESS IS NOT PRODUCT CORRECTNESS.**

Existe uma categoria de falha que build, lint, tipo e teste unitário não pegam: o
código está tecnicamente certo e o que chega na usuária está errado, incoerente
ou inútil. Neste produto — cujo núcleo é geração por LLM — essa é a categoria
**mais provável**, não a exceção.

### 8.1 Testar o que a usuária recebe

Pergunta obrigatória: *"o que exatamente ela vai ver, receber ou conseguir fazer
depois desta alteração?"* A verificação acontece nesse nível.

Não basta:

```
LLM retornou JSON        API respondeu 200        função concluiu
```

É preciso:

```
Usuária escreve: "Deixar a sala pronta para uso"
Sistema devolve próximas ações coerentes com isso.
```

Se a saída for tecnicamente válida e semanticamente absurda — do tipo *"pegue
fita crepe e verifique se alguma área do chão está solta"* — o resultado é
`FAIL`, mesmo com API 200, JSON válido, componente renderizado e dado
persistido. Isso é bug de produto.

### 8.2 Formato correto ≠ conteúdo correto

`{"action": "Comprar fita crepe"}` passa schema, parse, tipo e contrato de API —
e reprova no requisito. Onde a qualidade semântica é o produto, avalie a saída,
não o envelope.

Perguntas da avaliação semântica: a resposta é coerente com a intenção? atende ao
objetivo? é útil? é executável? há contradição? há informação inventada? há
suposição arbitrária (assumir chão solto, assumir material)? a granularidade faz
sentido? respeita o contexto disponível? é genérica demais? a IA entendeu a etapa
do fluxo?

### 8.3 Superfícies que exigem verificação semântica

`goal-intelligence`, `task-decomposition`, `journal-understanding`,
`aura-command`, `decision-engine`, `checkin`, `monthly-report`,
`onboarding-ai`, `story-onboarding`. Qualquer uma delas alterada → §8 vale.

Exceção deliberada: a conta e o espelho do onboarding
(`features/story-onboarding/reading.ts`) são **determinísticos de propósito** —
ali o correto é teste unitário, não avaliação de modelo.

### 8.4 Verificar prompt **e** contexto **e** saída

Bug de IA não é automaticamente bug de prompt. O pipeline inteiro:

```
INPUT → NORMALIZAÇÃO → CONTEXTO (context-grounding) → SYSTEM PROMPT (aura-prompt)
→ TASK PROMPT → MODELO (openai-config) → SAÍDA ESTRUTURADA → PÓS-PROCESSAMENTO
→ FILTRO (decision-engine / risk-safety / guardrails) → BANCO → UI
```

A incoerência pode nascer em qualquer etapa. Antes de mexer no prompt, confira
**o que chegou ao modelo**: recebeu o objetivo certo? o perfil operacional? o
histórico relevante? recebeu contexto velho indevidamente? faltou dado? há
instrução conflitante? há dado irrelevante dominando a resposta?

Precedente registrado: o relatório de período falava do dia atual não por prompt
ruim, mas porque **recebia** `phaseLabel` e "leitura atual" no payload.

### 8.5 Golden cases

Quando uma saída errada real for identificada, ela vira caso de avaliação.
O lugar existe: `apps/backend/src/lib/aura-eval/cases.ts`.

Um caso descreve **comportamento esperado e comportamento proibido**, nunca texto
idêntico:

```markdown
## Caso: preparar a sala

Entrada: "Deixar a sala pronta para uso"

Deve:
- ações relacionadas a limpar, organizar ou preparar a sala
- passos executáveis
- sequência coerente

Não pode:
- inventar reparo não mencionado
- assumir piso quebrado
- sugerir material arbitrário sem evidência
```

**Golden case não vira hard-code.** Não ajuste o sistema para reconhecer a frase
exata do teste. Pergunta de controle: *"isso resolve a classe do problema ou só o
exemplo que falhou?"* Se for só o exemplo, não é solução.

### 8.6 Testar estados, não só o happy path

Para cada fluxo: `EMPTY · LOADING · SUCCESS · ERROR · DADO PARCIAL · INPUT
INVÁLIDO · RETRY · RELOAD · VOLTAR PARA A TELA`.

Um objetivo não está pronto por funcionar na primeira criação. Pode quebrar
quando já existe objetivo, ao editar, ao voltar para a tela, quando a IA demora,
quando a IA falha, quando a resposta vem incompleta, ao recarregar, quando o
estado local diverge do servidor.

### 8.7 Coerência entre telas

Quando o mesmo dado aparece em vários lugares, conferir consistência:

```
objetivo criado → /goals → Home (GoalFocusCard, NextActionsCard)
→ check-in → recomendação da Airia → /insights
```

Versões diferentes do mesmo dado em telas diferentes é bug, mesmo com cada tela
"funcionando".

### 8.8 Outside-in debugging

Para bug percebido pela usuária:

```
FALHA OBSERVADA → REPRODUZIR → SEGUIR O FLUXO DA USUÁRIA → SEGUIR O DADO
→ SEGUIR A API → SEGUIR A REGRA DE NEGÓCIO → SEGUIR IA/CONTEXTO → CAUSA RAIZ
```

Não comece editando o arquivo que "parece relacionado".

### 8.9 Contrato integrado da Airia: IA, dados, UI e UX

Neste aplicativo, uma tarefa não é avaliada apenas na tela ou no arquivo que
foi alterado. Quando houver impacto em uma superfície de produto, o contrato de
verificação deve declarar:

| Campo | Pergunta obrigatória |
|---|---|
| Superfícies | Quais páginas, componentes, APIs, serviços de IA e consumidores do dado são afetados? |
| Intenção | O que a usuária deve conseguir fazer, sem precisar adivinhar o próximo passo? |
| Dados | Qual entrada chega ao payload, ao banco, ao contexto da IA e às regras? |
| Âncoras | Qual Objetivo, Ação, intenção ou relato atual sustenta a ação? Um padrão verificado está sendo usado como fonte de decisão? |
| Padrões | Como o padrão foi calculado, quantas evidências/dias o sustentam, qual sua confiança, janela, estado e limitação? |
| Influência | O padrão está alterando prioridade, tamanho, ritmo, proteção ou adiamento de uma Ação de forma explicável? |
| Devolução | A usuária vê observação, evidência, confiança, impacto, proposta e opções de confirmar/corrigir/rejeitar? |
| Idiomas | O fluxo inteiro funciona em português e inglês, inclusive conteúdo dinâmico, backend e IA? |
| Estados | Vazio, carregando, sucesso, erro, parcial, inválido, retry, reload, offline e duplo clique foram considerados? |
| UI/UX | A hierarquia, interação, acessibilidade, responsividade, animação e visual ajudam a usuária a agir? |
| Evidência | Quais ações, logs, requests, dados persistidos, screenshots e resultados comprovam cada critério? |

O pipeline integrado a verificar é:

```text
entrada da usuária
→ UI/UX
→ normalização
→ contexto atual + estado calculado
→ padrões candidatos e evidências
→ padrões verificados e limitações
→ capacidade e segurança
→ Objetivo/Ação de destino
→ prompt/modelo
→ saída estruturada
→ filtros e regras
→ persistência
→ UI de retorno
→ feedback da usuária
→ próxima ação
→ outras superfícies consumidoras
```

### 8.9.1 Contrato de padrões como fonte de ação

Padrões não são proibidos de alimentar ações. A regra é impedir que uma camada
de memória grave uma ação diretamente e desconectada do presente. O caminho
obrigatório é:

```text
evidência → hipótese → verificação → relevância atual
→ Objetivo/intenção + capacidade + segurança
→ proposta de Ação/proteção/adiamento
→ confirmação ou correção → persistência com evidências
```

O verificador deve confirmar, com evidência:

- cálculo reproduzível do padrão a partir de dados reais;
- mínimo de 3 evidências em 2 dias distintos para padrão inferido confirmado;
- distinção entre estado atual, associação, padrão longitudinal e diagnóstico;
- padrão confirmado podendo alterar prioridade, tamanho, ordem, duração, ritmo,
  proteção ou adiamento de uma Ação;
- padrão sem destino operacional não criando Ação isolada;
- nenhuma reativação de Ação concluída, rejeitada, excluída ou adiada;
- decisão devolvida com base, confiança, limitação e possibilidade de correção;
- correção/exclusão impedindo uso futuro indevido e atualizando as superfícies;
- referência persistida do padrão e das evidências na decisão resultante.

Se qualquer superfície calcular ou narrar um resultado diferente do estado
persistido, o resultado é `INTEGRATION_PENDING` até a fonte comum ser corrigida.

Para qualquer alteração de IA, dados ou regra, o verificador deve confirmar que
os campos capturados chegam ao destino correto, são persistidos, são lidos de
volta, são usados pela IA/regras quando pertinente e não reaparecem como
informação inventada, velha, concluída ou rejeitada.

Para qualquer alteração visual ou interativa, o verificador deve confirmar:

- todos os botões e caminhos executam a ação real, incluindo loading, erro,
  retry, sucesso e prevenção de duplo clique;
- labels, mensagens, datas, números, erros e respostas dinâmicas permanecem
  coerentes em português e inglês;
- hierarquia, espaçamento, contraste, clipping, overflow, tipografia, foco,
  teclado, semântica, ARIA, alvos de toque e textos longos funcionam;
- o fluxo é legível e utilizável em `320×800`, `390×844`, `768×1024` e desktop;
- gráficos não dependem só de cor e animações não escondem conteúdo, bloqueiam
  interação ou substituem feedback textual;
- `prefers-reduced-motion`, scroll, modal, teclado virtual, orientação e safe
  areas são tratados quando aplicável.

“Impressionante” é a ambição de qualidade, não uma justificativa subjetiva de
aprovação. O resultado só passa quando há evidência de fidelidade à intenção,
grounding, não invenção, utilidade, granularidade executável, consistência,
idioma correto, segurança, continuidade da ação, concisão e acabamento visual
sem regressão. Se o verificador não consegue mostrar isso, o resultado é
`FAIL` ou `BLOQUEADO`, nunca uma aprovação por gosto.

### 8.10 Nota objetiva do verificador: mínimo 8/10

Todo `verifier`, `verificador de integração` e `meta-verificador` deve emitir
uma nota de qualidade de `0` a `10`, acompanhada de evidência. Para aprovar, a
nota mínima é **8/10**. A palavra “impressionante” só pode ser usada como
resumo depois que a nota e os critérios abaixo estiverem comprovados:

| Ponto | Evidência exigida |
|---:|---|
| 1 | comportamento pedido e critérios de aceite realmente atendidos |
| 1 | evidência reproduzível do comportamento e integração correta |
| 1 | UI/UX, acessibilidade e responsividade quando aplicável |
| 1 | dados, persistência, IA, grounding e regras quando aplicável |
| 1 | português/inglês e conteúdo dinâmico coerentes quando aplicável |
| 1 | loading, vazio, erro, retry, reload e edge cases |
| 1 | verificação proporcional ao risco, incluindo runtime/browser quando necessário |
| 1 | regressão vizinha e segurança/privacidade sem falha crítica conhecida |
| 1 | pesquisa de soluções existentes antes de inventar, com escolha/rejeição registrada |
| 1 | handoff entre LLMs, memória, commit e worktree com destino definido |

Cada ponto precisa de evidência. Um item não aplicável exige justificativa e
evidência substituta; `N/A` não pode esconder uma lacuna. Uma falha crítica —
evidência inventada, segredo exposto, dependência sem origem/licença aceitável,
caminho principal quebrado, perda de dado, regressão de segurança ou requisito
essencial não verificado — anula a aprovação independentemente da média. Nota
abaixo de 8 ou falha crítica é `FAIL`/`BLOQUEADO` e retorna para retrabalho.

---

## 9. Bug Fix Protocol

```
REPRODUCE → LOCATE → EXPLAIN → FIX → REPRODUCE AGAIN → REGRESSION CHECK
```

1. reproduzir o bug **antes** de alterar (é o que prova que você achou o bug
   certo);
2. localizar a causa raiz, não o sintoma;
3. explicar internamente por que acontece — se não consegue explicar, ainda não
   achou;
4. corrigir a causa;
5. rodar exatamente o cenário que falhava;
6. confirmar que agora passa;
7. testar os cenários vizinhos.

Proibido **shotgun debugging**: alterar várias coisas de uma vez, rodar, e ver se
por acaso funcionou. Se funcionar, você não sabe por quê — e o bug volta.

Quando o bug for reproduzível por teste, o teste que reproduz entra no repo
**antes** da correção.

---

## 10. Quando uma verificação falha

Falha não encerra a tarefa. Falha abre iteração.

```
FAIL
 ↓
capturar evidência (mensagem exata, log, screenshot, payload)
 ↓
classificar a falha (tipo? estático? runtime? semântico? dado?)
 ↓
achar a causa raiz
 ↓
escolher a próxima hipótese
 ↓
fazer a menor mudança que testa essa hipótese
 ↓
rodar de novo
```

Registrar, no mínimo mentalmente e em `CURRENT_STATE.md` para tarefa longa: o
que falhou, qual evidência existe, qual era a hipótese, o que se aprendeu, qual é
a próxima hipótese.

---

## 11. Laço inteligente e prevenção de laço infinito

**Depois de 2 tentativas parecidas** — parar de repetir a mesma solução e
reavaliar a hipótese.

**Depois de 3 falhas substancialmente parecidas** — análise de causa raiz, com
esta lista:

- minha compreensão do requisito está errada?
- estou editando a camada errada (UI, quando o problema é o contexto enviado ao
  modelo)?
- existe dependência que não considerei?
- existe estado ou cache (service worker do PWA, `localStorage`, sessão do
  routine-builder, `aiProfilePayload`)?
- existe problema de ambiente (`.env` ausente, backend não rodando, porta errada)?
- existe problema de dados (usuária sem check-in, sem objetivo, sem histórico)?
- estou verificando no contexto errado (rodando teste quando o bug é visual)?
- existe **outra implementação** controlando o comportamento? *(este repo tem web
  e mobile paralelos, e código de Planner/Hábitos vivo porém desligado por
  `FEATURES`)*

Mudar de estratégia antes de tentar de novo. Nunca rodar `edit → test → edit →
test` indefinidamente sem adquirir informação nova.

---

## 12. Bloqueios reais

Se existir impedimento externo genuíno — credencial ausente, serviço fora,
ambiente inacessível, decisão de produto que não dá para inferir, autorização
obrigatória da usuária, dependência quebrada fora do escopo — é legítimo parar.

Mas **não** dizer "task completed". Dizer:

```
BLOQUEADO
```

e entregar: o que foi concluído; o que não pôde ser verificado; a evidência do
bloqueio (mensagem, código de erro, comando que falhou); a ação exata necessária
para destravar.

Casos comuns aqui: `OPENAI_API_KEY` ausente bloqueia `aura:eval` e `ai:smoke`;
`.env` do backend ausente bloqueia rodar o servidor; DDL em produção exige aval.

---

## 13. Scratchpad e handoff

Para tarefa longa, manter estado em arquivo — não na conversa. O lugar é
`docs/agent-memory/CURRENT_STATE.md` (§ memória).

Atualizar **durante**, não só no fim. Especialmente antes de: compactação
provável de contexto, mudança de fase, delegação para subagente, encerramento
parcial, sequência longa de testes, pausa por bloqueio externo.

Teste conceitual: *"se outro agente abrir este repositório amanhã sem esta
conversa, ele descobre o que está acontecendo e continua?"* Se a resposta for
não numa tarefa longa, a memória operacional está insuficiente.

---

## 14. Sprint Contract (feature grande)

Antes de implementar feature maior, um contrato curto — na resposta ou em
`CURRENT_STATE.md`:

```markdown
## Sprint Contract
### O que será implementado
### O que NÃO será alterado
### Critérios de aceite
### Método de verificação
### Comportamento esperado pela usuária
```

Isso impede o agente de redefinir "pronto" depois de ver o que conseguiu
construir.

### Verificador independente

Para tarefa complexa ou de alto risco, considerar um agente separado para QA. O
agente que implementou tende a defender a própria solução.

- **Builder** implementa.
- **Evaluator/QA** não assume que está certo — tenta provar que está errado:
  executa o sistema, testa os critérios de aceite, procura edge case, produz
  PASS/FAIL por critério com evidência.

`BUILDER → QA → FAIL → BUILDER → QA` até aprovação ou bloqueio legítimo.

Neste repo, a skill `skills/airia-pr-review/SKILL.md` é a checklist de QA
obrigatória para PR, fechamento de feature, publicação e deploy.

### Orquestração obrigatória por subagentes

Toda tarefa deve passar por papéis separados, mesmo quando a tarefa tiver uma
única fatia executável:

```text
COORDENADOR
→ EXECUTOR
→ VERIFICADOR
→ VERIFICADOR DE INTEGRAÇÃO
→ META-VERIFICADOR
→ DONE
```

- **Coordenador:** transforma o pedido em critérios de aceite, divide por
  comportamento verificável, atribui escopo e controla os estados.
- **Executor:** implementa uma fatia vertical e entrega mudanças, testes e
  evidências. Não aprova o próprio trabalho.
- **Verificador:** atua de forma adversarial, não altera o código que verifica e
  produz `PASS`, `FAIL`, `BLOQUEADO` ou `N/A` justificado por critério, sempre
  com nota `0–10`; só pode produzir `PASS` com nota mínima `8/10` e sem falha
  crítica.
- **Verificador de integração:** confere o comportamento combinado entre UI,
  API, banco, regras, IA, ferramentas e superfícies consumidoras; também deve
  registrar nota `0–10`, com mínimo `8/10` para aprovação.
- **Meta-verificador:** audita o processo inteiro, os handoffs, a qualidade das
  evidências, a regressão, os commits e worktrees. Deve registrar sua própria
  nota `0–10`, com mínimo `8/10` e sem falha crítica; é o único papel que
  autoriza `DONE`.

Quando existirem fatias independentes, usar executores em paralelo. A divisão
deve ser por comportamento ou contrato (`entrada → processamento → efeito →
saída observável`), não por arquivo ou camada isolada. Executores mantêm
comunicação horizontal sobre fatos, dependências, conflitos e contratos; a
comunicação vertical entrega, reprova, corrige e aprova cada passagem de estado.

Essa comunicação é comunicação entre LLMs/agentes, não uma expectativa implícita
de memória compartilhada. Cada LLM deve receber ou consultar o contexto
operacional necessário e responder com um registro persistente quando a
informação puder afetar outro agente. Mensagens importantes não podem depender
de o próximo LLM ler o histórico inteiro da conversa.

Formato mínimo para comunicação entre LLMs:

```text
[task_id][subtask_id][HORIZONTAL|VERTICAL][FINDING|DEPENDENCY|CONFLICT|PASS|FAIL|BLOCKED]
origem_llm:
destino_llm:
contexto_consultado:
fato_ou_critério:
evidência:
impacto_na_integração:
decisão:
próxima_ação:
```

O LLM destinatário deve confirmar `RECEIVED`, `HANDOFF_ACCEPTED`,
`HANDOFF_REJECTED` ou `BLOCKED`, com justificativa. O LLM que envia continua
responsável por verificar se a mensagem foi compreendida; “enviei no chat” não é
prova de handoff.

Quando houver LLMs de plataformas diferentes — por exemplo Codex/GPT e Claude
Code — a ponte obrigatória é `CURRENT_STATE.md`, `WORKTREES.md`, o contrato da
tarefa e as evidências no repositório. Não transferir decisões críticas apenas
por texto efêmero de uma sessão.

Os papéis são obrigatórios; um worktree físico por papel não é. Criar cópia
física somente quando isolamento, conflito ou execução paralela realmente
exigir. Verificadores trabalham em leitura e não iniciam uma segunda edição
silenciosa no worktree do executor.

Handoff mínimo:

```text
task_id · subtask_id · origem · destino · objetivo · critérios · escopo
branch/worktree · commit/estado · arquivos · verificações · evidências
falhas · próxima ação · condição de aceite
```

Nenhuma tarefa salta de `EM_EXECUÇÃO` para `DONE`. A cadeia de estados é:
`PLANEJADA → EM_EXECUÇÃO → PRONTA_PARA_VERIFICAÇÃO → VERIFICADA →
PRONTA_PARA_INTEGRAÇÃO → INTEGRADA → META_APROVADA → DONE`; falha retorna para
`RETRABALHO` e impedimento real para `BLOQUEADA`.

Se a plataforma não oferecer subagentes físicos, executar os papéis em passes
separados e registrar a limitação. Não apresentar uma autoavaliação como
verificação independente.

O meta-verificador deve confirmar que todos os critérios têm estado e evidência,
que nenhum agente aprovou o próprio trabalho, que a integração foi testada no
contexto correto, que os dados e worktrees têm destino e que não há conclusão
baseada apenas em código, build, teste isolado ou HTTP 200. Deve conferir as
notas dos verificadores, a sua própria nota mínima de `8/10` e a pesquisa de
reuso registrada antes da criação de código. Qualquer falha ou nota insuficiente
retorna para `RETRABALHO` ou `BLOQUEADA`.

---

## 15. Final Quality Gate

Antes de declarar `DONE`:

```
[ ] Comportamento pedido implementado
[ ] Critérios de aceite conferidos um a um
[ ] Checks estáticos relevantes passaram
[ ] Testes relevantes passaram
[ ] Runtime inspecionado onde aplicável
[ ] Browser/UI testado onde aplicável
[ ] Persistência conferida onde aplicável
[ ] Estados de erro/loading/vazio conferidos
[ ] Edge cases considerados
[ ] Risco de regressão vizinha conferido
[ ] Nenhum problema crítico conhecido restante
[ ] Existe evidência para tudo acima
[ ] Soluções existentes foram procuradas antes de escrever código novo
[ ] A pesquisa de reuso foi registrada com fontes, candidatos e decisão
[ ] Verificador e integração têm nota documentada de pelo menos 8/10
[ ] Meta-verificador tem nota documentada de pelo menos 8/10
[ ] Nenhuma falha crítica anula as notas
[ ] Código reutilizado tem origem, licença, compatibilidade e motivo registrados quando aplicável
[ ] `git status --short --branch` foi revisado
[ ] Cada alteração que deve permanecer está em commit
[ ] Nenhum arquivo novo ficou sem decisão (commit, remoção consciente ou bloqueio documentado)
[ ] Worktree e branch têm handoff/encerramento definido
```

Para tarefa que muda comportamento percebido pela usuária, some:

```
[ ] Fluxo real executado onde razoavelmente possível
[ ] Comportamento no browser corresponde ao requisito
[ ] Saída gerada é semanticamente coerente
[ ] Estados de erro/loading/vazio checados
[ ] Reload/persistência checados quando aplicável
[ ] Nenhuma incoerência óbvia entre telas
[ ] Caso de regressão cobre a falha original, quando cabe
[ ] Comportamento de produto — não só código — foi verificado
```

E o gate de memória (§16):

```
[ ] Memória relevante foi consultada
[ ] Nenhuma abordagem já reprovada foi repetida sem motivo
[ ] Conhecimento reutilizável novo foi registrado
[ ] CURRENT_STATE atualizado se sobrou trabalho
[ ] Memória desatualizada encontrada durante a tarefa foi corrigida
```

Só então: `DONE`.

Se algum item essencial não pôde ser verificado, **diga qual e por quê**. Não
substitua ausência de verificação por suposição.

---

## 16. Memória

Regra:

> **BEFORE REDISCOVERING, CHECK MEMORY.
> BEFORE FINISHING, UPDATE MEMORY.**

A arquitetura está em `docs/agent-memory/`:

| Arquivo | Camada | Conteúdo |
|---|---|---|
| `PROJECT_CONTEXT.md` | A — permanente | stack, estrutura, comandos, ambiente, invariantes |
| `VERIFICATION.md` | A — permanente | como verificar aqui, custo, falso positivo conhecido |
| `WORKTREES.md` | A/B — operacional | inventário e ciclo de vida dos worktrees |
| `LEARNINGS.md` | C — acumulativa | fatos, decisões e abordagens que já falharam |
| `KNOWN_ISSUES.md` | C — acumulativa | problema conhecido ainda não corrigido |
| `CURRENT_STATE.md` | B — volátil | tarefa em andamento e handoff |

**Memória é cache, não fonte de verdade.** Código e comportamento observado
mandam. Em caso de conflito, investigue e **corrija a memória** — nunca ajuste o
código para concordar com documento velho.

**Leitura seletiva.** Não carregue tudo. Classifique o domínio da tarefa e leia
só o relevante:

```
TAREFA → CLASSIFICAR DOMÍNIO → LER MEMÓRIA RELEVANTE → INSPECIONAR CÓDIGO
→ VALIDAR MEMÓRIA CONTRA A REALIDADE → EXECUTAR
```

**Higiene.** Não registrar raciocínio longo, log gigante, detalhe trivial, o que
o código já diz, nem hipótese vestida de fato. Marcar sempre o tipo:
`FATO · DECISÃO · HIPÓTESE · PROBLEMA CONHECIDO · TENTATIVA FRACASSADA · ESTADO ATUAL`.

**Não repetir abordagem já reprovada.** Antes de tentar uma correção para
problema já investigado, consultar `LEARNINGS.md`, `KNOWN_ISSUES.md` e
`CURRENT_STATE.md`. Repetir só com informação nova, código alterado, ambiente
diferente ou hipótese diferente.

Nem toda tarefa gera entrada nova. Mudança trivial pode não produzir aprendizado
reutilizável — não escreva por ritual.

---

## 17. Verificação progressiva (não exagere)

> **Use the simplest verification sufficient to prove the change.**

Dois extremos errados: não testar nada até o fim; rodar a infraestrutura inteira
a cada linha.

```
MUDANÇA → CHECK LOCAL BARATO → TESTE FOCADO → CHECK DE INTEGRAÇÃO
→ FLUXO REAL DA USUÁRIA → REGRESSÃO MAIS AMPLA
```

O nível acompanha risco, alcance, criticidade, número de dependências e
superfície alterada. Mudança de texto não precisa de bateria de integração;
mudança em cobrança, auth ou protocolo de risco não se valida com lint.

Iterar também não significa refazer: **corrija a menor superfície necessária** e
preserve o que já foi comprovado.

---

## 18. Modos de verificação por tipo de alteração

| Tipo de alteração | Verificações prováveis |
|---|---|
| Texto/copy | renderização na tela + chave i18n (`i18n/source-audit.test.ts`) |
| CSS/layout | token existe (`css-tokens.test.ts`) + browser + visual + mobile |
| Componente UI | `typecheck web` + vitest do componente + browser + interação |
| Estado frontend (Zustand) | teste do store + browser + reload |
| Endpoint/API | teste de contrato + integração + erro + auth por `userId` |
| Schema Prisma | `generate` + migração com RLS/policy + CRUD + persistência |
| Auth | `test:auth` + autorização + estados negativos |
| Bug | reprodução antes/depois + regressão vizinha |
| Refactor | testes existentes passam sem alteração + comportamento equivalente |
| Performance | medição antes/depois na superfície afetada |
| Config/build | build + startup do app |
| Fluxo completo | E2E manual no browser + persistência + erros + coerência entre telas |
| **Prompt/saída de IA** | `aura:eval` + golden case + inspeção do contexto enviado + browser |
| **Troca de modelo** | `ai:smoke` (todas as superfícies) + `model-consistency.test.ts` |
| Notificação/push | filtro (`notification-filters.test.ts`) + `notificationAllowed` |
| Privacidade/LGPD | allowlist + export + consentimento + `privacy-*.test.ts` |
| Feature grande | Sprint Contract + incremental + QA independente |

---

## 19. Regra contra conclusão falsa

Não é aceitável, em nenhuma circunstância:

- substituir funcionalidade por placeholder sem avisar;
- criar botão que não executa o fluxo real;
- deixar `TODO` essencial;
- mockar integração necessária e chamar de concluída;
- implementar só o happy path quando os estados negativos fazem parte do
  requisito;
- declarar "funcionando" sem ter executado;
- assumir que build passando é funcionamento;
- esconder falha restante no resumo final.

Isto já é regra de produto em `AGENTS.md` ("botão sem ação real, usuário
temporário, sucesso simulado ou placeholder de implementação não entra") — aqui é
também regra de processo.

---

## 20. Formato da resposta ao concluir

Conciso, com evidência:

```markdown
## Concluído

Implementado:
- ...

Verificado:
- `npm run typecheck -w apps/web` → PASS
- `npx ts-node-transpile-only apps/backend/src/services/x.service.test.ts` → PASS
- fluxo /goals → criar → concluir passo → F5 → estado mantido → PASS
- estado de erro (backend fora) → mensagem visível → PASS

Regressão:
- `npm run test -w apps/web` → contagem efetiva da execução, sem falhas

Não verificado:
- `aura:eval` — OPENAI_API_KEY ausente neste ambiente
```

Se algo não pôde ser verificado, **não escreva "nenhum"**. Diga o quê e por quê.

---

## 21. Enforcement por plataforma

O protocolo comportamental vale para todos os agentes. Neste repositório, uma
parte dele é reforçada por hooks específicos do Claude Code, não por boa
vontade: `.claude/hooks/verification-guard.mjs` e
`.claude/hooks/orchestration-guard.mjs`, registrados em `.claude/settings.json`.

**O problema que ele resolve:** o agente edita arquivo de código-fonte e tenta
encerrar a sessão sem ter rodado nenhuma verificação.

**O que ele faz:** acompanha, por sessão, quais arquivos de código foram
alterados e se algum comando de verificação rodou (teste, typecheck, build,
navegador, preview). Nos eventos `Stop` e `SubagentStop`, se houve alteração de
código e nenhuma verificação, ele bloqueia uma vez e devolve a lista dos
arquivos alterados. No evento `TaskCompleted`, aplica a mesma barreira para não
marcar a subtarefa como concluída enquanto a sessão ainda tem código alterado
sem nenhuma verificação tentada.

**O que ele deliberadamente não faz:**
- não roda teste (seria lento e caro em toda parada);
- não julga se a verificação foi *suficiente* — isso é julgamento, e julgamento
  fica com este documento e com o gate de §15;
- respeita `stop_hook_active` e não faz chamadas recursivas; o Claude Code
  também encerra uma sequência de bloqueios de `Stop` que não converge;
- não bloqueia um bloqueio legítimo (§12) depois que a verificação relevante foi
  tentada: resultado `FAIL` é informação para declarar `BLOQUEADO`, não motivo
  para fingir `DONE`;
- `Stop`, `SubagentStop` e `TaskCompleted` não usam matcher — são eventos sem
  matcher no Claude Code atual. O registro real está em `.claude/settings.json`.

O `orchestration-guard` acrescenta as barreiras de processo: edição de código
exige contrato inicializado por `node scripts/agent-protocol.mjs init`,
`SubagentStart` injeta o contexto comum, `SubagentStop` exige handoff com
estado/evidência e `Stop`/`TaskCompleted` exigem meta-aprovação. O CLI exige
nota mínima `8/10` para `verifier`, `integration` e `meta-verifier` antes de
aceitar `PASS`/`meta-approve`. O estado técnico
fica em `.claude/.state/agent-protocol.json` (ignorado pelo Git); a comunicação
durável entre LLMs continua sendo registrada em `CURRENT_STATE.md`,
`WORKTREES.md` e na memória relevante.

O guard não sabe se a verificação foi suficiente, não associa automaticamente
um arquivo a uma subtarefa específica e não avalia coerência de UI, persistência,
qualidade semântica da IA ou regressão. Esses continuam sendo julgamento do
protocolo e da evidência. A referência oficial do mecanismo é a
[documentação de hooks do Claude Code](https://code.claude.com/docs/en/hooks).

Separação usada no desenho:

| Determinístico (hook) | Julgamento (este documento) |
|---|---|
| build/typecheck/teste rodaram? | o requisito foi realmente cumprido? |
| arquivo obrigatório existe? | a UI está coerente? |
| alguma verificação aconteceu? | o fluxo funciona ponta a ponta? |
| contrato, handoff e meta-aprovação existem? | a cadeia de subagentes integrou o resultado? |
| — | a saída da IA faz sentido? |
| — | existe funcionalidade só aparente? |

O Claude Code pode recarregar alterações em `settings.json` pelo watcher depois
de um pequeno intervalo de estabilidade. Para garantir que o `CLAUDE.md`, a
memória e o protocolo inteiro estejam no contexto, use uma sessão nova depois
de alterar estas instruções ou hooks.

---

## 22. Disciplina de commit e governança de worktrees

Commit e worktree são problemas diferentes e ambos precisam de um encerramento
explícito. **Não deixar alteração sem destino é parte da conclusão da tarefa.**

### 22.1 Regra de commit

Antes de começar, inspecionar:

```bash
git status --short --branch
git diff --stat
git ls-files --others --exclude-standard
```

Identificar o que já estava alterado e não assumir autoria de mudanças de outro
agente. Durante o trabalho, separar unidades coerentes e manter o escopo claro.

Antes de declarar `DONE`, cada arquivo precisa estar em exatamente um destes
estados:

1. **Commitado:** a alteração faz parte do resultado e foi registrada em um
   commit com mensagem compreensível.
2. **Removido conscientemente:** era temporário, gerado ou não deve permanecer;
   a remoção foi revisada e não apagou trabalho da usuária ou de outro agente.
3. **Bloqueado e documentado:** não pode ser commitado por segredo, dependência
   externa ou decisão pendente; o caminho, motivo, proprietário e próxima ação
   estão em `CURRENT_STATE.md`. Isso é `BLOQUEADO`, nunca `DONE`.

Não usar `git add .` ou `git commit -am` sem revisar o diff. Não fazer commit de
segredos, artefatos de build, arquivos locais ou alterações de outra tarefa.
Quando a alteração deve permanecer, o padrão é commitá-la antes de encerrar —
inclusive um commit de handoff claramente marcado quando a tarefa estiver
incompleta. Um agente novo deve conseguir distinguir o que é trabalho pronto,
WIP, bloqueio e lixo sem depender do histórico da conversa.

O encerramento obrigatório é:

```bash
git diff --check
git status --short --branch
git log -1 --oneline
```

Se ainda houver `M`, `A` ou `??`, explicar cada caminho no handoff. Não responder
`DONE` deixando arquivos acumularem silenciosamente.

### 22.2 Regra de worktree

Um worktree é uma cópia de trabalho com estado próprio. Criar worktree não cria
isolamento mágico de conhecimento: outro agente pode estar trabalhando no
mesmo fluxo, em outra cópia, com commits que ainda não chegaram à `master`.

Antes de criar, entrar ou escolher um worktree, executar:

```bash
git worktree list --porcelain
git status --short --branch
git branch --all --verbose --no-abbrev
```

Regras obrigatórias:

- reutilizar um worktree ativo da mesma tarefa quando ele existir;
- não criar uma segunda cópia para o mesmo objetivo sem registrar o motivo;
- uma tarefa tem um branch proprietário e um worktree ativo por vez, salvo
  paralelismo explicitamente registrado;
- antes de editar, conferir commits e diferenças do worktree relevante:
  `git log --oneline master..<branch>` e `git diff --stat master...<branch>`;
- não concluir que uma funcionalidade não existe sem pesquisar todos os
  worktrees registrados;
- registrar criação, responsável, tarefa, branch, caminho, status e próxima ação
  em [`docs/agent-memory/WORKTREES.md`](agent-memory/WORKTREES.md);
- em qualquer handoff, atualizar também `CURRENT_STATE.md` com o caminho exato
  do worktree e o branch que deve ser retomado;
- não mover uma tarefa para outro worktree sem deixar o handoff no anterior e no
  destino; o agente seguinte não pode depender do chat do agente anterior.

### 22.3 Estados permitidos

Todo worktree registrado deve estar em um destes estados:

| Estado | Significado | Próxima ação obrigatória |
|---|---|---|
| `ACTIVE` | alguém está trabalhando | manter dono, objetivo e próximo passo atualizados |
| `HANDOFF` | pausa intencional | commit/handoff e instrução de retomada |
| `BLOCKED` | impedimento real | registrar evidência e ação para destravar |
| `READY_TO_MERGE` | verificado e commitado | merge/push conforme escopo, depois limpar |
| `CLOSED` | trabalho integrado ou abandonado conscientemente | remover o worktree e atualizar o registro |
| `AUDIT_PENDING` | entrada legada sem proprietário confirmado | não reutilizar nem remover; auditar primeiro |

`UNKNOWN`, `ORPHANED` ou worktree sem dono não são estados finais aceitáveis.
`AUDIT_PENDING` existe apenas como quarentena temporária para entradas legadas:
ao encontrar uma, parar de criar cópias e fazer o inventário antes de iniciar
outra tarefa.

### 22.4 Encerramento e limpeza

Quando uma tarefa termina:

1. commitá-la, ou declarar `BLOQUEADO` com handoff explícito;
2. confirmar que não há mudança exclusiva daquele worktree perdida;
3. se integrada ou abandonada conscientemente, remover o worktree;
4. atualizar `WORKTREES.md` para `CLOSED` e registrar destino do branch;
5. conferir novamente `git worktree list --porcelain`.

Nunca remover worktree sujo sem revisar `git status` e `git diff`. Nunca usar
`git worktree prune` como faxina cega: primeiro confirmar que o diretório está
realmente ausente e que não há branch ou commit único a preservar. Worktree
antigo não significa trabalho descartável.

### 22.5 Proibição de acúmulo

Não iniciar uma nova sessão ou subagente para a mesma tarefa enquanto houver
worktree ativo sem handoff. Não deixar branch, worktree, arquivo não rastreado ou
alteração local sem um dos destinos definidos acima. O objetivo é que, ao abrir
o projeto amanhã, seja possível responder imediatamente:

```text
Qual tarefa existe?
Qual agente/branch é dono?
Onde está o worktree?
O que já foi commitado?
O que foi verificado?
Qual é a próxima ação?
```

---

## Resumo em uma frase

> O agente não trabalha até "ter escrito algo".
> O agente trabalha até existir evidência suficiente de que o comportamento
> pedido funciona — e cada falha de verificação é combustível para a próxima
> iteração, não motivo para encerrar.
