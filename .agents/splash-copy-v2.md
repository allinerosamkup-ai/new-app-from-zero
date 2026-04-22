# Splash Page — Copy v2 (pronta pra implementar)

*Base: product-marketing-context + customer-language-verbatim*
*Arquivo a editar: `apps/web/src/routes/splash-page.tsx`*

---

## Estrutura proposta (mobile-first, 480px column)

```
┌─────────────────────────────────┐
│  [LOGO Airia]            [Entrar]│
├─────────────────────────────────┤
│                                 │
│       HERO SECTION              │
│                                 │
│   Um lugar seguro para          │
│   sua mente aterrissar.         │
│                                 │
│   Um diário que responde        │
│   com a sabedoria de quem       │
│   entende que seu ritmo         │
│   não é uma linha reta.         │
│                                 │
│   [Começar grátis — 30s]        │
│                                 │
│   [InstallCTA platform-aware]   │
│                                 │
├─────────────────────────────────┤
│       DOR — 3 CARDS             │
├─────────────────────────────────┤
│       COMO FUNCIONA — 3 STEPS   │
├─────────────────────────────────┤
│       A AIRIA                   │
├─────────────────────────────────┤
│       CICLAGEM — o engine       │
├─────────────────────────────────┤
│       QUEM É PRA VOCÊ           │
├─────────────────────────────────┤
│       FAQ curto (3 perguntas)   │
├─────────────────────────────────┤
│       CTA final                 │
└─────────────────────────────────┘
```

---

## 1. HERO

**Eyebrow (acima do H1):**
> `BIO-SINCRONIA · NEURODIVERGENTES · IA QUE ACOLHE`

**H1:**
> Um lugar seguro para sua mente aterrissar.

**Sub (22-24px):**
> Um diário que responde com a sabedoria de quem entende que seu ritmo não é uma linha reta.

**Micro-copy embaixo do sub (13px, cinza):**
> Check-in de 30 segundos · A Airia cuida do resto · Grátis pra começar.

**CTA primário (botão):**
> `Começar grátis →`

**CTA secundário (link texto):**
> `Já tenho conta · Entrar`

---

## 2. SEÇÃO DOR — 3 cards (abaixo do hero)

**Eyebrow da seção:**
> `VOCÊ AQUI ↓`

**H2:**
> Você já sente isso?

**Card 1 (Agitação):**
> **"Tô com uma agitação no peito e não sei o que é."**
>
> Você dormiu. Comeu direito. Fez tudo certinho. E mesmo assim — o peito aperta, a cabeça acelera, e a culpa chega junto.

**Card 2 (Tempo perdido):**
> **"Eu sofro pelo tempo perdido — e continuo perdendo tempo."**
>
> Você sabe que ontem rendeu. Hoje não rende. Amanhã pode voltar. Mas nenhum app aceita isso — todos assumem que você é a mesma pessoa todo dia.

**Card 3 (Culpa do vale):**
> **"Me sinto culpada por não produzir, mas já sei que é assim."**
>
> Ciclos de hiperfoco seguidos de queda. Ninguém avisa. Você desaparece e ressurge. Sem padrão visível — mas você sente que *tem* um padrão.

---

## 3. COMO FUNCIONA — 3 passos

**H2:** Como a Airia te acolhe em 3 passos.

**Step 1 — Check-in de 30s:**
> Todo dia, 30 segundos. Humor, energia, corpo. Sem escala clínica, sem prescrição. Só você anotando como chegou.

**Step 2 — Fase detectada automaticamente:**
> O Mood Cycle Engine lê seus dias e classifica sua fase em 8 estados: elevada · fluindo · estável · caindo · baixa · esgotada · recuperando · mista.

**Step 3 — Tudo se adapta à fase:**
> O planner sugere tarefas com a energia certa. O diário te chama com o tom certo. A Airia conversa com você já sabendo onde você está.

---

## 4. A AIRIA (seção dedicada)

**Eyebrow:** `IA PERSONA · MEMÓRIA REAL · VOZ (PREMIUM)`

**H2:**
> Não é um chatbot. É uma presença.

