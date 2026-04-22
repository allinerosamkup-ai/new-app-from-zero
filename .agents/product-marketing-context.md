# Contexto de Marketing — Energy Mood (IA: Airia)

*Última atualização: 2026-04-17*

---

## 1. Product Overview

**One-liner:** "Um lugar seguro para sua mente aterrissar."

**What it does:** Energy Mood é um copiloto de ciclagem de humor para mentes que não são lineares. Ele lê seus check-ins diários, detecta em que fase do seu ciclo emocional você está (elevada, fluindo, estável, caindo, baixa, esgotada, recuperando, mista), e sincroniza o planner, o diário e as sugestões da IA Airia com essa fase — em vez de cobrar produtividade constante.

**Product category:** App de bem-estar emocional com bio-sincronia + planner adaptativo. Na cabeça do usuário, concorre com "app de humor", "diário com IA" e "planner para TDAH".

**Product type:** SaaS mobile-first (PWA iOS + APK Android + Web).

**Business model:** Freemium com assinatura premium.
- **Free:** check-in diário, Mood Cycle Engine básico, 1 conversa/dia com Airia.
- **Premium (planejado):** conversas ilimitadas, voz da Airia via ElevenLabs, insights avançados, sincronização com ciclo menstrual, planner GTD completo. Preço-alvo: R$ 29/mês ou R$ 249/ano.

---

## 2. Target Audience

**Target users (B2C):** adultos 25-45, neurodivergentes de alta performance (TDAH, ciclotimia, depressão recorrente, bipolar tipo II), mulheres em fase reprodutiva (ciclo menstrual como modulador), criativos, fundadoras solo, pessoas em terapia ou pós-burnout.

**Primary use case:** "Preciso de um lugar que entenda que hoje eu não consigo render igual ontem — e me ajude a aterrissar sem me cobrar."

**Jobs to be done:**
1. **Prever** quando vou cair antes de cair (bio-previsibilidade).
2. **Aterrissar** quando já caí, sem julgamento.
3. **Organizar** o dia respeitando a energia real, não a ideal.

**Use cases:**
- Check-in matinal de 30s antes de abrir o trabalho.
- Diário noturno conversando com a Airia sobre o que pesou.
- Planner adaptativo: tarefas com badge de energia (alta/média/leve).
- Revisão semanal de padrões (fase do ciclo × produtividade).
- Detecção de risco hipomaníaco ou esgotamento antes do colapso.

---

## 3. Personas

B2C, foco individual. Três arquétipos centrais:

| Persona | Cuida de | Desafio | Valor que prometemos |
|---------|----------|---------|----------------------|
| **Criativa Esgotada** (30-40, freelancer/fundadora) | Entregar sem quebrar | Oscila entre hiperfoco e colapso, culpa nos dias baixos | "Ritmo respeitado — não corrigido" |
| **Neurodivergente Audaciosa** (25-38, TDAH/ciclotímica) | Usar os picos sem afundar nos vales | Nenhum app entende que o vale faz parte | "A Airia valida o vale, não só o pico" |
| **Buscadora de Ritmo** (28-45, pós-terapia) | Autoconhecimento prático | Cansou de biohacking frio + terapia cara | "Um diário que responde com sabedoria" |

---

## 4. Problems & Pain Points

**Core problem:** "Meu humor oscila e eu não consigo prever. Quando cai, eu me culpo. Quando sobe, eu me sabotando com excesso."

**Why alternatives fall short:**
- Apps de humor (Daylio, Bearable): só tracker — registram mas não agem.
- Planners (Notion, Todoist): assumem que você rende igual todo dia.
- Meditação (Calm, Headspace): lindo, mas genérico — não sabe quem você é hoje.
- Terapia: insubstituível, mas cara e semanal — e a crise é hoje às 15h.

**What it costs them:**
- Dias perdidos em culpa e paralisia.
- Relações desgastadas por "sumidas" sem explicação.
- Projetos sabotados por ciclos de hiperfoco → crash.
- Dinheiro em apps e cursos que não enxergam o padrão completo.

**Emotional tension:** vergonha de ser "instável", medo de não conseguir manter a performance, solidão no vale, euforia ansiosa no pico.

---

## 5. Competitive Landscape

**Direct (mesma solução, mesmo problema):**
- **Daylio** — bonito, simples, mas só registra. Sem IA, sem ação, sem ciclagem. Falha em *aterrissar*.
- **Bearable** — tracker robusto com sintomas + humor, mas clínico e frio. Parece planilha médica. Falha em *acolher*.
- **Finch** — gamificação fofa com pet, mas infantiliza. Falha em *sofisticação editorial*.
- **Moodpath / Youper** — chatbots terapêuticos, roteiros rígidos. Falha em *presença real* (não lembra de você).

