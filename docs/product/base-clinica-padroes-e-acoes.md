# Base clínica — leitura de padrões e escolha de ações

Fonte: caderno NotebookLM "Clinical Assessment and Management of ADHD and Bipolar
Comorbidity" (10 fontes: ASRS-v1.1, MDQ, Rapid Mood Screener, TCC para transtorno
ciclotímico, exposição e flexibilidade cognitiva, comorbidade TDAH-bipolar,
modelos matemáticos da dinâmica do humor, ciclagem rápida × ciclotimia).

Este documento existe para **fundamentar duas coisas**: como o motor lê padrão, e
o que a Airia pode sugerir em cada estado. Não é material clínico para a usuária e
não deve virar texto de tela — o app não diagnostica. É a régua interna.

---

## 1. O instrumento que descreve o que o app faz

O padrão-ouro para automonitoramento longitudinal de humor é o **NIMH-LCM-S/P**
(Life Chart Method), preenchido **diariamente**. Ele registra: gravidade do humor
em 4 níveis, **horas de sono**, medicação, ciclo menstrual, e o **impacto de
eventos de vida numa escala de −4 a +4** (0 = neutro).

ASRS-v1.1 e MDQ são instrumentos de **triagem**, não de acompanhamento. ASRS
pergunta sobre os últimos 6 meses; reaplicar diariamente não faz sentido e
invalida a escala. Se algum dia forem usados, é uma vez, no onboarding — nunca no
check-in diário.

**O que o app já tem:** registro diário de humor, energia, sono (horas e
qualidade), medicação, ciclo menstrual, fatores. Isso cobre a maior parte do
LCM.

**O que falta:** intensidade com sinal nos fatores. Hoje os 35 fatores são
binários e classificados em `positive`/`negative`. O LCM pede magnitude de −4 a
+4. Sem isso, "briga séria" e "trânsito ruim" pesam igual.

### Pontos de corte, se algum dia forem usados

- **ASRS-v1.1 Parte A** (6 itens, escala de 5 pontos): itens 1–3 pontuam com
  "Às vezes", "Frequentemente" ou "Muito frequentemente"; itens 4–6 pontuam só
  com "Frequentemente" ou "Muito frequentemente". **Corte: 4 ou mais.**
- **MDQ**: positivo exige os **três** critérios juntos — ≥7 dos 13 itens, os
  sintomas no **mesmo período**, e prejuízo funcional **moderado ou grave**.
  Marcar 7 itens sem simultaneidade não é positivo.

---

## 2. Distinguir desregulação de TDAH de episódio bipolar

Este é o problema de precisão central do app, e a distinção é computável.

| Eixo | Desregulação do TDAH | Episódio bipolar |
|---|---|---|
| Curso | Crônico, **não episódico** | Episódico |
| Gatilho | **Reativo** a estímulo emocional negativo | **Autônomo** |
| Duração | Oscilação curta, ligada ao evento | 1–3 dias (fenótipo intermediário) ou duração clássica |
| Retorno ao basal | Rápido, quando o gatilho passa | Independe do gatilho |

**Os cinco marcadores que discriminam mania/hipomania:** humor elevado,
grandiosidade, pensamento acelerado, **diminuição da necessidade de sono** e
hipersexualidade.

**O que NÃO discrimina** — e o app não deve tratar como sinal: irritabilidade,
fala acelerada, distratibilidade e **aumento de energia isolado**. Todos são
comuns aos dois quadros.

### Como o app pode calcular a distinção reativo × autônomo

O check-in já registra fatores junto com humor e energia. Então:

- queda de humor **acompanhada** de fator negativo marcado → reativa;
- queda de humor **sem nenhum fator** marcado → autônoma.

A proporção autônoma/reativa ao longo de semanas é um sinal de fenótipo, e hoje
o motor não olha para isso. Nenhum dado novo é necessário.

---

## 3. Estado misto — a falha de detecção atual

A literatura define estado misto como elementos dos **polos opostos presentes ao
mesmo tempo**: humor deprimido com alta energia e agitação. A característica
central é a **simultaneidade** — é o que separa estado misto de ciclagem rápida,
e as pessoas confundem os dois.

**O motor hoje não detecta isso.** `weightedComposite` colapsa humor e energia
num número só (`humor*0.6 + energia*0.4`). Humor 2 com energia 8 dá composto 4,4
— lido como intermediário, invisível. E a fase `mixed` ("Turbulência") é
definida por **volatilidade de 14 dias** ([mood-cycle-engine.ts:788](apps/web/src/utils/mood-cycle-engine.ts:788)),
não por divergência entre humor e energia no mesmo dia.

Ou seja: o app registra humor e energia separadamente — tem exatamente o dado
necessário — e depois joga a informação fora na hora de ler.

**Correção:** calcular a divergência `energia − humor` por dia. Divergência alta
e sustentada, com humor abaixo do baseline, é estado misto. Isso vale sem
nenhuma coluna nova.

O app já tem `dayType: 'mixed'` como autorrelato no check-in. O autorrelato pode
confirmar, mas não pode ser a única fonte — a pessoa em estado misto é
justamente quem tem menos clareza para se classificar.

---

## 4. Hipomania e a inversão do sinal de sono

O marcador fundamental de hipomania incipiente é a **diminuição da necessidade
de sono** — sentir-se descansado com poucas horas. Não é dormir pouco. É dormir
pouco **e estar bem**.

