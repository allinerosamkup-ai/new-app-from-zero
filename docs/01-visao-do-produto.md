# Documento 1 — Visão do Produto

> **Status:** visão fundadora ainda válida para a essência da Airia. O app
> ativo atualmente usa Check-in, Objetivos, Ações, Diário, Padrões e Aura; as
> superfícies de Planner, Hábitos e integrações biométricas permanecem
> preservadas, adiadas ou desligadas conforme a configuração. Consulte a
> [`PRODUCT_CONSTITUTION.md`](product/PRODUCT_CONSTITUTION.md) para o contrato
> atual.

## 1. Nome provisório

Nome de trabalho: app de gestão de ciclagem de humor e energia psíquica.
Observação: o nome final da marca será definido depois. Neste momento, o foco é alinhar visão, lógica de produto e direção técnica.

## 2. Definição do produto

Este produto é um aplicativo de inteligência adaptativa para ajudar pessoas a reconhecer, interpretar e equilibrar oscilações de humor, energia psíquica e capacidade funcional ao longo do tempo.

O app deve funcionar como um sincronizador entre sinais biométricos, autorrelato emocional e organização prática da rotina, transformando dados em ações úteis para a própria pessoa.

A proposta não é ser apenas um planner, um diário emocional ou um app de produtividade, mas unir essas camadas em um único sistema de suporte cotidiano.

## 3. Tese central

O diferencial do produto não está em ter muitas features, e sim em usar dados a favor do usuário, no momento certo, para ampliar autonomia, clareza e capacidade de ação no dia a dia.

A inteligência do app deve captar sinais precoces de mudança de energia e reorganizar o cotidiano antes que a pessoa entre em queda, desregulação ou sobrecarga.

A lógica central é converter telemetria biométrica, padrões emocionais e contexto de rotina em intervenções comportamentais práticas.

## 4. Problema que o app resolve

Muitas pessoas convivem com variações relevantes de humor, energia, sono e regulação ao longo do tempo, mas não dispõem de uma ferramenta que traduza essas oscilações em orientação concreta para a vida diária.

Os planners tradicionais ajudam a organizar tarefas, mas não adaptam a agenda ao estado interno da pessoa.

Os apps de journaling com IA ajudam a refletir emocionalmente, mas não necessariamente transformam essa leitura em organização adaptativa do dia.

Os apps de produtividade com IA ajudam a decompor metas e sugerir foco, mas tendem a priorizar execução sem uma leitura profunda de ciclagem de humor e energia psíquica.

## 5. Público principal

O produto é pensado para pessoas que vivem oscilações de energia, humor, foco e regulação, especialmente em contextos como TDAH, bipolaridade, ciclo menstrual, perimenopausa e menopausa.

Ele também deve servir a usuários que não querem se definir por um diagnóstico, mas que percebem padrões recorrentes de aceleração, exaustão, irritabilidade, baixa energia, instabilidade ou sobrecarga.

O app deve acolher tanto perfis mais verbais quanto pessoas que têm dificuldade de nomear o que sentem, oferecendo entrada por toque, escalas simples, linguagem guiada e interação conversacional.

## 6. Proposta de valor

O app ajuda a pessoa a responder três perguntas de forma contínua:

- Como estou agora?
- O que isso significa no meu ciclo de humor e energia?
- Como meu dia deve ser ajustado a partir disso?

A resposta do app deve ser prática e acionável, não apenas analítica.
O produto deve ajudar a pessoa a reconhecer padrões, prevenir quedas, respeitar limites, reorganizar tarefas e aumentar autonomia funcional.

## 7. Princípios do produto

**7.1 IA no centro**
Todo o app será construído com inteligência artificial como camada estrutural, e não como recurso extra.
A IA não deve atuar só como chat, mas como motor de interpretação, adaptação e recomendação do produto inteiro.

**7.2 Dupla leitura de dados**
A lógica central do sistema deve combinar dois tipos de entrada: dados fisiológicos e dados subjetivos.
O framework do projeto define explicitamente uma arquitetura de “dual input”, unindo telemetria de wearables com sentimento humano para calibrar o estado de energia do usuário.

**7.3 Baixa fricção**
O app deve funcionar mesmo quando a pessoa estiver cansada, desorganizada, irritada, sem clareza mental ou sem vontade de escrever.
Por isso, o produto deve priorizar check-ins rápidos, escolhas por toque, prompts guiados e automação inteligente.

**7.4 Ação antes de excesso de análise**
O sistema não deve devolver só diagnóstico bonito ou gráficos sofisticados.
Ele precisa transformar leitura de estado em decisão prática: o que fazer, o que adiar, o que simplificar, o que priorizar e como proteger a energia do dia.

