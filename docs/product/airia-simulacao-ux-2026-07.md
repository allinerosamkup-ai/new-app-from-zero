# Simulação de usuário — Airia (julho/2026)

Teste de experiência percorrendo o app real em navegador (Chromium, viewport 390×844,
pt-BR) com uma persona: **Aline, 34 anos, TDAH + ciclotimia, 21 dias de check-in,
agenda com compromissos protegidos (consulta, buscar a filha) e trabalho flexível.**

Superfícies percorridas: onboarding guiado, Montador de Rotina, Planner, botão Airia,
Diário, Metas e Hábitos — incluindo criação de tarefa/compromisso/hábito por **texto** e
por **voz**, e o caso em que a usuária apenas **conta o contexto** sem pedir nada.

---

## 1. Como o teste foi montado (o que é real e o que é simulado)

| Camada | Como rodou |
|---|---|
| Frontend | **Real.** `apps/web` em Vite, navegado por Playwright em viewport de celular. |
| Montador de Rotina | **Real.** `RoutineBuilderService`, `getGuidedLibrary`, `RoutineComposerService` e `deriveRoutineCapacity` executados de verdade. |
| Portão de captura da Airia | **Real.** `AiriaCognitiveInterpreterService.interpret` + `enforceAuraCaptureGate` executados de verdade. |
| Proteção de risco | **Real.** `assessRiskSafety`. |
| Banco / Supabase | Substituídos por um backend em memória com dados semeados. |
| Texto da resposta da Airia | **Simulado.** Sem `OPENAI_API_KEY` no ambiente, a redação das falas da Aura é canned. |
| Voz | Web Speech API substituída por um stub que injeta transcrição — testa o fluxo da UI, não a precisão do reconhecimento. |

> **Consequência importante:** sem chave da OpenAI, o interpretador cognitivo cai no
> caminho **heurístico** (`airia-cognitive-interpreter.service.ts:726`). Tudo que este
> relatório afirma sobre classificação de fala vale **com certeza para o modo degradado**
> (sem IA / IA fora do ar). Em produção com o modelo online, quem classifica é o LLM —
> mas o portão `enforceAuraCaptureGate` é determinístico e vale **sempre**.

---

## 2. A pergunta central: a Airia cria compromisso sem a usuária pedir?

**Não. E isso é uma decisão de arquitetura, não um acidente.**

Existe um portão obrigatório (`apps/backend/src/index.ts:138`) por onde passa toda ação
mutante da Airia (`create_task`, `create_agenda`, `create_goal`, `create_checklist`,
`update_task`, `delete_task`, `complete_items`, `handoff_to_journal`). Ele só deixa passar
se **duas** condições forem verdadeiras ao mesmo tempo:

1. o julgamento de captura autorizou aquela ação para **a fala atual**; e
2. o payload está completo (para tarefa: título **e** data **e** hora).

Falhando qualquer uma, a resposta inteira é substituída por:

> *"Estou te ouvindo. Não vou transformar isso em tarefa nem alterar sua agenda sem um
> pedido explícito."*

### Resultado observado no app, ao vivo

| Fala da usuária | Superfície | Airia criou? | O que apareceu |
|---|---|---|---|
| "Marquei uma consulta com a dermatologista quinta às 15h, finalmente consegui vaga." | Airia | **Não** | Mensagem de escuta. Nada na agenda. |
| "O relatório do cliente vence sexta e eu ainda nem comecei." | Airia | **Não** | Mensagem de escuta. |
| "Preciso muito voltar a caminhar de manhã." | Airia | **Não** | Mensagem de escuta. |
| "Dia pesado. Tenho reunião com o RH terça de manhã…" | Diário | **Não** | Conversa segue; nada criado. |
| "Cria uma tarefa: revisar o orçamento hoje às 16h." | Airia | **Sim** | Bloco criado + card "PLANNER ATUALIZADO · 1 tarefa criada · Ver planner". |
| "Cria uma meta de organizar as finanças de casa." | Airia | **Sim** | Meta criada + card "META CRIADA · Abrir metas". |
| "Já fiz a caminhada hoje, marca como feito." | Airia | **Sim** | `complete_items` liberado. |
| "Monta minha semana pra mim." | Airia | Abre o Montador | Não cria nada antes da revisão. |
| "Não cria tarefa nenhuma com isso." | Airia | **Não** | Negação prevalece sobre o verbo. |

O único lugar onde contexto implícito **vira proposta** é o **fim da sessão do Diário**:
ao tocar "encerrar e salvar sessão", aparecem "COMPROMISSOS SUGERIDOS" e "TAREFAS
SUGERIDAS" com um botão "+ Planner" por item. Ou seja: a leitura de contexto existe, mas
ela desemboca em **sugestão revisável**, nunca em gravação silenciosa.

