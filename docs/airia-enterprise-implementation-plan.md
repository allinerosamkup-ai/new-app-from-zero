# Airia — Plano de Implementação Empresarial
**Versão:** 1.0 | **Data:** Junho 2026 | **Responsável:** Alline Rosa

---

## Sumário Executivo

Airia é um assistente pessoal de ciclagem de humor, energia e agenda adaptativa — SaaS mobile-first direcionado a pessoas com TDAH, ciclotimia, depressão recorrente, bipolar tipo II e variações hormonais cíclicas. O produto já possui MVP funcional em produção com stack consolidada (React + Vite + Supabase + OpenAI GPT-4o-mini) e serviços de IA proprietários como o **MoodCycleEngine**, **Airia Decision Brain** e **AdaptiveAgendaEngine**.

Este documento define o plano de execução empresarial completo: o que já existe, o que falta construir, como vender, como crescer e com que estrutura de time e investimento.

**Estado atual:** MVP em polimento final. Serviços de IA de segunda geração entregues. Design System Aura Editorial Clean consolidado. Sem usuários pagantes ainda — pré-lançamento público.

**Meta de 12 meses:** 10.000 usuários ativos mensais (MAU) + 1.000 pagantes premium (R$ 29/mês ou R$ 249/ano).

---

## 1. Estado Atual do Produto

### 1.1 O que está em produção

| Módulo | Status | Observações |
|--------|--------|-------------|
| Check-in rápido (humor, energia, irritabilidade, clareza, sono) | ✅ Produção | Escalas de 1–5, baixa fricção |
| MoodCycleEngine (8 fases: EWMA + σ + tendência 7 dias) | ✅ Produção | Fases visíveis alinhadas |
| Diário com IA (Aura Chat — streaming SSE) | ✅ Produção | GPT-4o-mini + RAG |
| Planner adaptativo (timeline + blocos) | ✅ Produção | Ação "Adiar" com registro de padrão |
| Airia Decision Brain | ✅ Produção | `real_commitment`, `suggested_commitment`, `insight_only`, `blocked` |
| AdaptiveAgendaEngine | ✅ Produção | Preview de adaptação; não aplica mudança estrutural sem confirmação |
| DailyContext + `/api/context/day` | ✅ Produção | Commit `7c44742` |
| Feedback de ações (`AiActionFeedbackService`) | ✅ Produção | Bloqueia repetição de ações feitas/rejeitadas/puladas |
| Fase menstrual automática (PhaseHeader) | ✅ Produção | Calculada a partir de onboarding; modula leitura de humor |
| riskSafety (protocolo de segurança clínica) | ✅ Produção | Check-in, Diário, Aura Chat |
| Insights semanais | ✅ Produção | Padrões conectados à execução real |
| PWA iOS + APK Android | ✅ Produção | Scroll vertical natural; bloqueio lateral restrito |
| Autenticação (Supabase Auth) | ✅ Produção | OAuth + e-mail/senha |
| LGPD: exportação + exclusão de dados | ✅ Produção | `privacy-export`, `privacy-delete` |
| Design System "Aura Editorial Clean" | ✅ Produção | Plus Jakarta Sans, coral pastel, glassmorphism |
| Stripe (assinatura premium) | ✅ Backend | Frontend de conversão pendente |
| ElevenLabs (voz da Airia) | 🔧 Planejado | Premium — não lançado |
| Integração wearable (Oura Ring) | 📋 Fase 2 | Arquitetura pronta para dual-input |
| Knowledge Graph / memória longitudinal | ✅ Backend | `knowledge-graph.service.ts` + backfill |

### 1.2 Stack técnica consolidada (travada)

```
Frontend:    React 18 + Vite + TypeScript + Tailwind CSS
Estado:      Zustand (stores em apps/web/src/features/aura/)
Backend:     Node.js + Express + TypeScript
ORM:         Prisma (packages/database/prisma/schema.prisma)
Banco:       Supabase (PostgreSQL + Auth + Storage)
IA:          OpenAI GPT-4o-mini
Voz (P):     ElevenLabs (premium, ainda não lançado)
Deploy:      VPS + Supabase Cloud
```

### 1.3 Serviços de IA proprietários (diferencial real)

