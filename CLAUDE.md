# Airia — Monorepo

## IDENTIDADE DO APP (CRÍTICO)
**Não é:** planner genérico, tracker menstrual, chatbot terapêutico.
**É:** assistente pessoal de ciclagem de humor, energia e agenda adaptativa.
- **Ciclo primário:** ciclo de humor/energia (EWMA + desvio padrão + tendência de 7 dias).
- **Ciclo secundário:** ciclo menstrual como modulador biológico, não como identidade principal.
- **Público-alvo:** pessoas com TDAH, ciclotimia, transtorno depressivo, bipolar tipo II e variações hormonais/cíclicas.
- **Princípio operacional:** contexto antigo explica padrão; contexto de hoje decide ação.

## Módulo Core — MoodCycleEngine
Localizado em `apps/web/src/utils/mood-cycle-engine.ts`.
Calcula algoritmicamente a fase atual:
- `Voo Alto`
- `Fluindo`
- `Estável`
- `Desacelerando`
- `Recolhimento`
- `Pausa`
- `Retomada`
- `Turbulência`

Essas 8 fases são a nomenclatura visível oficial. Estados de check-in como “Dia Sensível”, “Em equilíbrio” ou “Cansada” podem existir, mas não substituem a fase do ciclo.

## Estrutura do Monorepo
```
apps/
  web/          → Frontend React + Vite + TypeScript
  backend/      → API Node.js + Express + Prisma
  mobile/       → React Native + Expo (pausado)
packages/
  database/     → Schema Prisma compartilhado
```

## Stack Travada
| Camada | Tecnologia |
|--------|-----------|
| Web frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| Estado global | Zustand (stores em `apps/web/src/features/aura/`) |
| Backend API | Node.js + Express + TypeScript |
| ORM | Prisma (schema em `packages/database/prisma/schema.prisma`) |
| Banco | Supabase (PostgreSQL + Auth) |
| IA | OpenAI GPT-4o-mini |

## IA Persona — Aura (v2.4)
- Função: `buildAuraSystemPrompt(...)` em `apps/backend/src/lib/aura-prompt.ts`.
- A identidade Aura é compartilhada; cada superfície tem política própria (`journal-live`, `journal-finalize`, `aura-command`, `checkin`, `planning`, `home`, `insight`, `summary`).
- A linguagem deve ser natural, próxima, firme e específica. Evitar resposta de suporte, pergunta prematura e sugestão genérica.
- Metodologia interna: Aliança Divergente, TCC prática, exposição gradual, leitura de padrão, manobra concreta e autonomia.

## Airia como centro de comando
- Tudo que se faz por tela tem que dar para pedir falando: criar tarefa, compromisso, hábito, meta e checklist; concluir, apagar, mover, adiar e começar; **registrar check-in**; adaptar a agenda; abrir uma tela.
- Uma fala pode conter mais de uma ação (`actions[]`, até 8). A segunda coisa dita nunca é descartada.
- **Estado é captura paralela.** Sempre que a fala revela como a pessoa está — com pedido junto ou não — isso vira check-in registrado, sem sequestrar a resposta. É o dado que alimenta fase, capacidade do dia e toda sugestão de agendamento.
- Antes de agir, a Airia confere o dia real: o que já existe, o que já foi feito, o que está ocupado. Ela conclui em vez de duplicar e reconhece em vez de sugerir o que já aconteceu.