**Secondary (solução diferente, mesmo problema):**
- **Notion/Todoist** — planner customizável, mas exige que VOCÊ se adapte ao sistema. Falha em *ritmo dinâmico*.
- **Calm/Headspace** — meditação premium, conteúdo enlatado. Falha em *personalização real*.
- **Journal apps (Day One)** — diário puro sem inteligência. Falha em *resposta que entende*.

**Indirect (caminhos concorrentes):**
- **Terapia presencial/online (BetterHelp, Zenklub)** — insubstituível no longo prazo, mas cara e episódica. Complementar, não concorrente direto.
- **Planilha no Google Sheets** — DIY que muitos neurodivergentes montam. Falha em *continuidade* (abandona em 2 semanas).
- **Não fazer nada** — competidor real: "eu já sei que sou assim, pra que rastrear?".

---

## 6. Differentiation

**Key differentiators:**
1. **Mood Cycle Engine** — algoritmo (EWMA + desvio + tendência 7 dias) que classifica em 8 fases e sincroniza toda a experiência com a fase atual.
2. **Airia v2.4** — IA com memória do histórico (RAG), ciente da fase do ciclo em *todos* os calls (Home, Journal, Planner, GTD).
3. **Aura Editorial Clean** — design que parece revista, não dashboard. Calmo, espaçoso, off-white com acentos pastel (salmão, sálvia, lilás).
4. **Voz + SSE streaming** — ElevenLabs no premium; conversa flui como gente, não como bot.
5. **Ciclo menstrual como camada de contexto (nunca foco)** — usuária informa uma vez no onboarding (última menstruação + duração do ciclo + fase lútea). A partir daí o app calcula sozinho em que fase ela está hoje (menstrual, folicular, ovulatória, lútea) e mostra automaticamente no header do home abaixo do relógio, com gradiente próprio e contador "Dia X de Y". Mais importante: **a fase menstrual modula a leitura de humor e energia**. Energia baixa em fase lútea tem significado diferente de energia baixa em ovulação, e a Airia sabe disso antes de responder. É uma camada de contexto biológico — **jamais o foco do produto**.

**How we do it differently:** em vez de rastrear hábitos para você consertar, ele lê sua fase e ajusta o que o app te pede. A culpa some porque o sistema se adapta, não você.

**Why that's better:** neurodivergentes não quebram por falta de disciplina; quebram por tentar forçar linearidade. Quando o app respeita a não-linearidade, a pessoa volta todo dia.

**Why customers choose us:** "Finalmente alguém entendeu que o vale faz parte."

---

## 7. Objections

| Objeção | Resposta |
|---------|----------|
| "Mais um app de humor?" | Não rastreamos humor — sincronizamos sua vida com o ciclo dele. Check-in de 30s, o resto é a Airia trabalhando por você. |
| "IA não entende o que eu sinto" | A Airia não interpreta — ela acolhe. Lê sua fase atual antes de cada resposta. Teste grátis por 7 dias de conversa ilimitada. |
| "Vou esquecer de usar em 3 dias" | Por isso é mobile-first com notificação contextual. 30s de manhã. Sem streak, sem gamificação que cobra. |
| "Já faço terapia, pra quê isso?" | Complementar, não substituto. Traz seu terapeuta dados reais do ciclo entre as sessões. |
| "Prefiro papel" | Ótimo. Quando quiser ver o padrão de 3 meses, a gente está aqui. |

**Anti-persona:** pessoa neurotípica em busca de *otimização de produtividade*. Quem quer app para "render mais" vai achar que Energy Mood é soft demais. Perfeito — não é pra ela.

---

## 8. Switching Dynamics (JTBD Four Forces)

**Push (o que empurra pra fora do atual):**
- Culpa recorrente por "não conseguir manter" o planner.
- Sensação de invisibilidade no app clínico (Bearable) ou infantilização (Finch).
- Terapia sozinha não dá conta do dia-a-dia.
- Crash após ciclo de hiperfoco sem aviso.
- paralisia mental por não saber por onde começar 
**Pull (o que atrai pra cá):**
- "Finalmente alguém entendeu" ao ler a copy.
- Design editorial que parece cuidado, não ferramenta.
- Promessa de *aterrissagem*, não produtividade.
- Voz real da Airia (premium).

**Habit (o que prende no atual):**
- Daylio tem 200 dias de streak que dói abandonar.
- Notion já tem template montado.
- "Pelo menos eu registro alguma coisa."