- **`mood-cycle-engine.ts`** — EWMA + desvio padrão + tendência de 7 dias → 8 fases classificadas
- **`decision-engine.service.ts`** — Decision Brain com 6 camadas (Truth → Memory → Candidate → Decision → Critic → Narrative)
- **`adaptive-agenda-engine.service.ts`** — Replanejamento contextual sem inventar tarefa sem âncora real
- **`context-grounding.service.ts`** — DailyContext: agenda + hábitos + metas + concluídos + RAG + postponedActions
- **`aura-prompt.ts`** — Persona Aura v2.4 com 8 superfícies de política distintas
- **`knowledge-graph.service.ts`** — Memória longitudinal estruturada

---

## 2. Visão de Produto e Posicionamento

### 2.1 O que Airia é

**Assistente pessoal de ciclagem de humor, energia e agenda adaptativa.**

Não é planner genérico, tracker menstrual ou chatbot terapêutico. É um sistema que:
1. Lê o estado interno da pessoa (check-in + contexto biológico)
2. Classifica a fase atual do ciclo de humor/energia
3. Adapta o dia real com base nessa fase
4. Aprende padrões ao longo do tempo para antecipar quedas e picos

### 2.2 Diferencial defensável

| Diferencial | Como se manifesta | Por que é difícil copiar |
|-------------|-------------------|--------------------------|
| MoodCycleEngine | Algoritmo EWMA próprio, 8 fases, calibra por histórico individual | Modelo proprietário + dados longitudinais |
| Decision Brain | 6 camadas, separa compromisso real de sugestão, bloqueia repetição | Arquitetura específica de produto, não genérica |
| Airia (persona IA) | Memória RAG, 8 políticas de superfície, voz única | Meses de engenharia de prompt + dados reais |
| Aura Editorial Clean | Design que parece revista, não dashboard clínico | Posicionamento emocional consolidado |
| Ciclo menstrual como modulador | Nunca é o foco — é contexto biológico da Airia | Filosofia de produto rara no mercado |

### 2.3 Personas prioritárias

**P1 — Neurodivergente Audaciosa** (25–38, TDAH/ciclotimia): quer que o app entenda que o vale faz parte. Não quer ser cobrada por streak.

**P2 — Criativa Esgotada** (30–40, freelancer/fundadora): oscila entre hiperfoco e colapso. Quer ritmo respeitado, não corrigido.

**P3 — Buscadora de Ritmo** (28–45, pós-terapia): quer autoconhecimento que vire decisão prática, não só reflexão.

---

## 3. Roadmap Técnico por Ondas

### Onda 0 — Polimento de Lançamento (Julho 2026) ⚡ AGORA

**Objetivo:** produto pronto para consumidor real. Zero bugs bloqueantes, onboarding fluido, conversão free→premium funcional.

| Prioridade | Tarefa | Esforço |
|------------|--------|---------|
| 🔴 Crítico | Paywall + tela de upgrade premium (Stripe frontend) | 3 dias |
| 🔴 Crítico | Onboarding completo < 3 min com coleta de contexto menstrual | 2 dias |
| 🔴 Crítico | Push notification contextual (não invasiva, fase-aware) | 3 dias |
| 🟡 Alto | Close-the-day check-in (feature pronta — revisar UX) | 1 dia |
| 🟡 Alto | Tela de Insights semanais com padrão visual claro | 2 dias |
| 🟡 Alto | Empty states com Airia falando (não telas vazias) | 1 dia |
| 🟢 Médio | PWA "Adicionar à Tela Inicial" instrução em iOS | 1 dia |
| 🟢 Médio | App Store Connect + Google Play Store listing | 2 dias |
| 🟢 Médio | Tela de configurações (ciclo menstrual, notificações, conta) | 2 dias |

**Critério de saída:** 50 beta users em D7 sem reportar blocker crítico.

---

### Onda 1 — Lançamento Público + Retenção (Agosto–Setembro 2026)

**Objetivo:** 2.000 MAU + D30 retention > 35% + primeiros 100 pagantes.

| Feature | Justificativa | Esforço |
|---------|---------------|---------|
| ElevenLabs (voz Airia no premium) | Diferencial sonoro, aumenta willingness to pay | 5 dias |
| Streak-free streak (presença sem cobrança) | Mostra engajamento sem gamificação tóxica | 2 dias |
| Sugestão de tarefa por meta (sem âncora forçada) | Fecha gap entre "agenda vazia" e silêncio total | 3 dias |
| Widget nativo Android (fase atual + check-in rápido) | Aumenta DAU sem abrir o app | 4 dias |
| Compartilhamento de insight semanal (imagem) | Viral loop orgânico | 2 dias |
| Referral simples (código de amiga) | Aquisição orgânica com usuária satisfeita | 2 dias |
| Modo offline (check-in sem internet) | Reduz fricção em dias de desregulação | 3 dias |