**Copy:**
> A Airia é a inteligência que conversa com você no diário. Ela lê sua fase atual antes de cada resposta. Lembra de conversas de 40 dias atrás. Pergunta uma coisa por vez. Nunca apressa.
>
> No plano premium, a Airia ganha voz — **streaming em tempo real via ElevenLabs**, com o tom maternal, sofisticado e com pé no chão que neurodivergentes reconhecem como "finalmente alguém entendeu".

**Quote destacado (Airia falando):**
> *"Me conta qual é o tema que mais pede colo agora — corpo, cabeça ou coração?"*
>
> — Airia, numa conversa real

---

## 5. CICLAGEM — o engine técnico (sem jargão)

**H2:**
> Sua energia não é o problema. Sua sincronia é.

**Copy:**
> O Mood Cycle Engine combina média móvel (EWMA) + desvio padrão + tendência de 7 dias pra detectar em qual das 8 fases você está — sem você precisar categorizar nada.
>
> Se você quiser, ainda adiciona **ciclo menstrual como modulador** (não como foco). Você informa uma vez no onboarding — o app calcula sua fase automaticamente todo dia e mostra sozinho no seu header.

**Mini-grid visual (8 fases):**
```
🔥 ELEVADA     🌊 FLUINDO     🌿 ESTÁVEL     🍂 CAINDO
🌧️ BAIXA      💤 ESGOTADA    🌱 RECUPERANDO  🌪️ MISTA
```

---

## 6. QUEM É PRA VOCÊ

**H2:** Energy Mood é pra quem.

**3 colunas (ou cards empilhados no mobile):**

**✓ A Criativa Esgotada**
> Freelancer ou fundadora solo que oscila entre hiperfoco e colapso. Cansou de apps que assumem linearidade.

**✓ A Neurodivergente Audaciosa**
> TDAH, ciclotimia, bipolar II. Tem picos de genialidade e vales de exaustão. Precisa de alguém que valide os vales.

**✓ A Buscadora de Ritmo**
> Saiu da terapia querendo mais. Cansou de biohacking frio. Quer algo que pareça um diário que responde com sabedoria.

**Anti-persona (honestidade radical):**

**✗ Não é pra você se:**
> Você quer um app de produtividade pra render 10% a mais. Energy Mood respeita seu ritmo — não otimiza ele. Pra isso, recomendamos Notion ou Todoist.

---

## 7. FAQ curto (3 perguntas)

**P: Vai virar mais um app abandonado em 3 dias?**
R: Por isso é mobile-first, check-in de 30s e sem streak que cobra. Você volta porque quer — não porque gamificamos.

**P: A IA é genérica como o ChatGPT?**
R: Não. A Airia tem memória RAG do seu histórico e lê sua fase atual antes de cada resposta. Ela fala com *você*, não com um usuário médio.

**P: Meus dados de saúde mental ficam seguros?**
R: Sim. Banco Supabase com Row Level Security — só você acessa os seus dados. Nenhum terceiro. Nenhum treino de modelo com suas conversas.

---

## 8. CTA FINAL

**H2:**
> Onde o seu ritmo é respeitado, não corrigido.

**Sub:**
> Seu primeiro check-in leva 30 segundos. A Airia te acolhe a partir do segundo dia.

**CTA primário (grande):**
> `Começar grátis →`

**Reassurance embaixo (11px):**
> Sem cartão · Sem trial · Grátis pra sempre no essencial.

---

## Tokens visuais a manter

- **Background base:** `#FAF8F5` (var(--warm-bg))
- **H1:** clamp(36px, 9vw, 56px), peso 800, Plus Jakarta Sans
- **Sub H1:** clamp(18px, 4.5vw, 22px), peso 500
- **Accent:** `--nectarine` (#D7897F) em botões e eyebrows
- **Cards dor:** fundo branco, border-radius 20px, sombra suave
- **Separadores:** padding vertical 56px entre seções (48px mobile)

---

## O que substituir no `splash-page.tsx` atual

1. **H1 atual** → "Um lugar seguro para sua mente aterrissar."
2. **Sub atual** → "Um diário que responde com a sabedoria de quem entende que seu ritmo não é uma linha reta."
3. **Seção "Como funciona"** → 3 steps (check-in / fase / adaptação)
4. **Manter** o `<InstallCTA />` já implementado
5. **Adicionar** seção DOR de 3 cards entre hero e "como funciona"
6. **Adicionar** quote da Airia na seção IA