**Anxiety (o que trava a mudança):**
- "Vai ser mais um app abandonado?"
- "E se a IA for genérica como o ChatGPT?"
- "Meus dados de saúde mental são sensíveis."
- "Vou pagar e não usar."

---

## 9. Customer Language

**Como descrevem o problema (verbatim — coletar em entrevistas):**
- "Eu não sei por que hoje eu não consigo."
- "Ontem eu estava voando, hoje eu não levanto da cama."
- "Eu sei que vou cair, mas não sei quando."
- "Todo planner assume que eu sou a mesma pessoa todo dia."
- "Eu não quero mais me sentir quebrada."

**Como descrevem a gente (verbatim — coletar):**
- "Parece um diário que responde."
- "É a única coisa que não me cobra."
- "A Airia entende que eu não sou robô."
- "Bonito que dá vontade de abrir."

**Palavras pra USAR:**
aterrissar · ritmo · fase · ciclagem · acolhimento · bio-sincronia · respeitar · ouvir · sabedoria · presença · colo · segura · editorial · calmo

**Palavras pra EVITAR:**
tracker · hábitos · produtividade · otimizar · métricas · dashboard · disciplina · biohacking · performance · rotina rígida · meta · cobrança · streak · gamificar

**Glossário:**
| Termo | Significado |
|-------|-------------|
| **Airia** | A IA que conversa no diário — não é assistente, é presença |
| **Energy Mood** | O app, o produto |
| **Aterrissar** | Voltar ao eixo sem forçar produtividade |
| **Ciclagem** | O movimento natural do humor (não transtorno) |
| **Fase** | Uma das 8 classificações do Mood Cycle Engine |
| **Bio-sincronia** | Alinhar decisões com o estado real do corpo/mente |
| **Pede Colo** | Filosofia: o app segura a mão, não organiza por você |

---

## 10. Brand Voice

**Tom:** maternal, sofisticado, editorial, com pé no chão.

**Estilo:** direto e poético ao mesmo tempo. Frases curtas. Preposições contam. Pausa vale mais que adjetivo.

**Personalidade (5 adjetivos):** acolhedora · sábia · elegante · firme · presente.

**Como NÃO soar:** chatbot animado ("Oi! Tudo bem? 😊"), clínica fria ("Registre seu humor em uma escala de 1-5"), coach de performance ("Vamos destravar seu máximo!"), infantilizada ("Seu pet tá com fominha!").

**Como SOAR:**
> "A Airia te ouve. Ela entende que seu ritmo não é uma linha reta."
> "Onde o seu ritmo é respeitado, não corrigido."
> "Um lugar seguro para sua mente aterrissar."

---

## 11. Proof Points

**Métricas-alvo (a coletar conforme base cresce):**
- Retenção D30 > 40% (benchmark app humor: 15-20%).
- Check-in diário em 5/7 dias da semana pelos usuários ativos.
- NPS > 50 na persona Neurodivergente Audaciosa.
- Tempo médio no diário > 4min (indicador de conversa real, não registro).

**Clientes notáveis:** em construção — pré-lançamento público.

**Temas de valor × prova:**
| Tema | Prova |
|------|-------|
| Bio-previsibilidade | Mood Cycle Engine detecta fase "falling" em média 2,3 dias antes de low confirmada |
| Acolhimento real | Airia tem memória RAG — cita conversas de 40 dias atrás |
| Design que convida | Aura Editorial Clean (screenshots) vs concorrentes (comparativo visual) |
| Sincronia completa | Mood + ciclo menstrual + planner + GTD, tudo no mesmo contexto |

**Testemunhos (coletar na beta):**
> "[verbatim]" — [persona]

---

## 12. Goals

**Business goal (6 meses):** 5.000 usuários ativos mensais + 500 premium pagantes.

**Conversion action primária:** instalar o app (PWA iOS via "Adicionar à Tela Inicial" ou APK Android) + completar primeiro check-in.

**Conversion action secundária:** converter free → premium após 7 dias de uso.

**Métricas atuais:** pré-lançamento público — MVP funcional, em polimento final (branch `feat/navigation-planner-ui-backend`).

---

# 🎤 PITCH — Energy Mood

## Pitch curto (elevator — 30s)

> "Sabe quando você acorda sem saber por que hoje você não consegue render igual ontem? O Energy Mood é o primeiro app que entende que mentes não-lineares precisam de um ritmo, não de uma rotina. Ele lê seu humor todo dia em 30 segundos, detecta em qual das 8 fases do seu ciclo emocional você está, e ajusta automaticamente o planner, o diário e a conversa com a Airia — nossa IA que acolhe com a voz de quem já passou por isso. Não é mais um tracker. É o copiloto que neurodivergentes de alta performance estavam esperando."