**KPIs Onda 1:**
- MAU: 2.000
- D7 retention: > 45%
- D30 retention: > 35%
- Conversão free→premium: > 5%
- NPS: > 45

---

### Onda 2 — Crescimento + Profundidade (Outubro–Dezembro 2026)

**Objetivo:** 5.000 MAU + 500 pagantes + ARR ≈ R$ 120k.

| Feature | Justificativa | Esforço |
|---------|---------------|---------|
| Relatório mensal exportável (PDF) | Prova de valor pra terapeutas e médicos | 4 dias |
| Templates de planner por fase (Alta → tarefas intensas; Recolhimento → só o essencial) | Reduz carga cognitiva no planejamento | 3 dias |
| Integração Google Calendar (read + write) | `gcal.service.ts` já existe — fechar o loop | 5 dias |
| Modo "Eu não sei o que sinto" (entrada por ícone, não texto) | Acessibilidade para dias de niebla mental | 2 dias |
| Painel de padrões anual (heatmap de fases) | Retenção de longo prazo — "ver minha história" | 4 dias |
| Notificação inteligente por fase (não horário fixo) | Aumenta abertura sem irritar | 3 dias |
| Plano anual com desconto (R$ 249/ano) | Aumenta LTV e reduz churn | 1 dia |
| Web app completo (responsivo) | Ampliar acesso — desktop work sessions | 5 dias |

**KPIs Onda 2:**
- MAU: 5.000
- Pagantes: 500
- ARR: R$ 120.000
- Churn mensal: < 8%

---

### Onda 3 — Expansão (2027)

**Objetivo:** 15.000 MAU + parceria B2B com clínicas/terapeutas + wearable.

| Feature | Justificativa |
|---------|---------------|
| Integração Oura Ring / Apple Health | Dual-input biométrico — arquitetura já prevista |
| Dashboard para terapeuta (modo profissional) | Canal B2B2C — terapeuta indica o app |
| API pública para pesquisadores | Credibilidade científica + dados anonimizados |
| Versão em inglês (US market) | TAM 10x maior |
| Previsão de fase (2–3 dias ahead) | Diferencial técnico de bioprevisibilidade |
| Comunidade in-app (grupos por fase) | Retenção social sem virar rede social |

---

## 4. Go-To-Market

### 4.1 Sequência de lançamento

```
Semana 1-2:    Soft launch — 50 beta users (rede pessoal da Alline)
Semana 3-4:    Comunidades de nicho (Reddit, grupos Facebook, Discord)
Mês 2:         Product Hunt launch (terça-feira)
Mês 2-3:       Mídia tech PT-BR (Canaltech, Tecmundo, Olhar Digital)
Mês 3-4:       Parcerias com terapeutas e psicólogos
Mês 4-6:       Ads pagos (Meta + TikTok — foco em personas P1 e P2)
Mês 6+:        Influencers neurodivergentes (micro, 10k–100k)
```

### 4.2 Canais orgânicos prioritários

**Reddit PT-BR**
- r/tdahbrasil (30k), r/ciclotimia, r/saudemental
- Estratégia: post first-person da Alline sobre criar o app a partir da dor própria
- Nunca drop-and-run — construir presença antes de mencionar produto

**Facebook Groups**
- "Mulheres com TDAH" (80k+), "Adultos com TDAH Brasil" (120k+), "Neurodivergentes Unidos Brasil" (40k+)
- Regra: contribuir 5–10 posts antes de mencionar o app; pedir permissão ao mod

**LinkedIn**
- Post pessoal sobre vulnerabilidade + tech: "construí um app enquanto vivia meu próprio ciclo"
- Ângulo: fundadora neurodivergente construindo para si mesma

**TikTok / Instagram Reels**
- Formato: "por que eu não consigo manter planner" + solução não-linear
- Persona criadora: Alline como fundadora visível, não como empresa

### 4.3 Parcerias estratégicas

