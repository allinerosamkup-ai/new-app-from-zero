# Contrato técnico central da Airia

> A fonte canônica de decisões de produto é
> [`PRODUCT_CONSTITUTION.md`](PRODUCT_CONSTITUTION.md). Este arquivo mantém os
> contratos técnicos e comportamentais de implementação, persistência e
> integração. Não crie aqui uma interpretação divergente do produto.

## Entrega principal

No centro está o MoodCycleEngine. Ele acompanha humor e energia e posiciona a pessoa em uma de oito fases claras: Voo Alto, Fluindo, Estável, Desacelerando, Recolhimento, Pausa, Retomada e Turbulência.

A partir da fase atual, a Airia adapta a agenda, protege a energia e oferece um próximo passo concreto. Ela não é planner genérico, não é chatbot de terapia e não preenche ausência de contexto com conselho genérico.

## Regra de decisão

Contexto antigo explica o padrão; contexto de hoje decide a ação.

Histórico, RAG e fase podem reconhecer recorrência e calibrar tamanho, tom, horário e iniciativa. Eles não autorizam tarefa, compromisso, notificação ou mudança de agenda sozinhos.

A Airia existe para tirar trabalho da usuária. Quando a fala de hoje contém um item, ela entrega o item **montado** — título, data, hora e duração já decididos — e diz o que decidiu em uma frase. Não devolve a lacuna como pergunta para quem acabou de contar o que precisa fazer.

Âncora atual real é qualquer uma destas:

- tarefa ou subtarefa pendente;
- compromisso real da agenda;
- hábito devido;
- meta ativa;
- ação explicitamente pedida ou aceita pela usuária;
- **o que a usuária acabou de contar**: compromisso marcado, prazo, pedido de terceiro, intenção de retomar algo.

Sem nenhuma dessas, a Airia não preenche o silêncio com microação tirada do relógio. O único dado que ela nunca inventa é o título do item — aí ela faz uma pergunta curta, só essa.

## O que continua bloqueado

Automatizar o que ajuda não é automatizar tudo. Seguem sem criar nada:

- pedido explícito de escuta ("só quero desabafar");
- negação explícita ("não cria tarefa com isso");
- instrução citada de documento, nota ou tradução — texto de terceiro falando com a Airia não é pedido da usuária;
- ação destrutiva (apagar, mover, concluir) derivada de relato: contexto autoriza criar, nunca alterar o que já existe.

Âncora protegida — consulta, compromisso com terceiro, evento importado do Google — não entra em remanejamento automático: quebrar isso tem custo fora do app. E criar não é o mesmo que notificar: gravar um bloco é barato, tocar o celular não é.

## Progresso e recompensa

Gamificação incentiva; não cobra. São coisas diferentes, e a linha entre elas é uma só: **recompensa por aparecer, nunca punição por faltar.**

- Fase de Recolhimento e Pausa não quebra sequência — ela atravessa o dia ruim. A Airia é o único app que sabe que hoje foi um dia ruim, e usa isso para proteger, não para descontar.
- Ausência não gera mensagem. Silêncio é o comportamento correto para quem não apareceu.
- Rotina largada no meio também paga, porque começar é a parte cara.
- Celebração fala do que aconteceu e nunca do que faltou.

## Diferença do produto

A Airia se adapta; não cobra. A fase descreve onde a pessoa está hoje, não rotula quem ela é. A Aura lê padrões e oferece uma manobra concreta por vez, usando linguagem natural e sem diagnóstico.

Para quem tem agenda livre, a Airia pode tomar mais iniciativa e propor estrutura. Para quem tem compromissos rígidos, ela protege essas âncoras e adapta somente o restante. O foco continua sendo facilitar a vida autônoma sem excluir quem possui horários fixos.

## Critério de aceitação

Uma experiência da Airia só está correta quando entrega, em conjunto:

1. fase atual compreensível;
2. leitura ancorada em dados reais;
3. adaptação de agenda compatível com a liberdade e as restrições do dia;
4. um próximo passo específico quando existe âncora atual, ou uma pergunta curta quando ela não existe;
5. memória que dá continuidade sem criar autoridade operacional.

## Check-in canônico e comando central

Check-in é o registro do estado atual de humor e energia. Ele pode começar na tela, na voz, no mobile ou na conversa com a Airia, mas todas essas entradas terminam no mesmo gravador. Não existem históricos paralelos nem sucesso baseado apenas no texto gerado pela IA.

- Humor e energia são os dois sinais centrais obrigatórios, sempre na escala de 1 a 10.
- Clareza, irritabilidade, físico, social, sono e horas de sono são opcionais. Ausência é `null`, nunca um valor neutro inventado.
- Uma frase natural com os dois sinais, como “estou chateada e cansada”, pode ser aplicada automaticamente com valores inferidos e proveniência visível.
- Um único sinal pede somente o complemento necessário. Recusa explícita ou desabafo sem autorização não grava.
- Estado e pedido operacional podem coexistir na mesma fala; registrar o estado não apaga a tarefa, meta ou compromisso pedido.
- Cada entrada registra origem, mensagem de origem quando aplicável, proveniência e chave de idempotência. Repetir a mesma mensagem não duplica; uma nova mensagem no mesmo período pode gerar um novo registro.
- A confirmação visível vem do recurso persistido e oferece “Ajustar check-in”. Plano sem operação não é mostrado.

Depois de persistir, o mesmo fluxo executa protocolo de risco, grounding do dia, leitura do estado, atualização de memória e grafo e recarrega as superfícies consumidoras. Home, Planner, Check-in, Padrões, Diário e Airia passam a enxergar a mesma fonte atual.

## Montador de Rotina

