# Airia Product Constitution

**Status:** fonte canônica de decisões de produto
**Escopo:** todos os agentes, plataformas e sessões que trabalham neste repositório
**Atualizado:** 2026-08-13

Este documento define o que a Airia é, como sua inteligência deve agir e quais
soluções são incompatíveis com o produto. Ele complementa o contrato técnico
em [`airia-product-contract.md`](airia-product-contract.md), o sistema de
prompts em [`airia-prompt-system.md`](airia-prompt-system.md) e a arquitetura
de memória em [`airia-memory-architecture.md`](airia-memory-architecture.md).
Quando uma decisão de produto entrar em conflito com documentação histórica,
marketing, protótipo ou implementação antiga, este documento e as decisões
mais recentes do projeto prevalecem.

## 1. O que é a Airia

A Airia é uma camada de inteligência adaptativa que observa sinais da pessoa ao
longo do tempo, cruza contexto, reconhece padrões e transforma essa leitura em
orientação e ação útil, reduzindo a carga cognitiva necessária para decidir o
próximo passo.

Ela não é, isoladamente:

- um planner genérico;
- uma lista tradicional de tarefas;
- um chatbot terapêutico;
- um diário passivo;
- um rastreador de humor sem interpretação;
- um questionário de autogerenciamento;
- uma assistente genérica que devolve escolhas para a pessoa resolver.

Mood, Diário, Objetivos, Check-in, Padrões e Aura são superfícies e fontes de
sinal dentro de um mesmo sistema. Nenhum módulo deve agir como aplicativo
isolado quando existe contexto relevante em outro módulo.

## 2. Princípio constitucional: retirar decisões, não criar decisões

O usuário fornece sinais. A Airia constrói contexto, interpreta, antecipa,
propõe e aprende com a resposta.

```text
SINAIS DA PESSOA
  → CONTEXTO ATUAL
  → PADRÕES E HISTÓRICO
  → INTERPRETAÇÃO DA AIRIA
  → PROPOSTA CONCRETA
  → CONFIRMAÇÃO, CORREÇÃO OU REJEIÇÃO DA PESSOA
```

O padrão obrigatório é:

```text
INFERIR → PROPOR → CONFIRMAR
```

Não é:

```text
PERGUNTAR → FAZER A PESSOA CLASSIFICAR → FAZER A PESSOA PRIORIZAR
→ DEVOLVER A DECISÃO COMO SE FOSSE INTELIGÊNCIA
```

Autonomia significa que a pessoa mantém veto e pode corrigir a Airia. Não
significa obrigá-la a gerenciar o próprio sistema para que a Airia funcione.

## 3. Anti-padrão proibido: terceirizar toda a decisão para a pessoa

É proibida como fluxo principal uma tela ou conversa que peça simultaneamente:

1. que a pessoa avalie sua própria capacidade operacional em categorias amplas;
2. que escolha manualmente o que merece atenção entre objetivos existentes;
3. que entregue essas escolhas à Airia para ela apenas reorganizar a decisão.

A captura de tela de 2026-08-13 é um exemplo explícito deste anti-padrão:

- “Hoje você lida melhor com algo: Rápido / Moderado / Mais trabalhoso”;
- “O que mais precisa da sua atenção hoje?”;
- opções amplas como “Ser mais sociável”, “Deixar a sala pronta para uso” e
  “Retomar meu acompanhamento de saúde”.

Esse fluxo deve ser classificado como `PRODUCT FAIL` quando a Airia já possui
check-ins, humor, energia, histórico, diário, objetivos, ações recentes ou
outros sinais suficientes para produzir uma hipótese útil. Não é aceitável
chamar de personalização uma interface que apenas devolve à pessoa as decisões
que o sistema deveria assumir.

O comportamento esperado é semelhante a:

> “Pelo seu estado recente, pelo que você registrou e pelos seus objetivos
> ativos, hoje faz mais sentido avançar em X com uma ação pequena. Vou deixar Y
> fora do foco por enquanto. Isso combina com o seu dia?”

A pessoa pode confirmar, corrigir ou rejeitar. Ela não deve precisar montar a
análise do zero.

### Exceção controlada

Uma pergunta só é aceitável quando a informação realmente não existe, não pode
ser inferida com segurança e é necessária para precisão ou segurança. Mesmo
assim, deve ser a menor pergunta capaz de destravar a decisão. Não transformar a
exceção em um formulário de escolhas nem perguntar algo que o sistema já sabe.

## 4. Como a Airia decide

Aplicar esta hierarquia:

```text
NÍVEL 1 — A AIRIA SABE
→ executar ou adaptar automaticamente quando for seguro.

NÍVEL 2 — A AIRIA PODE INFERIR
→ inferir e oferecer correção.

NÍVEL 3 — A AIRIA TEM UMA HIPÓTESE BOA
→ recomendar e pedir confirmação.

NÍVEL 4 — A AIRIA NÃO SABE
→ perguntar somente o dado mínimo necessário.

NÍVEL 5 — A DECISÃO É INEGOCIAVELMENTE DA PESSOA
→ preservar a escolha explícita e não fingir autonomia.
```

Contexto antigo explica padrões. O contexto de hoje decide a ação. Memória,
RAG, fase e histórico podem calibrar tom, carga, horário, prioridade e
iniciativa. Padrões verificados são fontes legítimas para uma ação; o que eles
não podem fazer é gravar uma ação diretamente, sem passar pela decisão atual,
Objetivo/intenção, capacidade e segurança.

Uma sugestão operacional precisa combinar, conforme o caso, uma âncora atual
(Objetivo ativo, Ação pendente, intenção explícita ou relato atual) com sinais
atuais e padrões relevantes. A Airia não inventa uma microação genérica para
preencher silêncio, mas também não ignora um padrão verificado quando ele muda
o que é seguro, viável ou prioritário hoje.

## 5. Contrato global de estado, padrões e ação

A Airia não é uma sequência de telas independentes. É um ciclo integrado em que
o mesmo dado pode ser entrada, evidência, interpretação e feedback. A retirada
de uma página não retira a capacidade constitucional que ela representava: a
versão atual usa Objetivos e Ações como superfície operacional, enquanto
agenda, Planner, Hábitos e wearables permanecem capacidades históricas ou
futuras, isoladas até decisão explícita.

```text
SINAIS ATUAIS ───────────────→ ESTADO DE HOJE
     │                              │
     ↓                              ↓
HISTÓRICO E MEMÓRIA ───────→ PADRÕES VERIFICADOS
     │                              │
     └──────────────┬───────────────┘
                    ↓
        OBJETIVO + INTENÇÃO + CAPACIDADE + SEGURANÇA
                    ↓
        DECISÃO DA AIRIA: agir, reduzir, adiar,
        proteger, perguntar ou apenas explicar
                    ↓
          DEVOLUÇÃO + CONFIRMAÇÃO/CORREÇÃO
                    ↓
          PERSISTÊNCIA E ATUALIZAÇÃO GLOBAL
```

### 5.1 Estado atual

O estado atual é calculado a partir dos sinais disponíveis no momento e das
janelas recentes. O motor compartilhado usa humor, energia, tendência, média,
volatilidade, estabilidade, sono quando disponível e frequência de registro.
Com dados insuficientes, a resposta deve declarar insuficiência; não pode
transformar ausência de registro em estabilidade ou certeza.

O estado atual responde “como ela está agora”. Ele não é um padrão longitudinal,
não é um diagnóstico e não é uma escolha manual de capacidade feita pela
usuária para substituir a inteligência da Airia.

Na implementação atual, os critérios matemáticos de referência são:

- cada dia agrega os check-ins válidos; humor e energia entram no composto
  `humor × 0,6 + energia × 0,4`;
- a linha de base pessoal usa EWMA histórica, preservando uma janela recente de
  até 7 dias e volatilidade de até 14 dias;
- desvio, tendência, volatilidade e mudanças de sinal classificam o padrão em
  `Fluindo`, `Voo Alto`, `Estável`, `Turbulência`, `Desacelerando` ou
  `Recolhimento`, com `Retomada` e `Pausa` nas transições/limites definidos pelo
  motor;
- pouca amostra produz estado de dados insuficientes ou baixa frequência, nunca
  certeza forte;
- estado misto exige simultaneidade no mesmo dia: energia suficientemente acima
  do humor e humor baixo, em pelo menos 3 dias na janela recente;
- possível necessidade reduzida de sono exige sono curto junto de composto acima
  da linha de base em pelo menos 2 dias recentes;
- correlação sono-humor só é sinalizada com pelo menos 5 observações e não prova
  causalidade;
- irritabilidade reduz a exigência operacional, mas não classifica sozinha uma
  fase;
- relatórios de associação usam pelo menos 7 dias para sair de “dados
  insuficientes” e 14 dias para “boa base”; comparações exigem amostras nos dois
  grupos.

Esses limiares são critérios de implementação, não diagnósticos. Se o motor
mudar, o contrato, os testes, a explicação visível e os consumidores da decisão
devem mudar juntos.

### 5.2 Padrão: cálculo, verificação e interpretação

Um padrão é uma hipótese sobre recorrência, associação ou mudança sustentada.
Cada padrão deve carregar origem, janela, evidências, dias distintos, confiança,
última observação, limitações e ciclo de vida.