## Contexto Diário e Agenda Adaptativa
- Fonte central: `apps/backend/src/services/context-grounding.service.ts`.
- `DailyContext` reúne agenda pendente/feita, hábitos pendentes/feitos, metas ativas/concluídas, subtarefas feitas, sugestões recentes, feedback de ações e memória RAG relevante.
- Cérebro operacional: `apps/backend/src/services/decision-engine.service.ts`.
- Agenda adaptativa: `apps/backend/src/services/adaptive-agenda-engine.service.ts`, exposta por `AgendaAdaptationService`.
- **A Airia decide e preenche.** Quando a fala contém um item — compromisso marcado, prazo, algo que pediram à usuária, intenção de retomar algo — ela entrega o item montado: título, data, hora e duração já resolvidos. Devolver a lacuna como pergunta para quem já contou o que precisa fazer é transferir esforço para quem está sem combustível.
- Âncora de uma sugestão pode ser agenda pendente, hábito devido, meta ativa, ação aceita **ou o que a usuária acabou de contar**. O que não vale é sugestão tirada do relógio ("um café às 9h") — isso é enchimento, não ajuda.
- O que a Airia não inventa: o título do item. Sem saber o que é a coisa, ela faz uma pergunta curta — só essa.
- Memória RAG serve para explicar padrão, compreender o usuario,seus compromiisos, suas questoes emocinais, tudo que o usuario compartilhar com o app
- Feedback de ações fica em `AiActionFeedbackService` e bloqueia repetição de ações feitas, excluídas, rejeitadas, puladas ou agendadas.
- O Decision Brain separa `real_commitment`, `suggested_commitment`, `insight_only`, `blocked` e autorização de notificação.
- Sugestão de compromisso entra no dia sozinha, com desfazer e ajustar à mão. **Criar não é o mesmo que notificar:** gravar um bloco é barato, tocar o celular não é — `notificationAllowed` continua sendo decisão separada.
- Continuam exigindo aval humano: âncora protegida (consulta, compromisso com terceiro, evento importado do Google) e qualquer ação destrutiva. Pedido de escuta, negação explícita e instrução citada de documento continuam bloqueando criação.
- `AgendaAdaptationService` aplica sozinho o que não exige aval humano. Chamado sem `selectedDecisionIds`, aplica tudo que é elegível; lista vazia explícita significa não aplicar nada.
- Adiamento de bloco no Planner registra `timeline.block_postponed`, conta recorrência por bloco e entra no grounding como `postponedActions`.

## Execução e Progresso
- Motor de execução passo a passo em `apps/backend/src/services/routine-run.service.ts`: um passo por vez, prévia de uma linha do próximo, pausa que preserva tempo corrido, abandono após 15 min sem toque preservando o que já foi feito.
- Duração real por passo alimenta a calibração de cegueira temporal. O ajuste é do app, nunca da pessoa: a mensagem é "já ajustei", não "você demora".
- Decomposição automática em `task-decomposition.service.ts`: verbo que descreve resultado ou duração acima de 30 min quebram o item em 2 a 5 passos de 5 a 15 min, cada um com o primeiro movimento físico.
- Progresso em `progress-rewards.service.ts`. **Gamificação incentiva, não cobra** — são coisas diferentes:
  - recompensa por aparecer, nunca punição por faltar;
  - fase de Recolhimento e Pausa não quebra sequência, ela atravessa o dia ruim;
  - ausência sem fase protegida não gera mensagem nenhuma;
  - rotina largada no meio também paga, porque começar é a parte cara;
  - celebração fala do que aconteceu e nunca do que faltou.

## Status do Design System — Aura Editorial Clean (identidade verde)
- Fundo base: branco/off-white, com uso de cor apenas como acento.
- Visual dominante: cards claros, sombras suaves, bordas discretas, layout respirado.
- **Acento primário é verde claro.** `--accent-primary` `#BFDCCB`, forte `#8FC0A4`, para texto `#4F7359`. O rosa-salmão saiu do app: a leitura era "muito feminino" para um produto de público amplo.
- Apelidos `--accent-peach*`, `--nectarine*`, `--menthe` e `--lagune` continuam existindo por compatibilidade e apontam para o verde. **Não reintroduza rosa neles.**
- **A logo é exceção e mantém a paleta original** (salmão, rosa, menta, azul) — em `components/AuraIcon.tsx` e no bloco `LOGO` de `splash-page.tsx`. Varredura de cor pula esses dois.
- Ficam de fora da virada, de propósito: vermelho de erro de validação, cores de marca do Google no login, amarelos de aviso e marrons quase pretos de texto.
- Valores concretos e a lição sobre token fantasma: `apps/web/CLAUDE.md`.
- Evitar qualquer retorno para o visual antigo de massa cromática, headers pesados ou mockups legados.