O Montador é a ferramenta do **onboarding** — o momento em que o app ainda não sabe nada da pessoa e precisa de uma primeira fonte para montar a semana com botões, sem digitação obrigatória.

Depois do onboarding ele sai de cena. Pedidos como “monte meu dia”, “organize minha semana” ou “transforme isto em rotina” são atendidos **pela Airia, na conversa**: ela lê memória, fase e estado atual, propõe os itens já com dia, horário e duração, e o que a pessoa aceita é salvo automaticamente na página correspondente — Planner, Hábitos ou Metas. A Airia não manda a usuária para outra tela para fazer o que ela consegue fazer no chat.

O caminho principal é guiado e funciona sem documento: a usuária escolhe áreas da vida, compromissos protegidos, fatores de energia, intenções e hábitos em controles de toque. A Airia transforma essas escolhas em itens classificados e apresenta a semana pronta para revisão.

Texto, transcrição, TXT, Markdown, PDF, DOCX ou XLSX são uma entrada opcional, acessível no montador e em Configurações. Quando existe uma fonte, o fluxo:

1. separa meta, projeto, tarefa, hábito, compromisso, referência e preocupação sem inventar campos ausentes;
2. bloqueia duplicatas e itens concluídos, rejeitados, excluídos ou já agendados;
3. permite correção e exclusão antes de qualquer gravação;
4. pergunta somente data, frequência ou resultado quando isso impedir a montagem;
5. cruza itens confirmados com agenda protegida, hábitos existentes e check-in recente;
6. apresenta uma semana editável, incluindo carga prevista, conflitos e alternativas;
7. apresenta uma proposta em cards, um por item operacional, com data, horário, duração e recorrência quando existirem;
8. cria metas, hábitos e blocos em transação idempotente por item ou por lote.

Um pedido simples como “monte minha rotina” abre o fluxo guiado. Uma lista ou documento com conteúdo operacional abre a revisão da fonte. Uma sessão antiga nunca substitui silenciosamente um novo pedido.

Pedidos naturais com intenção equivalente — “preciso criar uma rotina”, “quero montar meu dia”, “me ajude a organizar minha semana” — são reconhecidos de forma determinística e montam a rotina na conversa. Esse roteamento não depende da interpretação livre do modelo. Negação, desabafo e mera menção ao tema não montam nada.

Listas operacionais extensas, com caixas de seleção, recorrências, objetivos ou seções numeradas, também são fonte de rotina mesmo quando a usuária não escreve literalmente “monte uma rotina”. A conversa deve encaminhar esse conteúdo para classificação e revisão; uma resposta genérica não substitui a montagem.

Compromissos fixos nunca são movidos. Hábitos aparecem somente nos dias devidos. A disponibilidade geral organiza tarefas flexíveis, mas não apaga a recorrência nem a janela própria de um hábito. Um hábito já existente não pode reaparecer como sugestão nova com o mesmo título. A fase e o check-in dimensionam carga e duração; o horário disponível serve para posicionar, nunca para inferir a fase da pessoa.

Cada prévia possui uma versão do motor. Ao abrir uma sessão pronta produzida por versão anterior, o backend recompõe automaticamente a prévia antes de entregá-la. A usuária não precisa apagar dados, reiniciar o onboarding nem apertar um botão de atualização.

Na aplicação:

- `Adicionar` salva aquele card imediatamente e muda seu estado visual somente após a confirmação do backend.
- `Editar` permite corrigir nome, tipo, data, horário, duração e recorrência, e recompõe a proposta antes de salvar; `Descartar` retira o item do lote sem apagar o que já foi adicionado.
- `Aceitar todos` salva apenas os cards restantes e nunca duplica itens adicionados individualmente.
- Objetivo é resultado desejado; próxima ação é o movimento concreto ligado a ele.
- Uma ação só entra no Planner depois de escolha explícita de quando executá-la.
- Hábitos preservam frequência, dias, período e duração; adiar ou pular vale apenas para o dia.
- A visão de tarefas do Planner é outra leitura da mesma fonte de agenda, não uma lista paralela.

## Acesso, cobrança e profissionais verificadas

O onboarding canônico termina em `/comecar` e concede uma única experiência Pro
confirmada pelo servidor: 7 dias no fluxo normal ou 14 dias quando uma indicação
profissional verificada foi atribuída antes da primeira concessão. Refazer o
onboarding recalibra o perfil, mas não reinicia período, troca indicação nem apaga
histórico.

Existem três ofertas comerciais explícitas:

- mensal: R$ 29,90 por mês;
- anual: R$ 249 por ano;
- vitalícia especial: R$ 99 em pagamento único.

Mensal e anual são assinaturas; vitalícia é compra única e pode ser fechada para
novas vendas sem retirar o acesso de quem já pagou. A interface nunca ativa Pro
por parâmetro de URL: retorno de Checkout fica pendente até o servidor confirmar
propriedade e estado, e o webhook Stripe é a fonte de verdade para cobrança.

Psicólogas com CRP ativo podem solicitar verificação. A aprovação concede Pro sem
custo e libera um código persistente que oferece 14 dias Pro a uma nova usuária.
O CRP comprova registro profissional, não vínculo terapêutico. A Airia não é
terapia, não promete resultado clínico e não compartilha lista, identidade, saúde
ou atividade das pessoas indicadas com a profissional.

Cobrança, exportação e acesso obedecem a fronteiras separadas: recursos de
privacidade, segurança, exportação e dados já registrados não podem ser bloqueados
por paywall. O próprio export inclui situação do plano, período, cadastro
profissional e indicação, mas remove identificadores Stripe, notas administrativas,
IDs internos de relacionamento e todo o ledger de webhooks.