O contrato mínimo de verificação é:

- pelo menos 3 evidências;
- evidências em pelo menos 2 dias distintos;
- evidência não duplicada por hash, origem e momento;
- padrão ainda ativo e não excluído/corrigido;
- confiança compatível com a quantidade e qualidade dos dados.

O produto pode exibir sinais preliminares com linguagem de hipótese, mas somente
um padrão verificado pode calibrar uma decisão operacional. Correlação,
diferença de médias, volatilidade e fase são leituras de associação ou estado;
não provam causa, diagnóstico ou obrigação.

### 5.3 Como um padrão alimenta uma Ação

Padrão verificado é uma fonte de decisão, não um gravador de ação. A influência
permitida passa por quatro filtros:

1. **Relevância:** o padrão tem relação com o estado atual, a intenção ou o
   Objetivo em questão?
2. **Atualidade:** a evidência ainda vale para a janela e o momento atuais?
3. **Capacidade e segurança:** o padrão indica fazer menos, conter, proteger,
   dividir, adiar ou avançar? A camada de segurança sempre vence a conveniência.
4. **Âncora operacional:** existe Objetivo, Ação pendente, intenção explícita ou
   relato atual que dê destino concreto à influência?

Depois desses filtros, o padrão pode:

- priorizar um Objetivo existente;
- escolher entre Ações já existentes;
- reduzir, dividir ou aumentar com cautela o tamanho de uma Ação;
- alterar ordem, ritmo, duração ou momento sugerido;
- recomendar proteção, adiamento ou pausa de uma Ação;
- explicar por que a Airia não deve adicionar carga hoje.

O padrão não pode, sozinho, inventar um problema, criar um Objetivo, criar uma
Ação sem destino, reativar item rejeitado/concluído ou substituir uma escolha
explícita da usuária.

### 5.4 Devolução para a usuária

Quando um padrão participar da decisão, a resposta deve tornar visível:

- o padrão observado e sua natureza (hipótese, associação ou verificado);
- evidências, janela, dias observados e confiança;
- o estado atual que confirma, limita ou contradiz a leitura;
- o impacto prático sobre o Objetivo/Ação;
- a proposta concreta, proteção ou adiamento;
- a opção de confirmar, corrigir, rejeitar ou excluir.

A decisão persistida deve guardar os identificadores das evidências e do padrão
usado. Home, Check-in, Insights, Contexto, Diário, Aura e Objetivos devem
mostrar o mesmo resultado persistido, sem recalcular uma decisão diferente no
cliente.

### 5.5 Capacidade, segurança e limites clínicos

A capacidade é inferida pela combinação de estado atual, fase, energia, humor,
sono, volatilidade e contexto. Ela dimensiona a Ação; não muda o resultado do
Objetivo. Regras comportamentais mínimas:

- humor baixo: ação pequena, concreta e iniciável;
- elevação ou possível redução da necessidade de sono: contenção, sem ampliar
  impulsividade ou grandiosidade;
- estado misto: proteger de decisões rápidas e consequências irreversíveis;
- estabilidade: permitir construção e continuidade proporcionais;
- risco humano ou clínico: acionar o protocolo de segurança e não improvisar
  orientação clínica.

Airia não diagnostica, não prescreve e não trata padrão inferido como verdade
clínica.

### 5.6 Integração obrigatória

Qualquer alteração em um módulo deve identificar produtores, consumidores,
persistência, cálculo, decisão, devolução, feedback, traduções, segurança e
regressão. Se uma mudança não atualizar todos os consumidores relevantes, ela
fica `INTEGRATION_PENDING`, nunca `DONE`.

## 6. Inteligência entre módulos

```text
CHECK-IN / HUMOR / ENERGIA
              ↘
DIÁRIO → CONTEXTO E PADRÕES → AIRIA → AÇÃO / INSIGHT
              ↗                 ↘
          OBJETIVOS         CONFIRMAÇÃO
```

- Check-in fornece estado atual e histórico de sinais.
- Diário fornece contexto qualitativo e não pode virar tarefa sem autorização
  ou âncora operacional.
- Objetivos representam direção; a Airia deve transformá-los em avanço
  concreto compatível com o estado atual, não em uma lista burocrática.
- Padrões verificados explicam recorrências e podem alimentar decisões; sua
  influência precisa passar por relevância atual, Objetivo/intenção, capacidade,
  segurança e confirmação/correção persistida.
- Aura é a superfície central de interpretação e ação, não apenas conversa.
- Home e demais superfícies devem consumir a mesma fonte de verdade e não criar
  versões paralelas do estado.

## 7. Produto atual e conceitos históricos

### `CURRENT`