## Pitch médio (investor / parceiro — 90s)

> "Existem 120 milhões de adultos no Brasil e mais de 1 bilhão no mundo com TDAH, ciclotimia, depressão recorrente ou bipolar tipo II. Essas pessoas têm picos de genialidade e vales de exaustão — e todo app que elas experimentam assume linearidade. Daylio só rastreia. Notion só organiza. Terapia é cara e semanal. O vale continua sem ninguém.
>
> O Energy Mood é um copiloto de ciclagem de humor com IA. Em 30 segundos por dia, nosso Mood Cycle Engine classifica seu estado em 8 fases (elevada, fluindo, estável, caindo, baixa, esgotada, recuperando, mista) usando EWMA + desvio padrão + tendência de 7 dias. A partir daí, tudo se adapta: o planner sugere tarefas com badge de energia compatível, o diário chama você com a Airia — nossa IA em streaming com voz ElevenLabs — e os insights mostram padrões que você sozinha não veria.
>
> Stack: React + Expo + Supabase + OpenAI GPT-4o-mini. Modelo freemium com premium em R$ 29/mês. Disponível como PWA iOS, APK Android e Web. Sem concorrente direto que combine ciclagem algorítmica + IA com memória + design editorial. O diferencial não é tecnologia — é *filosofia*: onde seu ritmo é respeitado, não corrigido."

## Headlines prontas pra página

- **H1 principal:** "Um lugar seguro para sua mente aterrissar."
- **H1 alternativa (audiência TDAH):** "O planner que respeita o seu MOOD."
- **H1 alternativa (audiência bipolar/ciclotímica):** "Sua energia não é o problema. Sua sincronia é."
- **Sub-headline:** "Check-in de 30s. A Airia cuida do resto — com a sabedoria de quem entende que seu ritmo não é uma linha reta."
- **CTA primário:** "Começar grátis — 30 segundos"
- **CTA secundário:** "Conhecer a Airia"

## Bullet points de valor (pra landing)

1. ✨ **Mood Cycle Engine** — 8 fases detectadas automaticamente em 30s/dia.
2. 🕊️ **Airia** — IA que lembra de você e fala com a sabedoria de um diário que responde.
3. 🎨 **Aura Editorial Clean** — design que parece revista, não dashboard.
4. 🌙 **Fase menstrual automática como modulador** — informa uma vez, o app calcula sua fase todo dia e ajusta a leitura de humor e energia. Nunca é o foco — é contexto que faz a Airia entender melhor.
5. 🎙️ **Voz real** — Airia conversa em streaming com voz ElevenLabs (premium).
6. 🧘 **Sem streak, sem cobrança** — você volta porque quer, não porque gamificamos.

---

## ⚠️ Nota de Precisão — Ciclo Menstrual

Sempre que escrever copy sobre o rastreamento menstrual, usar esta linguagem:

✅ **USAR:**
- "Você informa no onboarding e o app calcula sua fase automaticamente todo dia."
- "A fase menstrual aparece sozinha no seu header, abaixo do relógio."
- "Modula a leitura de humor e energia — a Airia entende o contexto biológico."
- "Camada de contexto, nunca o foco."

❌ **EVITAR:**
- "Rastreamento em tempo real do ciclo menstrual" (não temos biosensor).
- "Sincroniza com Apple Health / Google Fit" (não integra — ainda).
- "Foco em saúde da mulher" (não é — é modulador, não centro).
- "Detecção automática de menstruação" (não detecta — calcula a partir de inputs únicos do onboarding).

**Regra absoluta:** o ciclo menstrual é sempre **suporte ao protagonista (humor)**. Se uma copy colocar o menstrual no centro, está errada.

**O que existe hoje (código):**
- Onboarding pede: data última menstruação + duração ciclo (21-35d) + duração lútea (10-16d).
- `PhaseHeader` calcula fase atual automaticamente e exibe no home abaixo do relógio com gradiente próprio + "Dia X de Y".
- Mood Cycle Engine lê a fase menstrual como contexto para interpretar humor/energia.
- Airia recebe a fase atual em todos os calls via `moodCycleContext`.

**O que NÃO existe hoje:**
- Integração com Apple Health / Google Fit / wearables.
- Detecção automática de início de menstruação.
- Re-calibração automática se o ciclo mudar — usuária atualiza manualmente no config.