## Escopo do produto — reduzido ao núcleo
`apps/web/src/config/features.ts` decide o que existe. Hoje o app é **check-in,
objetivos, padrões e diário**. Planner e Hábitos estão desligados, com o código
inteiro preservado e as rotas redirecionando para a home. Religar é uma linha.

## Onboarding — história em três atos (`/comecar`)
`story-onboarding-page.tsx` implementa introdução, clímax e conclusão num fluxo
só, onde cada pergunta prepara a interpretação seguinte. **Entrada por toque:**
22 telas e apenas dois campos de texto, e o do objetivo tem atalhos — dá para
atravessar sem teclado.

- A conta e o espelho (`features/story-onboarding/reading.ts`) são
  **determinísticos**: nascem das respostas dela, sem modelo. É onde um número
  errado destruiria a confiança do fluxo, e onde o modelo não acrescenta nada.
  Os testes varrem toda saída contra vocabulário clínico e linguagem de culpa.
- O clímax é real: chama `GoalIntelligenceService`, inclusive a pergunta em vez
  de ação quando o objetivo é amplo demais.
- O perfil operacional sai daqui e é injetado **no servidor** em toda geração
  (`OperationalProfileService`, em `aiProfilePayload`, sem migração).
- Animação tem função — linha a linha dá tempo de ler, barra acompanha gravação
  real, selo pulsa uma vez. Nada em loop, tudo atrás de `prefers-reduced-motion`.
- A tela de gravação tem prazo por etapa e escape de 12s: prender alguém na
  última tela do onboarding é o pior desfecho possível.

Pendente de decisão: hoje `/comecar` existe em paralelo e não substituiu nada.
Virar porta de entrada depende de definir se roda **antes do cadastro** — sem
sessão não há onde gravar.

## Como se conclui uma tarefa aqui (obrigatório)

**Alterar arquivo não conclui tarefa.** O protocolo completo está em
[`docs/CLAUDE_ITERATION_PROTOCOL.md`](docs/CLAUDE_ITERATION_PROTOCOL.md). O que
vale sempre, sem precisar abrir o documento:

- `IMPLEMENTATION IS NOT COMPLETION. VERIFICATION IS PART OF IMPLEMENTATION.`
  Código escrito, componente criado, `tsc` passando, build verde e teste isolado
  passando são **etapas intermediárias**, não conclusão.
- Ciclo: `UNDERSTAND → DEFINE DONE → IMPLEMENT → RUN → VERIFY → DIAGNOSE → FIX →
  RE-VERIFY → REGRESSION → DONE`. Falha de verificação **abre iteração**, não
  encerra tarefa.
- Critérios de aceite viram lista **antes** de implementar, não depois de ver o
  que deu para construir.
- `CODE CORRECTNESS IS NOT PRODUCT CORRECTNESS.` Mudança visível na tela se prova
  no navegador. Saída de IA tecnicamente válida e semanticamente errada é `FAIL`.
- Bug: `REPRODUZIR → CAUSA RAIZ → CORRIGIR → REPRODUZIR DE NOVO → REGRESSÃO`.
  Sem correção por palpite, sem alterar cinco coisas para ver qual pega.
- Mesma abordagem falhou 2 vezes → trocar de hipótese. 3 vezes → análise de causa
  raiz (§11 do protocolo) antes de tentar de novo.
- Impedimento externo real: declarar `BLOQUEADO` com evidência e a ação exata
  para destravar. Nunca "concluído".
- Nada de placeholder silencioso, botão sem fluxo real, integração mockada
  chamada de pronta, ou falha escondida no resumo final.

O hook `.claude/hooks/verification-guard.mjs` reforça o mínimo disso de forma
determinística: se houve alteração de código-fonte e nenhuma verificação rodou,
ele bloqueia a parada uma vez. Ele não julga se a verificação foi suficiente —
isso é o gate do protocolo.

## Memória do projeto