**7.5 Privacidade como valor do produto**
O framework exige consentimento granular, minimização de dados, criptografia ponta a ponta e um mapa visual mostrando onde os dados são usados e por quais módulos de IA.
Portanto, privacidade não será só obrigação jurídica; será parte da proposta de valor do app.

## 8. O que o produto é

- Um sistema de leitura de estado interno.
- Um diário guiado por IA com memória e interpretação.
- Um planner adaptativo orientado por energia.
- Um painel de padrões, ciclos e gatilhos.
- Um assistente de reorganização da rotina com base em capacidade real.

## 9. O que o produto não é

- Não é apenas um planner de produtividade.
- Não é apenas um diário emocional.
- Não é apenas um chatbot terapêutico.
- Não é um app farmacológico, nutricional ou de suplementação, porque o framework exclui intervenções nutricionais, herbais e farmacológicas.
- Não é um substituto de tratamento clínico.

## 10. DNA de clonagem

Este produto deve ser construído com base em clonagem e adaptação de padrões já validados, em vez de ser desenhado do zero sem referências.

Os documentos de referência mostram que os apps analisados oferecem padrões já testados de timeline, journaling guiado, decomposição de tarefas, relatórios, tracking de humor e IA aplicada à organização.
Também mostram que, em vários casos, o código oficial não é público, então a estratégia correta é replicar arquitetura, fluxos e componentes a partir de referências open source compatíveis.

**10.1 O que clonar do Structured**
Clonar a lógica de planner visual com timeline vertical, blocos por horário, replanejamento simples, Inbox, rotinas, subtarefas e foco em uma tela principal forte.
Clonar também a ideia de usar AI para montar agenda por linguagem natural e reprogramar tarefas não concluídas.
Adaptar tudo isso para uma agenda orientada por energia psíquica e ciclagem, e não apenas por produtividade.

**10.2 O que clonar do Justly**
Clonar a lógica de journaling guiado com IA, entrada por texto e áudio, resumos emocionais, detecção de padrões, relatórios semanais e memória de longo prazo.
Clonar a suavidade da experiência, o estilo conversacional e a baixa fricção da sessão guiada.
Adaptar o journal para alimentar o mapa de energia e recalibrar o planner.

**10.3 O que clonar do Splitti**
Clonar a decomposição de metas, o raciocínio de priorização, o coach de IA, os check-ins rápidos e a transformação de objetivos em plano executável.
Clonar a lógica de tornar o apoio da IA mais funcional e menos contemplativo.
Adaptar isso para respeitar capacidade do momento, energia e fase de ciclo, e não apenas urgência e produtividade.

## 11. Diretriz técnica de código

A diretriz técnica oficial deste projeto é: clonar e adaptar código validado sempre que possível.
O objetivo não é criar tudo do zero, e sim acelerar desenvolvimento, reduzir risco e aproveitar padrões já testados em UX, arquitetura e organização de funcionalidades.

**11.1 Estratégia oficial**

- Priorizar bases open source que já resolvem timeline, planner, hábitos, tracking, IA conversacional e priorização.
- Reaproveitar padrões de arquitetura, estrutura de pastas, modelagem de dados, componentes de interface e fluxos de uso.
- Adaptar essas bases ao motor próprio do app: leitura de estado, energia psíquica, ciclo e reorganização diária.
- Evitar construir componentes maduros do zero quando já existirem referências estáveis e clonáveis.

**11.2 Referências de clonagem**

- Para planner/timeline: karolkawski/Structure-planner, Daily Planner Web, TimePlanner.
- Para hábitos/tracking: Loop Habit Tracker, Habo, OpenHabitTracker.
- Para IA + gestão de tarefas: AI Task Management Agent, projetos da matriz de Eisenhower.

**11.3 Regra de desenvolvimento**
Sempre que houver escolha entre “inventar um componente do zero” e “clonar um padrão validado e adaptar ao contexto do produto”, a segunda opção deve ser priorizada. A inovação principal do app não está no componente isolado, mas na inteligência que conecta todos eles.

## 12. Núcleos funcionais do produto

O produto nasce com quatro núcleos.

**12.1 Núcleo 1 — Estado atual**
Este núcleo reúne sinais fisiológicos, humor, energia percebida, contexto e comportamento recente para classificar o estado funcional da pessoa.
O framework prioriza temperatura, sono com foco em REM, HRV, regularidade de atividade e input manual de energia.

**12.2 Núcleo 2 — Diário com IA**
Este núcleo conduz check-ins, conversas guiadas, escuta ativa, resumos, detecção de emoções, temas recorrentes e memória longitudinal.
Ele é inspirado na lógica de journaling guiado e relatórios semanais das referências analisadas.
