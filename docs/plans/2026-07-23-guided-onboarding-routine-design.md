# Onboarding Guiado e Sistema de Rotina — Design aprovado

## Objetivo

Levar uma nova usuária do cadastro ao primeiro valor real em poucos minutos: uma rotina inicial utilizável, com o dia de hoje e uma base semanal recorrente. A experiência deve ser majoritariamente feita por botões, escolhas visuais e horários simples. Texto livre, conversa e documentos continuam disponíveis, mas deixam de ser pré-requisitos.

O mesmo sistema organiza hábitos, objetivos, metas e tarefas. A usuária não precisa conhecer a diferença técnica entre essas entidades: a Airia interpreta a intenção, apresenta uma proposta clara e só persiste depois da confirmação.

## Princípios

- O primeiro resultado é uma rotina pronta, não um cadastro preenchido.
- Uma pergunta por tela, com escolhas visuais e progresso curto.
- A rotina nasce da vida real: compromissos, disponibilidade, responsabilidades, hábitos desejados e limites.
- Humor e energia ajustam carga, duração, ordem e margem; não inventam obrigações.
- Documento é opcional e fica em Configurações ou no anexo da conversa.
- A Airia faz no máximo duas perguntas adicionais quando uma resposta muda materialmente a agenda.
- Toda criação em lote aparece primeiro como prévia editável.
- Hábitos só aparecem nos dias em que são devidos.
- Itens rejeitados não reaparecem indefinidamente como se fossem novos.
- A experiência usa a identidade visual da Airia. A referência externa orienta a fluidez e o padrão de interação, não a cópia de marca, texto, código ou ativos.

## Momento de ativação

A usuária está ativada quando confirma uma rotina que contém:

1. pelo menos um compromisso ou bloco real;
2. pelo menos um hábito ou cuidado recorrente;
3. uma próxima ação ligada a um objetivo, quando houver objetivo selecionado;
4. uma carga compatível com seu estado atual.

O onboarding termina nesse resultado. Configurações avançadas ficam para depois.

## Fluxo guiado

### 1. Identidade mínima

- Nome ou apelido.
- Faixa etária opcional.
- Indicador de progresso.

É a única etapa em que digitar pode ser necessário. O nome pode vir preenchido pelo perfil.

### 2. Realidade da semana

Pergunta: “O que já ocupa seus dias?”

Cartões de seleção:

- trabalho;
- estudo;
- filhos ou cuidado de alguém;
- casa;
- saúde;
- negócio próprio;
- deslocamento;
- compromissos variáveis;
- outro.

Depois da seleção, a interface pede somente os horários fixos indispensáveis por meio de seletores visuais.

### 3. Energia e funcionamento

As listas “drena mais” e “recupera energia” deixam de ser sete opções soltas e passam a ser bibliotecas por categoria:

- demandas mentais;
- interação social;
- ambiente;
- corpo e saúde;
- casa e cuidado;
- trabalho e estudo;
- organização;
- descanso e prazer.

Cada categoria contém opções concretas. “Outro” abre um campo curto e opcional. A pessoa também informa, por botões, em quais períodos costuma ter mais disponibilidade e qual carga considera sustentável.

### 4. O que quer sustentar ou mudar

A interface mostra cartões de intenção:

- cuidar do corpo;
- dormir melhor;
- organizar a casa;
- produzir ou estudar;
- administrar dinheiro;
- cuidar da saúde;
- fortalecer relações;
- desenvolver um projeto;
- diminuir sobrecarga;
- criar rotina;
- outro.

As escolhas alimentam simultaneamente a biblioteca de hábitos e a criação de objetivos. A Airia diferencia internamente:

- **objetivo:** direção ampla;
- **meta ou projeto:** resultado verificável;
- **tarefa:** ação concluível;
- **hábito:** comportamento recorrente.

Essa classificação aparece em linguagem comum e pode ser corrigida na prévia.

### 5. Estado de hoje

Um check-in curto, feito por escalas e botões, registra humor, energia, foco e sono. Ele calibra somente o primeiro dia e a carga inicial. O estado atual não apaga a base semanal.

### 6. Rotina proposta

A Airia monta:

- **Hoje:** compromissos, hábitos devidos e até três ações prioritárias;
- **Base semanal:** compromissos recorrentes, hábitos nos dias corretos e blocos flexíveis;
- **Objetivos:** direção, resultado esperado e próxima ação;
- **Não encaixado:** itens que excederam capacidade ou continuam ambíguos.

A prévia é editável. A usuária pode trocar dia, horário, duração, frequência ou remover um item. Um único botão, “Usar esta rotina”, confirma tudo.

## Montador de rotina

O Montador passa a ter duas entradas:

### Entrada principal: guiada

Começa por escolhas visuais, sem exigir texto ou arquivo. Reutiliza respostas do onboarding e permite montar novamente a rotina a qualquer momento.

### Entrada opcional: importar

Texto, áudio transcrito ou documento continuam usando a classificação já existente. Essa entrada fica:

- em Configurações, como “Importar rotina ou documento”;
- no anexo da conversa com a Airia;
- como ação secundária no Montador.

Importação cria candidatos e nunca altera agenda silenciosamente.

## Hábitos — UX e UI

A página de hábitos terá duas visões principais:

- **Hoje:** somente hábitos devidos na data selecionada, com conclusão em um toque;
- **Todos:** biblioteca pessoal, recorrência e histórico.

O botão principal é “Adicionar hábito”. Ele abre uma biblioteca por categorias:

- manhã;
- corpo e saúde;
- medicação;
- casa;
- trabalho e estudo;
- organização;
- autocuidado;
- relações;
- sono;
- lazer.

Cada sugestão mostra nome, duração inicial e melhor período. Ao tocar, a pessoa escolhe frequência por chips:

- todos os dias;
- dias úteis;
- dias específicos;
- algumas vezes por semana;
- mensal.

Horário, lembrete e duração aparecem como opções visuais, não como formulário extenso. A página deve permitir editar, pausar e arquivar sem abrir múltiplas telas. Sequências são informativas, sem linguagem de punição.

## Objetivos, metas e projetos — UX e UI

A rota atual de metas será simplificada em três níveis visuais:

1. **Direções:** áreas que a pessoa quer mudar ou sustentar;
2. **Resultados:** metas e projetos ligados a uma direção;
3. **Próxima ação:** tarefa concreta que faz o resultado avançar.

A tela terá:

- resumo curto das direções ativas;
- cartões de metas com progresso e próxima ação visível;
- botão “Criar objetivo” com biblioteca de exemplos;
- captura livre opcional;
- decomposição pela Airia em prévia editável;
- ações “Fazer agora”, “Planejar” e “Transformar em hábito”.

A usuária não precisa escolher previamente se algo é objetivo, meta, projeto ou tarefa. Ela informa o que quer alcançar e a Airia propõe a estrutura. A confirmação mostra claramente o que será criado.

## Tarefas — UX e UI

Tarefas continuam sendo blocos operacionais do Planner, evitando uma segunda agenda concorrente. A experiência ganha uma visão própria de tarefas dentro do Planner:

- hoje;
- próximas;
- sem data;
- concluídas.

Cada cartão mostra:

- verbo e objeto concretos;
- duração;
- horário ou janela;
- objetivo relacionado, quando existir;
- flexibilidade;
- estado.

O cadastro rápido pergunta apenas “O que precisa ser feito?” e oferece duração e momento por chips. A Airia pode quebrar tarefas grandes, mas sempre mostra a proposta antes de criar novas ações.

## Relação entre as superfícies

- O onboarding cria a primeira sessão guiada do Montador.
- O Montador é a única origem para criação em lote.
- Hábitos, objetivos e tarefas editam suas entidades reais.
- O Planner organiza tarefas e compromissos.
- A Home mostra somente itens válidos para hoje.
- A conversa da Airia pode abrir ou retomar o Montador, mas não mantém um montador paralelo.

## Comportamento da Airia

A conversa central responde e analisa por padrão. Ações operacionais só são executadas quando o pedido é explícito. Quando a pessoa pede “monte minha rotina”, a Airia abre ou retoma uma sessão do Montador em vez de devolver blocos genéricos.

O contexto histórico ajuda a reconhecer padrões. A criação operacional usa apenas itens atuais, respostas confirmadas e decisões da usuária.

## Estados e erros

- Toda tela tem carregamento, vazio, erro e retomada.
- Erros de validação indicam o campo e a correção necessária; nunca exibem apenas “Falha na validação”.
- Se a composição falhar, respostas e escolhas continuam salvas.
- Se a aplicação falhar, nenhuma entidade parcial é criada.
- Repetir a confirmação não duplica itens.

## Privacidade

- Diagnósticos e medicação continuam opcionais.
- Documentos não são exigidos nem armazenados além do necessário.
- Conteúdo bruto não entra em logs.
- A usuária pode apagar ou exportar os dados de onboarding e rotina.

## Critérios de aceite

1. Uma nova usuária monta o primeiro dia sem escrever um relato nem anexar documento.
2. O fluxo principal usa botões e seletores em todas as decisões estruturadas.
3. O Montador produz Hoje + base semanal recorrente.
4. Hábitos aparecem somente nos dias corretos na Home e no Planner.
5. Uma intenção ampla é separada de uma meta, tarefa e hábito sem exigir conhecimento técnico da usuária.
6. Objetivos mostram próxima ação concreta.
7. Tarefas grandes podem ser reduzidas ou quebradas, com confirmação.
8. Documento fica disponível apenas como entrada opcional.
9. A prévia permite editar e remover antes de persistir.
10. Nenhuma confirmação duplicada cria registros repetidos.
11. Todos os erros de validação são específicos e acionáveis.
12. O mesmo conjunto de dados aparece de forma coerente na Home, Planner, Hábitos e Objetivos.
