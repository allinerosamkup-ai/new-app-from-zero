# Documento 6 — Pacote de Ação: Como usar os documentos com outras IAs

## 1. Visão geral

Você tem 6 documentos prontos. Agora é só colar na IA certa, na ordem certa, para gerar:

- Telas visuais (Figma).
- Código clonado/adaptado (dev).
- Textos e tom da IA (copy).
- Análises de dados (analytics).

**Regra geral:** sempre cole primeiro o Prompt Base (Doc 5, seção 1) para contextualizar a IA. Depois cole o documento específico.

## 2. Ordem recomendada para construir o app

### Passo 1: Definir telas visuais (1–2 horas)

**Onde usar:** Figma IA, Midjourney (para moodboard), ou IA de design tipo Uizard.
**Como fazer:**

- Cole Prompt Base (Doc 5, seção 1).
- Cole Documento 4 (Mapa de Telas).
- Peça:

> Com base nos requisitos das telas, gere: 1) Figma mockup ou descrição visual detalhada da Tela Home (Estado de Hoje + mini-timeline). 2) Tela de check-in Estado de Hoje. 3) Tela de Planner Diário em timeline. 4) Moodboard de cores e tipografia (minimalista, calmo, inspirado em apps de bem-estar como Justly).

**Resultado esperado:** 6–8 frames principais + moodboard.

### Passo 2: Escrever textos e tom da IA (30–60 min)

**Onde usar:** IA de copy, ChatGPT, Claude.
**Como fazer:**

- Cole Prompt Base (Doc 5, seção 1).
- Cole Prompt para UX writing e Prompt IA Coach (Doc 5, seções 4 e 5).
- Peça:

> Gere textos para: Todas as telas do Documento 4 (headlines, botões, estados vazios). E 10 exemplos de respostas da IA Coach para situações comuns (Check-in de dia ruim, Sessão de diário quando a pessoa desabafa, Sugestão de replanejamento do planner).

**Resultado esperado:** Documento com todos os textos do app + personalidade da IA.

### Passo 3: Gerar estrutura de código (1–2 horas)

**Onde usar:** Cursor AI, GitHub Copilot, Claude (dev mode), ou outra IA de código.
**Como fazer:**

- Cole Prompt Base (Doc 5, seção 1).
- Cole Prompt para dev (Doc 5, seção 3).
- Cole Documento 3 (Arquitetura & Fluxos).
- Peça:

> Crie estrutura de projeto Flutter OU React Native + Node.js:
>
> 1) Estrutura de pastas (mobile + backend).
> 2) Schemas do banco (User, DailyCheckin, JournalSession, TimelineBlock).
> 3) 3 endpoints principais em Node/Express: POST /api/checkin, POST /ai/journal-session, POST /ai/planner-suggestions.
> 4) Componente React/Flutter para timeline (inspirado em Structure-planner).

**Resultado esperado:** Esqueleto de código clonável, com estrutura de pastas e exemplos funcionais.

### Passo 4: Prototype funcional básico (2–4 horas)

**Onde usar:** Cursor AI + VSCode, ou Bubble/Supabase para no-code rápido.
**Como fazer:**

- Pegue o código do Passo 3 e peça para a IA:

> Implemente fluxo completo: 1) Tela Home + check-in → chama IA → mostra estado do dia. 2) Tela de Planner com timeline básica (drag-and-drop simples). 3) Backend com 1 endpoint de IA mockado (respostas fixas por enquanto).

**Resultado esperado:** App funcionando em fluxo real de usuária, sem modo demo.

### Passo 5: Configurar IA real (1 hora)

**Onde usar:** Backend com OpenAI/Anthropic API.
**Como fazer:**

- Cole Prompt para IA Coach (Doc 5, seção 5) e peça:

> Crie 3 prompt templates prontos para OpenAI/Claude: 1) Prompt para calcular Energy State a partir de check-in. 2) Prompt para sessão de diário (conversa guiada). 3) Prompt para sugestões de planner.

**Resultado esperado:** Integração real da IA no backend.

### Passo 6: Teste com usuárias reais (1 semana)

**Como fazer:**

- Publique o MVP em TestFlight / Google Play Internal Test e colete feedback em 3 perguntas:

1) “O app te ajudou a entender seu dia?”
2) “As sugestões da IA fizeram sentido?”
3) “Você usaria isso todo dia?”

## 3. Checklist rápida — O que pedir para cada IA

**Para Figma/Design**

- Mockups das 6 telas principais (Home, Check-in, Diário, Resumo, Planner, Painel).
- Estados vazios e estados de erro.
- Moodboard (cores, fontes).

**Para Dev**

- Estrutura de pastas Flutter + Node.
- Schemas do banco.
- 3 endpoints REST principais.
- Componente de timeline clonado de `[repo específico]`.

**Para Copy**

- Todos os textos das telas.
- 20 exemplos de respostas da IA Coach.
- Textos de onboarding e paywall.

**Para Analytics (depois)**

- Analisar dataset de uso real.
- Encontrar padrões energia vs. conclusão de tarefas.
- Sugerir melhorias na IA.

## 4. Stack técnica recomendada (baseada em clonagem)

**Mobile:** Flutter OU React Native.
**Backend:** Node.js + Express + PostgreSQL OU FastAPI Python.
**IA:** OpenAI GPT-4o-mini OU Claude Haiku + prompts dedicados por função.
**Infra:** Supabase OU Firebase. Deploy: Vercel (backend) + Codemagic/App Center (mobile builds).

## 5. Custo estimado do MVP (MVP funcional)

- Backend + IA: ~R$ 100–200/mês (Supabase + OpenAI).
- Mobile builds: grátis (TestFlight / Internal Test).
- Tempo dev: 1–2 semanas se usando clonagem inteligente.