Conhecimento persistente vive em [`docs/agent-memory/`](docs/agent-memory/):
`PROJECT_CONTEXT.md` (stack, comandos, portas, invariantes), `VERIFICATION.md`
(como verificar aqui, custo real, falsos positivos conhecidos), `LEARNINGS.md`
(fatos, decisões e abordagens que já falharam), `KNOWN_ISSUES.md` e
`CURRENT_STATE.md` (tarefa em andamento e handoff).

> **BEFORE REDISCOVERING, CHECK MEMORY. BEFORE FINISHING, UPDATE MEMORY.**

Antes de trabalho relevante: ler só os arquivos do domínio da tarefa e validar
contra o código. Depois: registrar o que evita retrabalho futuro, atualizar
`CURRENT_STATE.md` se sobrou trabalho, e **corrigir memória que se revelou
errada**. Memória é cache — em conflito, o código ganha. Tarefa trivial pode não
gerar entrada nenhuma; não escreva por ritual.

## Atualizações Recentes
- **2026-08-10:** **Página indexável sem canônica é página que o `www` pode roubar.** O DNS já cobria os dois hosts (`A` na raiz, `CNAME` no `www`, certificado com os dois, `http→https` em cada um) — não havia registro a criar. O buraco era outro: `/privacy` e `/terms` são arquivos estáticos, não passam pelo `<head>` da SPA, e estavam **sem `rel=canonical` nenhuma** sendo duas das URLs do sitemap. Com os dois hosts em 200 de propósito, essa tag é o único sinal de consolidação. `/livro` tinha o problema espelhado — herdava a canônica da raiz e **se declarava duplicata da home** —, e a página saiu do produto no mesmo dia, com a rota redirecionando para a home em vez de 404. Travas nas duas pontas: teste que cruza sitemap com canônica declarada, e checagem no deploy que confere a canônica servida **nos dois hosts**.
- **2026-08-09:** **O check-in estava perdendo registro em produção.** Humor e energia são obrigatórios, o polegar deles nasce no meio da escala, e tocar ali não disparava evento — o botão ficava desabilitado e mudo. O log confirmou: **zero `POST /checkins` em 30 horas**, com 32 leituras de histórico no mesmo período. Agora o toque confirma o valor e a tela diz o que falta. **O app também não estava no Google:** `/` redirecionava para `/splash` e o buscador classificava a home como "Página com redirecionamento"; além disso `www` e sem-`www` serviam 200 e o Google elegeu o `www`, host fora da propriedade cadastrada. Corrigidos os dois, mais sitemap enviado e indexação solicitada. Idioma passou a seguir o aparelho e a splash ganhou `<head>` próprio em inglês, servido pelo nginx para prévia de link.
- **2026-08-08:** Auditoria de campo do check-in, mascote e inventário. **Toda pergunta da tela agora chega ao banco:** clareza e irritabilidade tinham coluna, contrato e leitor no motor e nenhuma pergunta; capacidade e objetivo prioritário tinham pergunta e nenhum destino. Achado no caminho: num `input[type=range]`, tocar onde o polegar já está não dispara evento — **6 era o único valor de 1 a 10 impossível de responder com um toque**, e o app gravava `null`. A proposta de check-in do diário **nunca funcionou**: `signalMetadata` é `.strict()`, o `parse` lançava e um `catch` mudo engolia, levando junto a proposta de meta. **Mascote Airia Orbital em produção** nas 6 superfícies, de 11,4 MB em PNG para 0,42 MB em WebP, fora do precache. Check-in ganhou fundo que responde a humor e energia, detalhes recolhidos e retorno tátil no registro confirmado.
- **2026-08-08:** `npm test -w apps/backend` passou a descobrir os arquivos (`scripts/run-tests.mjs`). Eram **17 suítes órfãs**, não 8 — todas passaram na primeira execução.
- **2026-08-08:** Protocolo de iteração e conclusão (`docs/CLAUDE_ITERATION_PROTOCOL.md`) + memória operacional (`docs/agent-memory/`) + hook `verification-guard` que barra parada sem verificação.
- **2026-08-03:** Correções de aparência e de relatório. **27 tokens CSS que o código pedia e o CSS nunca definiu** — `var()` que não resolve invalida a declaração, e era isso que fazia botão da página de Objetivos parecer sem título e o "Criar objetivo" parecer desaparecido. Caixa de **Próximas ações** na Home substituiu "Tarefas sugeridas": até 5 itens, sem data, regra é conclusão e não prazo. Dedupe em duas camadas — lexical instantâneo, LLM no caso difícil. Relatório de período passou a analisar a janela inteira, com seletor de 5 períodos e estrutura de 13 seções.
- **2026-08-02:** Reestruturação para o núcleo. Chave de funcionalidade desligou Planner e Hábitos sem apagar nada. Home virou "o que eu faço agora": objetivo em foco com a próxima ação concluível ali. Gamificação de objetivos — 12 XP por micro-ação, 60 por objetivo, com 4 contadores em `EventLog` (zero migração). Diário passou a propor check-in e meta, sempre com confirmação. Login com Google removido. **LGPD:** a tabela `Consent` existia e era exportada mas nunca era escrita — o app não conseguia provar consentimento; agora grava com versão e data, mais endpoints de consulta e revogação.
- **2026-08-02:** Base clínica em `docs/product/base-clinica-padroes-e-acoes.md` (ASRS, MDQ, TCC para ciclotimia, NIMH Life Chart). Três falhas de detecção corrigidas no motor: traços mistos invisíveis porque o composto colapsava humor baixo com energia alta; sinal do sono invertido (dormir pouco **e estar bem** é marcador de elevação, não privação); e `sleepHours` sendo descartado na agregação diária. Estabilidade ganhou valência — platô baixo não é equilíbrio, e depressão sustentada deixou de ser lida como "Estável".
- **2026-07-26:** Virada de captura: a Airia passou a montar tarefa, compromisso, hábito e meta a partir do contexto contado, com agendamento automático, decomposição automática de tarefa vaga, motor de execução passo a passo e progresso que incentiva sem cobrar.
- **2026-05-10:** Guardrails reais de produto ampliados: bloqueio de copy de venda/demo no app, fluxo falso, alegação clínica perigosa, `setHours()` em serviços de agenda, contrato único de `riskSafety` e checklist de release integrado.
- **2026-05-10:** Skill local `skills/airia-pr-review/SKILL.md` criada para tornar obrigatoria a revisao Airia baseada em evidencias antes de finalizar PRs/features/deploys.
- **2026-05-10:** Guardrails de revisão adicionados: `product-guardrails.test.ts`, ampliação de `risk-safety.test.ts` e checklist em `docs/product/pr-review-skill-roadmap.md`.
- **2026-05-10:** Modo/seed de demo removidos do produto. Ficam apenas fluxos reais de consumidor, protocolo de segurança em Check-in/Diário/Aura e `risk_protocol_triggered`.
- **2026-05-09:** Robustez de produto adicionada: `riskSafety` em check-in/diário/Aura, eventos de agenda adaptativa e roteiro de ligação em `docs/product/airia-investor-call-script.md`.
- **2026-04-30:** Airia Decision Brain + AdaptiveAgendaEngine adicionados ao backend para classificar ações reais, sugestões opcionais, insights, bloqueios e permissão de notificação.
- **2026-04-30:** Planner ganhou ação “Adiar” para mover bloco ao dia seguinte e registrar padrão de adiamento para análise.
- **2026-04-30:** `DailyContext`, `/api/context/day`, `/api/agenda/adapt` e `/api/ai/action-feedback` publicados em produção no commit `7c44742`.
- **2026-04-30:** Home registra feedback do card “Análise e Autonomia” no backend para impedir repetição entre sessões.
- **2026-04-29:** fases visíveis alinhadas para as 8 fases oficiais.
- **2026-04-29:** PWA Android destravado com scroll vertical natural e bloqueio lateral restrito ao necessário.

## Como rodar
```bash
# Backend (porta 3001)
npm run dev -w apps/backend

# Frontend (porta 5051)
npm run dev -w apps/web
```
Dentro do Claude Code, prefira `preview_start` com os nomes de `.claude/launch.json`
(`backend`, `web`, `mobile`, `prisma-studio`) em vez de subir servidor pelo shell.