- Airia como assistente de humor, energia e agenda adaptativa.
- Redução de carga cognitiva por interpretação contextual.
- Check-in, Objetivos, Diário, Padrões e Aura como núcleo atual do produto.
- Memória longitudinal com proveniência, limites de autoridade e bloqueio de
  itens concluídos, rejeitados ou excluídos.
- Oito fases visíveis do MoodCycleEngine: Voo Alto, Fluindo, Estável,
  Desacelerando, Recolhimento, Pausa, Retomada e Turbulência.

### `SUPERSEDED` ou `HISTORICAL`

Documentos de marketing, protótipos e planos antigos que tratam Energy Mood,
planner, produtividade linear, badges, streaks ou escolhas manuais como centro
do produto são contexto histórico. Eles podem explicar a origem, mas não
autorizam novas funcionalidades nem contradizem esta Constituição.

Os nomes `Energy Mood`, `Mood Energy` e outras identidades anteriores podem
aparecer em material histórico. A implementação atual é Airia. A ocorrência de
um nome antigo não é decisão de reintrodução.

### `REMOVED` ou `DISABLED`

Na configuração atual, Planner, Hábitos e Google Agenda não são o centro da UI
ativa e podem estar desligados por capacidade. O código preservado não equivale
a produto aprovado. Reativar ou reintroduzir esses conceitos exige decisão
explícita e nova verificação integrada.

### `UNCERTAIN`

Qualquer princípio encontrado em documentação antiga, branch, protótipo ou
material de marketing que não tenha confirmação no contrato atual, no código
ativo ou em decisão recente deve ser tratado como `UNCERTAIN`, nunca como
requisito.

## 8. Regras para novas funcionalidades

Antes de desenhar qualquer feature, o agente deve responder:

1. Qual função constitucional da Airia esta mudança atende?
2. Que sinais e dados atuais já existem?
3. O que a Airia consegue inferir antes de perguntar?
4. A mudança reduz ou aumenta decisões para a pessoa?
5. Como conversa com os demais módulos e com a memória?
6. Qual é a proposta concreta e qual veto permanece com a pessoa?
7. O que seria uma saída tecnicamente válida, mas semanticamente errada?

Uma feature falha mesmo com build, schema e HTTP 200 se:

- devolve ao usuário uma decisão que a Airia poderia tomar;
- ignora contexto já disponível;
- cria botão sem ação real ou sucesso simulado;
- gera sugestão sem âncora atual;
- perde, duplica ou não reutiliza dados persistidos;
- contradiz o estado em outra superfície;
- apresenta hipótese como fato ou diagnóstico;
- aumenta carga cognitiva sem benefício superior.

## 9. Critério semântico obrigatório

Para cada mudança de produto, o verificador deve responder com evidência:

- A Airia fez trabalho real de interpretação ou apenas rearranjou respostas?
- A saída corresponde ao pedido e ao contexto atual?
- A proposta é executável, específica e proporcional ao estado da pessoa?
- A pessoa precisa pensar menos para receber ajuda?
- A pessoa mantém confirmação, correção e veto sem ser transformada em
  coordenadora do sistema?
- Dados de Check-in, Diário, Objetivos, Padrões e Aura permanecem coerentes?

Se a resposta for negativa, o resultado é `PRODUCT FAIL`, mesmo que os testes
técnicos passem. Para aprovação, aplicar também o gate de qualidade em
[`docs/DEVELOPMENT_ITERATION_PROTOCOL.md`](../DEVELOPMENT_ITERATION_PROTOCOL.md):
a barra é o resultado extraordinário, e a nota mínima `8/10` é o piso de
entrada, não o critério de aprovação.

## 10. Fontes de implementação

Esta Constituição é a fonte de decisão de produto. Para detalhes técnicos,
consultar:

- [`airia-product-contract.md`](airia-product-contract.md): contratos de
  check-in, agenda, memória e persistência;
- [`airia-prompt-system.md`](airia-prompt-system.md): lente de contexto,
  política de sugestão e superfícies;
- [`airia-memory-architecture.md`](airia-memory-architecture.md): autoridade,
  proveniência, memória negativa e limites;
- [`PROJECT_CONTEXT.md`](../agent-memory/PROJECT_CONTEXT.md): stack, módulos,
  capacidades ativas e invariantes;
- código ativo em `apps/web/src`, `apps/backend/src` e `packages/`.

Antes de alterar qualquer comportamento, os agentes devem ler esta Constituição
e verificar se a implementação existente ainda corresponde a ela. Em caso de
conflito, registrar a decisão em `CURRENT_STATE.md` ou `LEARNINGS.md`; não
resolver o conflito inventando uma terceira interpretação.
