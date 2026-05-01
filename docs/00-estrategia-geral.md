# Documento 0 — Estratégia e Núcleo do Produto

*Este documento consolida os insights valiosos gerados nas reuniões iniciais de concepção (do Perplexity), servindo de bússola para o projeto.*

## 1. Núcleo do Aplicativo

A ideia é forte: o app não deve ser “mais um planner para TDAH”, e sim uma **plataforma de gestão de ciclagem de humor e energia psíquica**, conectando biometria, autopercepção e organização do dia.
O conceito central é atuar como um **“sincronizador biológico”**, usando sinais fisiológicos e sinais subjetivos para antecipar mudanças de energia e ajudar a pessoa a se adaptar antes de um crash, aceleração ou desregulação maior.

Público-alvo claro: pessoas com TDAH, bipolaridade e mulheres em ciclo menstrual, perimenopausa ou menopausa.

## 2. Diferencial Real (Tese do Produto)

O diferencial do seu produto está em juntar referências em uma lógica única: **o planner não organiza apenas tarefas, ele reorganiza o dia conforme o estado energético e o momento do ciclo da pessoa.**
A melhor definição para o seu app é: um sincronizador de ciclo, humor e energia que entende o estado atual da pessoa e reorganiza o dia a favor dela.

Tem uma arquitetura de “dual input”: combinando wearables com input humano, para calibrar o “estado de energia”.

## 3. O que a IA de fato decide (Loop de Inteligência)

O app deve operar em um ciclo simples de quatro passos:

1. **Captar sinais** (sono, HRV, check-ins de humor/energia, conversa).
2. **Interpretar padrão**.
3. **Classificar capacidade do momento**.
4. **Sugerir o próximo melhor comportamento** ou formato de agenda.

A inteligência deve sempre responder três perguntas: “como ela está agora?”, “o que isso provavelmente significa?” e “como o dia precisa ser adaptado?”.

Regra atual de produto: **contexto antigo explica padrão; contexto de hoje decide ação**. A Airia pode usar memória longitudinal para entender recorrência, mas só deve sugerir uma tarefa quando houver âncora operacional atual: agenda pendente, hábito devido, meta ativa ou ação aceita pela usuária.

Agenda vazia não significa silêncio absoluto: a Airia pode sugerir um compromisso opcional ligado a uma meta ou intenção atual. O que ela não pode fazer é tratar sugestão como compromisso real, salvar sozinha ou notificar algo não confirmado.

Se não houver boa ação ancorada ou boa sugestão opcional, a resposta correta é explicar o padrão e não inventar tarefa.

O algoritmo operacional é o **Airia Decision Brain**:

1. **Truth Layer:** fatos reais do dia, horário local, agenda, hábitos, metas, concluídos e pendências.
2. **Memory Layer:** RAG, diário, padrões e feedback; memória explica padrão, não cria tarefa sozinha.
3. **Candidate Layer:** manter, mover, reduzir, pausar, converter, sugerir, notificar ou apenas explicar.
4. **Decision Layer:** pontua por âncora, urgência, fase, horário viável, repetição, carga e impacto em meta.
5. **Critic Layer:** bloqueia vencido, feito, rejeitado, genérico, repetido, sem base ou notificação inventada.
6. **Narrative Layer:** transforma decisão permitida em linguagem natural, script, manobra ou pedido de confirmação.

## 4. O que clonar (Estratégia de Produto)

Dos apps de referência, os três blocos valiosos:

- **Structured:** A timeline visual do dia, blocos coloridos, replanejamento fácil,Inbox, foco em uma tela principal limpa/calma. Em vez de organizar os compromissos, a timeline sugere intensidade da tarefa baseado na energia.
- **Justly:** Chat guiado com IA, resumos emocionais, memória de longo prazo, relatórios. O journal alimenta o “mapa de energia” para recalibrar o planner.
- **Splitti:** Decomposição de metas em passos menores, priorização, coach IA focado em execução. O coach atua para traduzir o estado da pessoa em plano: o que fazer agora, o que adiar, etc.

## 5. Blueprint e Estrutura do MVP (5 Módulos)

1. **Check-in rápido:** humor, energia, irritabilidade, etc em poucos toques (baixa fricção).
2. **Diário com IA:** conversa ativa, prompts guiados, resumo emocional e memória.
3. **Planner adaptativo:** timeline, tarefas, blocos de foco, replanejamento com base em energia.
4. **Integração Wearable (Fase 2):** para sono, HRV e sinais precoces (Oura, etc).
5. **Painel de Padrões/Ciclos:** gatilhos, janelas de alta/baixa, sugestões semanais.

## 6. Regras de Ouro

1. **Mínimo esforço verbal:** Nem toda pessoa consegue se narrar bem sempre; a interface deve ter opções visuais simples.
2. **Prezar pela Ação:** Sugerir ações concretas, não apenas diagnósticos bonitos.
3. **Privacidade como Valor:** Consentimento granular, minimização de dados e mapa de uso, visto como benefício do app.
4. **Suporte Comportamental:** Posicionar como organização, não como clínico/tratamento ou farmacológico. Limitando o conselho a intervenções de tempo, pausas, cognição.
5. **Não ressuscitar ação:** se a pessoa fez, excluiu, rejeitou, pulou ou agendou uma sugestão, a IA deve tratar isso como memória operacional.

## 7. Roadmap Sugerido

- **Onda 1:** Check-in + Journal + Planner manual e adaptativo por sugestão.
- **Onda 1.5:** DailyContext + feedback de ações + Decision Brain + AdaptiveAgendaEngine.
- **Onda 2:** Expansão do replanejamento adaptativo para todos os cards, notificações e diário com observabilidade.
- **Onda 3:** Wearable, previsão de ciclo e automações profundas.
