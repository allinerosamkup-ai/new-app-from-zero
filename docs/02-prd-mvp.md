# Documento 2 — PRD do MVP (Product Requirements Document)

## 1. Resumo executivo

O MVP é um aplicativo mobile (com visão futura web) que combina:

- leitura de estado atual (humor, energia, sono, contexto),
- diário guiado com IA,
- planner diário visual adaptativo,
- painel semanal de ciclos.

O objetivo do MVP é validar a tese central: dados (biométricos + subjetivos) podem ser usados para reorganizar o dia da pessoa a favor da energia psíquica e da ciclagem de humor, de forma prática, respeitosa e com baixa fricção.

## 2. Objetivo do MVP

Entregar uma primeira versão que:

- Leia o estado atual da pessoa (sem ainda depender de wearable obrigatório).
- Permita conversas básicas com IA em formato de diário.
- Organize o dia em uma timeline visual com sugestões de ajuste baseadas em energia/humor.
- Mostre um painel semanal simples de padrões.

Validar com usuárias reais se:

- Elas se sentem compreendidas nos ciclos.
- As recomendações de ajuste de dia fazem sentido.
- A experiência é leve o suficiente para ser usada em dias ruins.

## 3. Escopo do MVP

### 3.1 Incluído

**Onboarding leve com:**

- Objetivos (ex.: “diminuir crashes”, “ter dias mais realistas”, “lidar com ciclo hormonal”).
- Rotina básica (horário típico de sono, trabalho, estudo, cuidado com filhos, etc.).
- Consentimentos de dados (mínimos necessários).

**Módulo Estado de Hoje (check-in + cálculo):**

- Check-in rápido de humor, energia psíquica, clareza mental, irritabilidade, nível físico e social (2–3 toques).
- Campo opcional de texto curto (“Quer contar algo?”).

**Módulo Diário com IA (básico):**

- Sessão de conversa em formato chat (texto + áudio com transcrição).
- Resumo simples da sessão.
- Lista de emoções principais e temas recorrentes detectados.

**Módulo Planner Diário Adaptativo (timeline):**

- Timeline vertical do dia com blocos coloridos por horário.
- Tarefas simples (título, horário, duração).
- Rotinas básicas (manhã/tarde/noite).
- Replanejamento semiautomático orientado por `DailyContext`: agenda real, hábitos, metas, check-ins, concluídos, rejeitados e memória de padrão.
- Airia Decision Brain classifica cada saída como compromisso real, sugestão opcional, insight ou bloqueio.
- IA não deve inventar tarefa sem âncora atual. Ela pode sugerir compromisso opcional ligado a meta/intenção atual, mas não pode salvar nem notificar sem confirmação.

**Módulo Painel Semanal (v1 simples):**

- Gráfico simples ou lista com:
  - Médias de energia/humor por dia.
  - Momentos da semana com maior queda ou maior estabilidade.
  - 2–3 insights de IA em texto.

**Conta & Privacidade (v1):**

- Login básico (e-mail + senha ou OAuth simples).
- Tela de consentimentos de dados.
- Botão de exclusão de conta e dados.

**Produto final e segurança mínima (v1.1):**

- Não há modo demo, botão de demo ou seed de demo no produto final.
- A robustez deve vir de fluxos reais: check-in, planner, hábitos, metas, diário, Aura e Insights usando dados da própria usuária.
- `riskSafety` nas superfícies de IA para classificar sinais de atenção sem diagnóstico.
- Protocolo de segurança visível em Check-in, Diário e Aura Chat, com rotas de adaptação do dia, apoio humano e crise.
- Evento `risk_protocol_triggered` registra quando a camada de segurança aparece ou é acionada.
- Copy do produto reforça que Airia é suporte funcional e adaptativo, não substituto clínico.

### 3.2 Fora do escopo imediato (Fase 2+)

- Integração real com ŌURA Ring e outros wearables (ficará planejado, mas não implementado na primeira build).
- Templates complexos de journaling temático (ex.: relacionamentos, carreira, espiritualidade).
- Personalidades múltiplas de IA (empático, desafiador, filosófico etc.).
- Matriz de Eisenhower completa, Pomodoro avançado, árvore de metas complexas (sabendo que são inspiradas em Splitti, mas podem ficar para depois).
- Biblioteca de meditações/somas integrados.
- Versão web completa (no MVP, apenas preparar arquitetura para isso).

