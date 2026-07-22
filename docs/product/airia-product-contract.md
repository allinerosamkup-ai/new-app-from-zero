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

O fluxo obrigatório é:

1. receber texto, transcrição, TXT, Markdown, PDF, DOCX ou XLSX;
2. separar meta, projeto, tarefa, hábito, compromisso, referência e preocupação sem inventar campos ausentes;
3. bloquear duplicatas e itens concluídos, rejeitados, excluídos ou já agendados;
4. permitir correção e exclusão antes de qualquer gravação;
5. perguntar somente data, frequência ou resultado quando isso impedir a montagem;
6. cruzar itens confirmados com agenda protegida, hábitos existentes e check-in recente;
7. apresentar uma semana editável, incluindo o que não coube;
8. criar metas, hábitos e blocos em uma única transação idempotente.

Compromissos fixos nunca são movidos. Hábitos aparecem somente nos dias devidos. A fase e o check-in dimensionam carga e duração; o horário disponível serve para posicionar, nunca para inferir a fase da pessoa.