### Isso está certo — mas hoje custa caro em dois pontos

**(a) Pedido explícito sem horário é recusado com a mensagem errada.**
"Adiciona uma tarefa de comprar ração" **é** um pedido explícito e é classificado como
tal. Mesmo assim o portão barra, porque `create_task` exige `date` **e** `startTime`
(`index.ts:181`). A usuária recebe *"não vou transformar isso em tarefa sem um pedido
explícito"* — dizendo que ela não pediu, quando ela pediu. Só faltou a hora.

**(b) No modo degradado, "Cria pra mim: consulta com a dermatologista quinta às 15h" é
recusado.** A heurística só reconhece criação quando o substantivo literal
"tarefa"/"lembrete" aparece depois do verbo (`airia-cognitive-interpreter.service.ts:375`);
"consulta" só entra pela lista de agendamento, que exige os verbos "agende/marque"
(`:377`). Com o modelo online isso provavelmente passa; com o modelo fora do ar, a Airia
vira uma parede educada bem na hora em que a usuária pediu ajuda.

**Ideia 1 — separar "não pediu" de "faltou dado" (alto impacto, baixo custo).**
Quando a ação foi autorizada e só falta data/hora, responder com a pergunta que resolve:
*"Consigo criar 'comprar ração'. Hoje, amanhã ou sem hora marcada?"* com 3 chips. Hoje
o portão tem uma saída única para dois problemas diferentes.

**Ideia 2 — permitir tarefa sem hora.** A exigência de `startTime` é do contrato, não da
usuária. Para o público-alvo, "tenho que ligar pra escola em algum momento" é o formato
mais comum. Um bloco flexível sem hora (com `temporalPolicy: 'flexible'`) resolve.

**Ideia 3 — ampliar a heurística de fallback.** Aceitar `crie|cria|adicione|adiciona` +
substantivo de agenda (consulta, reunião, compromisso, aula, exame), não só
"tarefa/lembrete". É uma linha de regex e protege o pior dia do usuário.

**Ideia 4 — oferecer, não decidir, quando o contexto é claro.** Quando a fala é
classificada como `calendar_commitment` (compromisso com âncora temporal relatado, não
pedido), a Airia hoje só escuta. Um chip discreto de uma linha — *"quer que eu coloque
quinta 15h na agenda?"* — respeita o princípio ("sugestão não vira compromisso sem
confirmação") e elimina o retrabalho de redigitar. O dado já foi entendido; jogá-lo fora
é que é o desperdício.

---

## 3. Achados por severidade

### 🔴 Bloqueadores

**B1. O banner "Instalar Airia no celular" intercepta cliques no topo de todas as telas.**
`position: fixed; top: 12px; z-index: 10000` (`components/InstallPWA.tsx:252`). Verificado
com `document.elementFromPoint`: no ponto do botão "Criar objetivo" (y≈44) quem responde é
o container do banner, e o clique falha por timeout. Depois de fechar o banner, o mesmo
clique funciona. Ele também cobre o título de todas as páginas e o primeiro card do
Montador.
→ **Correção:** empurrar o conteúdo (`padding-top` no shell quando o banner está visível)
ou ancorar o banner embaixo, acima da nav. E não exibi-lo durante o onboarding.

**B2. O CTA principal do onboarding guiado renderiza sem estilo.**
`guided-onboarding-page.tsx:21` importa apenas `styles/aura.css`, mas o `AuraButtonV2` usa
as classes `btn-aura`/`btn-aura-primary`, definidas em `styles/editorial.css:111,235`. Como
a rota `/onboarding/guiado` fica **fora** do `AuraLayout` (que é quem importa o
editorial.css), quem abre o app direto no onboarding vê "Continuar" e "Montar minha
rotina" como botão cinza padrão de navegador — nos 7 passos.
→ **Correção:** `import '../styles/editorial.css'` na página. Uma linha.

**B3. No Diário não dá para enviar mensagem pelo teclado.**
Não existe `onKeyDown` no textarea (o Aura tem, `aura-chat-page.tsx:922`), então Enter
apenas quebra linha; e o botão de envio é uma `<div class="journal-send">`
(`journal-page.tsx:1289`) — sem `<button>`, sem `role`, sem `aria-label`, fora da ordem de
tabulação. Um usuário de teclado ou leitor de tela **não consegue enviar**.
→ **Correção:** virar `<button type="submit" aria-label="Enviar">` + Enter envia
(Shift+Enter quebra linha), igual ao Aura.

### 🟠 Alto impacto