## 4. Personas resumidas

**Usuária Ciclo & Trabalho:** Mulher em idade fértil, com variações fortes de humor/energia ligadas ao ciclo, tentando encaixar rotina profissional e pessoal.
**Usuária Neurodivergente:** Pessoa com TDAH/bipolaridade que sente dias muito diferentes entre si e se frustra com planners tradicionais “idealistas”.
**Usuária Menopausa/Climatério:** Mulher em transição hormonal, com sono irregular, irritabilidade, ondas de calor e crashes de energia.

## 5. Jornada principal do MVP

1. Usuária instala e faz onboarding rápido (3–5 minutos).
2. Faz primeiro check-in Estado de Hoje.
3. App calcula um rótulo simples de estado (ex.: “hoje é dia de gentileza com você”, “você está em modo estável”, “dia mais sensível”).
4. IA sugere estrutura de dia compatível a partir do contexto real do dia.
5. Usuária ajusta timeline (arrasta blocos, adiciona tarefas).
6. Opcionalmente, faz uma sessão de diário com IA.
7. No final do dia, pode fazer um check-in de fechamento (opcional).
8. No final da semana, vê Painel Semanal com padrões e 2–3 recomendações.

## 6. Módulos do MVP (visão geral)

### 6.1 Módulo Estado de Hoje

- Check-in rápido (telas simples, escalas de 1–5, carinhas ou sliders).
- Cálculo de um “Energy State” interno (estrutura para IA + app, não visível como número bruto).
- Output visível: frase-resumo + cor/ícone.

### 6.2 Módulo Diário com IA (básico)

- Tela de chat com campo de texto e botão de microfone (áudio → transcrição).
- IA conduz 5–10 minutos de conversa leve (2–3 perguntas abertas).
- Ao final, IA gera resumo (2–5 frases), emoções detectadas (3–5) e temas recorrentes (2–3).

### 6.3 Módulo Planner Diário Adaptativo

- Timeline vertical com horas à esquerda e blocos de tarefas/rotinas.
- Criação rápida (título, início, duração) e Drag-and-drop.
- IA sugere distribuição inicial do dia e replanejamento de tarefas pesadas baseando-se no Estado de Hoje.
- Sugestões feitas, excluídas, rejeitadas ou agendadas não devem voltar como novas.

### 6.4 Módulo Painel Semanal

- Linha do tempo simples da semana com humor/energia.
- Lista de “momentos críticos” ou “pontos altos”.
- 2–3 sugestões gerais da semana (ex.: “seus crashes estão ligados a noites curtas de sono”).

### 6.5 Módulo Conta & Privacidade

- Cadastro/login, tela de consentimentos granulares.
- Botão apagar conta + dados.

## 7. Requisitos funcionais detalhados

**7.1 Estado de Hoje**

- RF-01 (P0) — Usuária consegue registrar humor em 1–2 toques.
- RF-02 (P0) — Usuária consegue registrar energia psíquica (baixa, média, alta).
- RF-03 (P0) — Usuária consegue registrar clareza mental, irritabilidade e estado físico em escalas simples.
- RF-04 (P1) — Campo opcional de texto livre.
- RF-05 (P0) — IA combina inputs em um rótulo simples de estado (texto + cor/ícone).
- RF-06 (P1) — Check-in de fim de dia (como você está agora?).

**7.2 Diário com IA**

- RF-07 (P0) — Tela de chat com histórico da sessão atual.
- RF-08 (P0) — Entrada por texto.
- RF-09 (P1) — Entrada por áudio com transcrição automática.
- RF-10 (P0) — IA faz pelo menos 2–3 perguntas guiadas.
- RF-11 (P0) — Ao finalizar, IA gera Resumo, Lista de emoções e Temas.
- RF-12 (P1) — Salvar sessão no histórico pessoal.

**7.3 Planner Diário Adaptativo**