**Hoje o app trata isso ao contrário.** O fator `slept_little` ("Dormi pouco
(<6h)") está classificado como `negative` ([checkin-page.tsx:33](apps/web/src/routes/checkin-page.tsx:33)).
Quem está subindo para hipomania dorme 4h, acorda ótimo, e o app conta isso como
fator negativo — some no cálculo em vez de acender alerta.

**Correção:** poucas horas de sono **com** humor e energia acima do baseline não
é privação de sono, é redução da necessidade de sono. O sinal muda de negativo
para alerta de elevação. Poucas horas **com** humor baixo continua sendo
privação.

Distinguir "dia bom" de hipomania exige, além do humor elevado: duração de 1–3
dias no mínimo, e pelo menos um dos marcadores obrigatórios — grandiosidade,
pensamento acelerado ou redução da necessidade de sono. Humor alto sozinho é
só um dia bom, e o app não deve alarmar.

---

## 5. Parâmetros de ciclagem

- **Ciclagem rápida:** ≥ 4 episódios de humor em 12 meses.
- **Ciclagem ultrarrápida:** ciclos de dias a semanas, incluindo 48 horas.
- **Ciclagem ultradiana:** ciclos dentro de 24 horas; pode passar de 365 por ano.
- **Ciclotimia:** oscilação por ≥ 2 anos, **sem período estável maior que 2
  meses**. O critério é a ausência de estabilidade prolongada, não a amplitude.

O último ponto reforça a correção que já entrou no motor: estabilidade num nível
baixo não é equilíbrio. Na ciclotimia, estabilidade longa é justamente o que não
acontece — então um platô estável merece leitura, não silêncio.

---

## 6. O que sugerir, por estado

A regra que atravessa tudo: **a sugestão nasce do estado, e o estado limita o
tamanho.**

### Humor baixo — ativação comportamental

Reduzir comportamento de esquiva e propor ação adaptativa. A escolha da
atividade privilegia autocuidado e atividade prazerosa. O tamanho inicial é
pequeno o bastante para ser concluído — o objetivo é o ato de começar, não o
resultado.

**Não sugerir:** tarefa complexa que exija organização alta, especialmente se a
pessoa relata dificuldade de colocar as coisas em ordem. E nunca reforçar
isolamento nem a leitura de que "nada adianta".

### Humor elevado ou hipomania incipiente — contenção

A conduta é **desacelerar de propósito**, não aproveitar o embalo. Adiar ações
movidas por impulsividade e por grandiosidade — crença em habilidades que não se
sustentam fora daquele estado.

**Não sugerir:** meta ambiciosa, compromisso novo de alto custo, nada que
estimule grandiosidade ou comportamento de risco. Elevar mais quem já está
elevado é contraproducente antes de estabilizar.

Este é o ponto onde a Airia mais erra hoje: fase alta parece o momento perfeito
para propor coisa grande, e é exatamente o contrário.

### Estado misto — proteger de decisão

Há agitação e humor deprimido ao mesmo tempo. **Não sugerir** nada que exija
decisão rápida ou que possa aumentar irritabilidade. Ação de baixa exigência
cognitiva e sem consequência irreversível.

### Estabilidade — construir

É a única fase em que meta de médio prazo e sequência fazem sentido, porque há
previsibilidade para sustentar.

---

## 7. Técnicas que viram micro-ação

Da TCC para ciclotimia, traduzidas em passo prático:

- **Mapeamento de gatilho** — registro diário para identificar o que precede a
  oscilação. É o que o check-in já faz; falta devolver o padrão encontrado.
- **Questionamento de pensamento** — ao detectar distorção ("posso fazer tudo
  agora" na fase alta, "nada adianta" na baixa), a ação é **escrever** a
  substituição realista. Micro-ação de 2 minutos, cabe no diário.
- **Comunicação assertiva** — praticar em situação concreta que a pessoa citou.
- **Manejo de crise** — ao primeiro sinal de desestabilização, desacelerar de
  propósito. A ação é reduzir, não adicionar.

Da exposição graduada: montar escada do menos para o mais evitado, um degrau por
vez, substituindo resposta de esquiva por resposta adaptativa. Traduz direto para
a decomposição de objetivo que o app já faz — a diferença é ordenar por
dificuldade percebida, não por ordem lógica da tarefa.

Regularidade de sono e alimentação aparece como estabilizador fundamental. Vale
como objetivo de rotina, não como cobrança diária.

---

## 8. Limites que o app não atravessa

- **Não diagnostica.** Nenhum texto de tela pode nomear transtorno. As flags do
  motor são internas e servem para calibrar tom e tamanho de sugestão.
- **Não fala de medicação.** As fontes registram que psicoestimulante ou
  antidepressivo sem estabilizador pode causar virada maníaca. Isso é decisão
  clínica — o app registra que houve uso, e para por aí.
- **Autorrelato não é escala validada.** Os campos do check-in não somam
  pontuação diagnóstica.

---

## 9. Lacunas das fontes

Duas coisas que o caderno não entrega e que ficam em aberto:

- **Rapid Mood Screener**: a fonte tem só metadados de navegação, sem os itens
  nem os pontos de corte.
- **Modelos matemáticos da dinâmica do humor**: as fontes citam o uso de
  parâmetros de oscilador para fenotipar indivíduos, mas os excertos disponíveis
  retornaram erro de acesso. Não há valores de amortecimento ou ruído para
  implementar.

Se esses dois virarem prioridade, precisam de fonte nova no caderno.