**A1. Contraste do balão da usuária no chat da Airia.**
`background: rgba(243,176,140,.58)` com `color: #fff` (`aura-chat-page.tsx:693`). Sobre o
fundo claro isso dá ≈**1.4:1** — muito abaixo do mínimo de 4.5:1. No Diário o mesmo balão
usa texto escuro e fica legível. Duas superfícies de conversa, dois tratamentos.
→ Usar o padrão do Diário nos dois.

**A2. Home mostra o mesmo card de ativação duas vezes, simultaneamente.**
"COMECE POR AQUI · Dê contexto para a Airia" (card na página) e "PRIMEIRO CAMINHO AIRIA ·
Dê contexto para a Airia" (bottom sheet) têm título, texto e os mesmos 3 mini-cards. E,
para conta nova, ainda entra por cima o modal "Quer calibrar sua Airia?" e o banner de
instalação: **quatro camadas na primeira tela**.
→ Um único componente de ativação, e no máximo uma camada por sessão.

**A3. A Home não mostra o dia.**
Com 6 blocos e 3 hábitos para hoje, a primeira tela é fase + card de ativação. Nenhum
"próximo compromisso". Para um app que se define como agenda adaptativa, o que vem agora
deveria ser a informação mais alta da tela.
→ Abaixo do card de fase: **um** item — o próximo compromisso real — com "começar" e
"adiar".

**A4. Fim do Montador não leva ao que foi criado.**
A semana foi montada para segunda (27/07); "Abrir meu Planner" abre em **hoje** (26/07),
que continua igual. Em Hábitos, o hábito recém-criado ("Me mexer 20 minutos", seg/qua/sex)
não aparece na aba "Hoje" porque hoje é domingo. A usuária termina o onboarding e não vê
nada do que acabou de construir.
→ Abrir o Planner **no primeiro dia com item novo**, com os blocos criados destacados.

**A5. Salvar uma tarefa simples exige rolar ~1.500px.**
No sheet "Nova tarefa", o botão "Criar tarefa" está em y≈**2390** num viewport de 844.
Antes dele: política temporal ("CORRIGIR COMO A AIRIA DEVE TRATAR ESTE HORÁRIO" —
já aberta por padrão), alertas e subtarefas.
→ Botão fixo no rodapé do sheet + avançado recolhido por padrão. Título, hora e duração
já estão ótimos com chips; o resto é opcional.

**A6. Hierarquia invertida nos cards de hábito.**
"Adiar", "Pular hoje" e "Pausar" ocupam três linhas com rótulo, enquanto **concluir** é um
círculo vazio pequeno no canto. A ação que a pessoa faz todo dia é a menos visível; as
três que ela faz raramente dominam o card. "Adiar" ainda usa azul claro sobre branco e
parece desabilitado.
→ Concluir vira alvo grande e colorido à esquerda; as outras três entram num "⋯".

### 🟡 Fricção e clareza

**F1. Quatro palavras para a mesma coisa.** A nav diz **Planner**; o botão no Planner diz
**Metas**; a página se chama **Objetivos**; os cards dizem **Resultado desejado**; as
subtarefas são **movimentos**; e no Montador o tipo é **Meta**. Escolher um par
(ex.: Metas / próximos passos) e usar em todo lugar.

**F2. A mesma frase três vezes na prévia da semana.** `plan.capacity.reason` aparece no
resumo, no card "RITMO CONSIDERADO" (`week-preview.tsx:108`) e ainda dentro do motivo de
cada bloco (o composer concatena). Dizer uma vez.

**F3. Datas ISO na cara da usuária.** "Sem janela segura em 2026-07-26"
(`routine-composer.service.ts:389`) — no mesmo card em que outras datas aparecem como
"27/07/2026". Formatar como "hoje" / "domingo, 26".

**F4. "Ainda precisa de revisão" lista hábitos antigos, sem ação.** Ao remontar a rotina,
a seção mostra "Remédio da noite", "Caminhada de 20 min" e "Beber água" — coisas que a
usuária não acabou de criar — e não oferece nenhum botão. Ou some, ou vira uma ação
("mover para outro dia").

**F5. Plurais quebrados.** "Rotina proposta: 1 hábito(s), 1 tarefa(s) e 1 meta(s)",
"1 dia(s) acima da carga", "Foram criadas 1 metas, 1 hábitos e 3 blocos"
(`i18n/locales/pt.json:922`). O i18next já tem `_one/_other`.

**F6. Erros de digitação no caminho de ativação.** "Use o **diario**"
(`features/aura/activation.ts:55`), "Abrir meu **diario**" (`:53`), "Monte um dia
**possivel**" (`components/activation/ActivationChecklist.tsx:15` e
`routes/planner-page.tsx:3366`), "**Diario**" no mini-card. São as primeiras frases que a
usuária lê.