- RF-13 (P0) — Timeline vertical com horas + blocos.
- RF-14 (P0) — Criar tarefa rápida (título, início, duração).
- RF-15 (P0) — Drag-and-drop de blocos.
- RF-16 (P1) — Rotinas básicas (ex.: rotina de manhã com blocos padrão).
- RF-17 (P0) — Estado de hoje influencia mensagens, tipo de dia e recomendações no topo da tela.
- RF-18 (P1) — Replanejamento semiautomático de tarefas não concluídas.
- RF-18.1 (P0) — Sugestões operacionais precisam estar ancoradas em tarefa pendente, hábito devido, meta ativa ou aceite explícito.
- RF-18.2 (P0) — Ações concluídas/rejeitadas/excluídas/agendadas entram como bloqueio de repetição.
- RF-18.3 (P1) — Planner mostra preview de adaptação antes de aplicar mudanças.

**7.4 Painel Semanal**

- RF-19 (P0) — Visual semanal de humor/energia (simples).
- RF-20 (P0) — Lista de “insights da semana” gerados por IA.
- RF-21 (P1) — Destaque de dias com pior sono/crash (relatos subjetivos).

**7.5 Conta & Privacidade**

- RF-22 (P0) — Criar conta e Login.
- RF-24 (P0) — Tela de consentimentos com checkboxes separados.
- RF-25 (P0) — Botão de apagar conta + dados.
- RF-26 (P1) — “Mapa de dados” simples.

## 8. Comportamento da IA no MVP

**8.1 Papéis principais da IA**

- Interpretar check-ins → classificar “estado de hoje”.
- Conduzir sessão de diário.
- Resumir sessão e extrair emoções/temas.
- Sugerir estrutura do dia no planner com base em estado energético + histórico.
- Gerar insights semanais no painel.
- Classificar segurança mínima com `riskSafety` e rotear para autoapoio, adaptação do dia, apoio humano ou protocolo de crise.

**8.2 Memória mínima**

- Armazenar últimos N dias de check-ins e últimas N sessões de diário.
- Entender padrões simples (ex.: “dia X costuma ser pesado”).
- Separar memória de padrão de memória operacional: histórico explica, mas só contexto de hoje vira ação.
- Guardar feedback leve sobre sugestões da IA para reduzir repetição.

**8.3 Segurança**

- Nunca diagnosticar TDAH, bipolaridade, depressão ou qualquer quadro clínico.
- Nunca prometer cura ou substituir profissional.
- Diante de linguagem de crise, sair do modo coaching comum e orientar busca de apoio humano/emergencial.
- Persistir `riskSafety` no check-in para auditoria e evolução futura.

## 9. Estratégia de clonagem de código por módulo

**9.1 Timeline/Planner**

- Referências: `karolkawski/Structure-planner`, `v1tzor/TimePlanner`.
- Estratégia: Clonar timeline vertical, blocos por horário e drag-and-drop.

**9.2 Diário + Hábitos/Padrões**

- Referências: `Loop Habit Tracker`, `Habo`, `OpenHabitTracker`.
- Estratégia: Clonar modelagem de registro diário + gráficos, adaptando UI para estado emocional/energético.

**9.3 IA + Gestão de Tarefas**

- Referências: `AI Task Management Agent` (FastAPI + React), projetos Eisen-Matrix.
- Estratégia: Clonar integração backend/IA para planner diário.

**9.4 Backend e infraestrutura**

- Referências: Habit trackers em Node/Express (ex: `Habit-Tracker`).
- Estratégia: Clonar rotas, schemas (adaptar p/ energy_state, mood_tags, timeline_blocks) e auth.

## 10. Arquitetura técnica do MVP (alto nível)

**10.1 Cliente (mobile)**

- Sugestão: Flutter OU React Native.
- Responsável por: UI, Armazenamento local (cache), chamadas à API.

**10.2 Backend (API)**

- Stack sugerida: Node.js + Express + PostgreSQL (ou MongoDB).
- Funções: Auth, Gestão de usuários, Check-ins, Sessões, Tarefas e Jobs (insights).

**10.3 Camada de IA**

- Endpoints: `/ai/state-evaluation`, `/ai/journal-session`, `/ai/planner-suggestions`, `/ai/weekly-insights`.
- Memória baseada em banco relacional/NoSQL + índice vetorial futuro.