| Parceiro | Proposta de valor | Como abordar |
|----------|------------------|--------------|
| Psicólogos e terapeutas | App envia relatório de padrões para sessão — terapeuta tem contexto real do ciclo | Email direto + CRP (Conselho Regional de Psicologia) |
| Clínicas de TDAH | Ferramenta complementar ao tratamento — sem competir com diagnóstico | Parceria de uso + pesquisa |
| Podcasts de saúde mental | Audiência já educada no problema | Guest da Alline falando sobre biohacking emocional |
| Comunidades de mulheres em tech | Fundadora neurodivergente + produto que respeita o vale | Palestras e webinars |

### 4.4 Modelo de aquisição projetado

| Canal | CAC estimado | Conversão para premium |
|-------|-------------|----------------------|
| Orgânico (comunidades) | R$ 0 | 8–12% |
| Parcerias (terapeutas) | R$ 5–15 | 15–25% |
| Ads Meta/TikTok | R$ 30–60 | 3–6% |
| Product Hunt | R$ 0 (custo de tempo) | 5–8% |
| Influencers micro | R$ 10–30 | 6–10% |

---

## 5. Modelo de Negócio e Projeções Financeiras

### 5.1 Estrutura de pricing

**Free (sempre gratuito)**
- Check-in diário ilimitado
- MoodCycleEngine completo
- 1 conversa com Airia por dia (sem voz)
- Planner básico (até 5 tarefas/dia)
- Insights semanais resumidos

**Premium — R$ 29/mês ou R$ 249/ano (14% de desconto)**
- Conversas ilimitadas com Airia
- Voz da Airia (ElevenLabs streaming)
- Insights avançados + painel de padrões anual
- Relatório mensal exportável (PDF)
- Planner completo (tarefas ilimitadas + templates por fase)
- Sincronização com Google Calendar
- Integração ciclo menstrual avançada
- Suporte prioritário

### 5.2 Projeções (cenário base)

| Período | MAU | Pagantes | MRR | ARR |
|---------|-----|----------|-----|-----|
| Ago 2026 (launch) | 300 | 15 | R$ 435 | R$ 5.220 |
| Out 2026 | 1.500 | 90 | R$ 2.610 | R$ 31.320 |
| Dez 2026 | 3.000 | 210 | R$ 6.090 | R$ 73.080 |
| Mar 2027 | 6.000 | 480 | R$ 13.920 | R$ 167.040 |
| Jun 2027 | 10.000 | 1.000 | R$ 29.000 | R$ 348.000 |

**Premissas:**
- Conversão free→premium: 7–10% dos MAU ativos
- Churn mensal: 8% (benchmark apps bem-sucedidos no nicho: 5–12%)
- ARPU: R$ 26/mês (mix mensal e anual, com desconto)
- CAC médio ponderado: R$ 20 (pesado em orgânico)
- LTV médio: R$ 185 (7,1 meses de retenção média)
- LTV/CAC: 9,2x (saudável > 3x)

### 5.3 Custos operacionais projetados (mensal)

| Item | Custo atual | Custo com 10k MAU |
|------|-------------|-------------------|
| Supabase (DB + Auth + Storage) | ~R$ 100 | ~R$ 800 |
| OpenAI API (GPT-4o-mini) | ~R$ 300 | ~R$ 3.000 |
| ElevenLabs (voz premium) | R$ 0 | ~R$ 500 |
| VPS / hosting | ~R$ 150 | ~R$ 400 |
| Stripe fees (2.9% + R$ 0,30) | variável | ~R$ 870 |
| **Total COGS** | **~R$ 550** | **~R$ 5.570** |

**Margem bruta projetada (10k MAU):** R$ 29.000 MRR − R$ 5.570 COGS = **R$ 23.430 (80,8%)**

---

## 6. Estrutura de Time

### 6.1 Time mínimo para lançamento (Fase 0–1)

| Papel | Quem | Dedicação |
|-------|------|-----------|
| Founder + Product + Engineering | Alline | 100% |
| IA assistente (execução técnica) | Claude / Cowork | Contínuo |
| Design review | Externo pontual | Por feature |
| Suporte beta (moderação) | Alline | 2h/dia |

**Princípio operacional:** Alline é a pessoa das ideias e da visão. Execução técnica é delegada ao máximo via IA e ferramentas. Só contratar humano quando o gargalo for repetição de alto volume que IA não resolve.

