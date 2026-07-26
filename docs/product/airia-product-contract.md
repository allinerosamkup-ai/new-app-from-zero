# Contrato central da Airia

## Entrega principal

No centro está o MoodCycleEngine. Ele acompanha humor e energia e posiciona a pessoa em uma de oito fases claras: Voo Alto, Fluindo, Estável, Desacelerando, Recolhimento, Pausa, Retomada e Turbulência.

A partir da fase atual, a Airia adapta a agenda, protege a energia e oferece um próximo passo concreto. Ela não é planner genérico, não é chatbot de terapia e não preenche ausência de contexto com conselho genérico.

## Regra de decisão

Contexto antigo explica o padrão; contexto de hoje decide a ação.

Histórico, RAG e fase podem reconhecer recorrência e calibrar tamanho, tom, horário e iniciativa. Eles não autorizam tarefa, compromisso, notificação ou mudança de agenda sozinhos.

Toda sugestão operacional precisa de uma âncora atual real:

- tarefa ou subtarefa pendente;
- compromisso real da agenda;
- hábito devido;
- meta ativa;
- ação explicitamente pedida ou aceita pela usuária.

Sem âncora atual, a Airia faz uma pergunta curta para encontrar o fato que falta. Ela não inventa uma microação para cumprir uma regra de movimento.

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

## Montador de Rotina

Pedidos amplos como “monte meu dia”, “organize minha semana” ou “transforme este documento em rotina” não usam o gerador rápido de blocos. Eles abrem uma sessão persistente do Montador de Rotina.

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

Pedidos naturais com intenção equivalente — por exemplo, “preciso criar uma rotina”, “quero montar meu dia” ou “me ajude a organizar minha semana” — também abrem o Montador de forma determinística. Esse roteamento não depende da interpretação livre do modelo e prevalece sobre respostas conversacionais ou tentativas de criar blocos diretamente. Quando o pedido já contém conteúdo suficiente, a classificação começa automaticamente ao abrir o Montador, sem exigir outro clique. Negação, desabafo e mera menção ao tema não abrem o fluxo.

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