**F7. Tom de cobrança no Planner.** "⚠️ LIMITE EXCEDIDO — Você ultrapassou seu limite
planejado. Tente delegar ou adiar blocos pesados." (`planner-page.tsx:1672`). O contrato do
produto diz "a Airia se adapta; não cobra". E "18 / 15 UP" usa uma unidade que nunca é
explicada.
→ "Seu dia está mais cheio do que a energia de hoje comporta. Quer que eu mova o mais
pesado?" + botão que já faz a adaptação.

**F8. Timeline com ruído fixo.** Cada bloco exibe permanentemente EXCLUIR + Falar +
Comecei + Adiar + Dividir, e cada hora vazia tem um "+" (15 na tela). São ~50 alvos de
toque num dia com 6 compromissos.
→ Uma ação primária por bloco ("Comecei") e o resto por toque no card ou swipe.

**F9. Encerrar o Diário é o link mais escondido da tela.** "encerrar e salvar sessão" tem
11px, opacidade 0.7 e sublinhado — mas é o que gera o resumo e as tarefas sugeridas, ou
seja, todo o valor da sessão.

**F10. Sem desfazer.** O card "PLANNER ATUALIZADO · 1 tarefa criada" só oferece "Ver
planner". Para um público com impulsividade, "Desfazer" ao lado é o par natural.

**F11. Voz não existe onde se cria.** O ditado funciona bem (testado no Aura e no Diário:
o texto entra no campo e a pessoa revisa antes de enviar — comportamento correto). Mas o
sheet "Nova tarefa", o de meta e o de hábito **não têm microfone**. É justamente ali que
digitar em dia ruim é barreira.

**F12. Revisão do Montador mistura rotina com respostas do onboarding.** Entre os itens a
revisar aparecem "O que já ocupa meus dias" (áreas da vida) e "O que costuma me drenar"
(drenos) como cards tipo "Referência". São contexto, não itens de rotina — e obrigam a
usuária a triar coisas que ela nunca pediu para criar.

### 🟢 O que está bom e deve virar padrão

- **Sheet de "Novo objetivo"** — o melhor da navegação: chips de direção, "Resultado
  desejado", "Primeira ação concreta", CTA desabilitado até fazer sentido, e a frase
  *"Essa ação ainda não entra na agenda. Você escolhe quando colocá-la no seu dia."*
  Deveria ser o molde do sheet de tarefa e de hábito.
- **"Este resultado ainda não tem um passo concreto. Você decide o primeiro; a Airia não
  inventa por você."** — a identidade do produto em uma frase, na tela.
- **Onboarding guiado por botões** — 7 passos, tudo em toque, nada de digitação
  obrigatória. Certo para o público.
- **Prévia da semana com "AJUSTAR"** — mostrar o que não coube e por quê, em vez de
  empurrar, é exatamente o contrato.
- **Portão de captura** — segura o comportamento mais perigoso que um assistente desses
  poderia ter.
- **Ditado contínuo** que escreve no campo e espera revisão, em vez de enviar sozinho.

---

## 4. Ordem sugerida

| # | Ação | Onde | Esforço |
|---|---|---|---|
| 1 | Banner de instalação para de cobrir/bloquear o topo | `InstallPWA.tsx` | P |
| 2 | Importar `editorial.css` no onboarding guiado | `guided-onboarding-page.tsx:21` | P |
| 3 | Enviar com Enter + botão real no Diário | `journal-page.tsx:1289` | P |
| 4 | Contraste do balão da usuária no chat Airia | `aura-chat-page.tsx:693` | P |
| 5 | Plurais e erros de digitação do caminho de ativação | i18n + `activation.ts` | P |
| 6 | Separar "faltou dado" de "não pediu" no portão | `index.ts:181` | M |
| 7 | Um só card de ativação na Home + "próximo compromisso" | `home-page.tsx` | M |
| 8 | Salvar fixo no sheet de tarefa + avançado recolhido | `planner-page.tsx` | M |
| 9 | Concluir vira ação primária no card de hábito | `habits-page.tsx` | M |
| 10 | Planner abre no primeiro dia com item novo | pós-`apply` | M |
| 11 | Vocabulário único (Metas / próximos passos) | i18n | M |
| 12 | Microfone nos sheets de tarefa, meta e hábito | 3 telas | M |
| 13 | Tarefa sem hora + chip de confirmação para compromisso relatado | contrato + Aura | G |

---

## 5. Limitações

- A **redação** das respostas da Airia neste teste é canned; nada aqui avalia qualidade de
  texto do modelo. O que foi avaliado do lado da IA é **o que ela tem permissão de fazer**.
- Sem `OPENAI_API_KEY`, a classificação rodou no caminho heurístico. Achados sobre
  classificação valem com certeza para o modo degradado; o portão vale sempre.
- Persona única, um viewport, sem teste com leitor de tela real e sem medição de
  performance.