### 6.2 Primeiras contratações (quando MAU > 2.000)

| Papel | Quando | Por quê |
|-------|--------|---------|
| Customer Success / Comunidade | Mês 3–4 | Retenção e feedback de beta |
| Growth / Marketing | Mês 5–6 | Escalar aquisição orgânica |
| Backend Engineer | Mês 6–8 | Wearable integration + escala |

### 6.3 Time alvo (Onda 3 / 2027)

| Papel | Headcount |
|-------|-----------|
| Founder (CEO/CPO) | 1 |
| CTO / Lead Engineer | 1 |
| Backend Engineers | 2 |
| Frontend / Mobile Engineer | 1 |
| AI/ML Engineer | 1 |
| Product Designer | 1 |
| Growth / Marketing | 1 |
| Customer Success | 1 |
| **Total** | **9** |

---

## 7. Métricas Prioritárias (OKRs por Onda)

### Onda 0 — Polimento (Julho 2026)
- ✅ 50 beta users sem blocker crítico
- ✅ Onboarding < 3 minutos (medido com gravação de sessão)
- ✅ Stripe cobrando em produção
- ✅ D7 retention > 40% na beta

### Onda 1 — Lançamento (Ago–Set 2026)
- 🎯 2.000 MAU
- 🎯 D30 retention > 35%
- 🎯 100 pagantes premium
- 🎯 NPS > 45
- 🎯 Tempo médio no diário > 4 min

### Onda 2 — Crescimento (Out–Dez 2026)
- 🎯 5.000 MAU
- 🎯 500 pagantes
- 🎯 ARR > R$ 120k
- 🎯 Churn mensal < 8%
- 🎯 10 parcerias ativas com terapeutas

### Onda 3 — Expansão (2027)
- 🎯 15.000 MAU
- 🎯 ARR > R$ 500k
- 🎯 Wearable integrado (Oura / Apple Health)
- 🎯 Versão em inglês com 1.000 usuários

---

## 8. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Custo OpenAI escala mais rápido que receita | Alta | Médio | Cache agressivo de respostas recorrentes; migrar para modelo local (Llama) em Onda 3 |
| D30 retention abaixo de 30% | Média | Alto | Early warning em D7; loop de feedback semanal com beta users |
| Concorrente lança feature similar antes | Média | Médio | Velocidade de execução + dados longitudinais como moat; comunidade como lock-in |
| Alegação clínica indevida gera risco regulatório | Baixa | Alto | `riskSafety` ativo; copy revisado por protocolo; nunca prometer cura |
| Churn alto por falta de engajamento | Alta | Alto | Empty states com Airia; notificação contextual por fase; close-the-day check-in |
| Alline esgotamento como única founder | Alta | Alto | Delegação técnica máxima via IA; CS contratado antes de crescimento de usuários |
| Privacidade de dados de saúde mental | Média | Alto | LGPD compliance já implementado; criptografia Supabase; sem compartilhamento de dados brutos |

---

## 9. Checklist de Release (por feature)

Antes de qualquer feature ir a produção, validar:

- [ ] Não expõe copy de venda/demo dentro do app
- [ ] Não alega benefício clínico (cura, diagnóstico, tratamento)
- [ ] `riskSafety` cobre a superfície de IA
- [ ] Airia não inventa tarefa sem âncora real no DailyContext
- [ ] Sugestão não confirmada não gera notificação
- [ ] `setHours()` não é usado em serviços de agenda (usar UTC / horário local correto)
- [ ] Dados de menstrual nunca são o foco — sempre modulador
- [ ] Empty state tem Airia falando, não tela vazia
- [ ] Testado em PWA iOS e APK Android
- [ ] `npm run build --workspace=@app/web` sem erro

---

## 10. Próximas 3 Ações (esta semana)

1. **Finalizar Stripe frontend** — tela de upgrade premium com pricing mensal/anual. É o único gate para faturar.
2. **Revisar onboarding** — gravar sessão de uma pessoa nova passando pelo fluxo completo. Identificar onde ela trava.
3. **Criar lista de 20 terapeutas da rede da Alline** — email pessoal convidando para beta exclusiva com acesso premium gratuito por 3 meses.

---

*Este documento é vivo. Atualizar a cada sprint com métricas reais vs. projetadas.*

*Airia não é médica. É assistente de ciclagem de humor, energia e agenda adaptativa.*
