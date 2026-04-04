# Aura Visual Refinement Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar elegância visual ao Mood Energy — cor Nectarine (#D7897F), bordas tonais, ícones strokeWidth=1.5 e hover scale — em todas as 13 telas, sem alterar nenhuma funcionalidade.

**Architecture:** Todas as mudanças são CSS e JSX superficiais. O `index.css` recebe os novos tokens e classes globais (`.interactive-card`, `.btn-aura`). Cada tela recebe apenas substituições de cor, adição das classes e `strokeWidth={1.5}` nos ícones. Zero lógica alterada.

**Tech Stack:** React 18 + Vite + TypeScript + Tailwind CSS v3 + Lucide React

**Spec:** `docs/superpowers/specs/2026-03-18-aura-visual-refinement-design.md`

**Verificação:** `cd apps/web && npm run build` deve terminar exit 0 após cada chunk.

---

## Chunk 1: CSS Foundation — `src/index.css`

**Files:**
- Modify: `apps/web/src/index.css`

### Task 1: Adicionar tokens de cor Nectarine e variáveis de borda

- [ ] **Leia o arquivo atual antes de editar**

```bash
cat apps/web/src/index.css
```

- [ ] **Adicionar novos tokens no bloco `:root` existente** (após as variáveis existentes, antes do fechamento `}`)

Adicionar ao `:root`:
```css
  /* ── Aura Nectarine accent ── */
  --accent-9:        #D7897F;
  --accent-10:       #C46B60;
  --accent-11:       #A8544A;
  --accent-surface:  rgba(215, 137, 127, .09);

  /* ── Bordas tonais ── */
  --border-subtle:      rgba(215, 137, 127, .10);
  --border-interactive: rgba(215, 137, 127, .22);
  --border-card:        rgba(255, 255, 255, .65);

  /* ── Categorias Planner (todas as 5 usadas no catConfig) ── */
  --cat-trabalho:    #6398A9;
  --cat-pessoal:     #B8A0C8;
  --cat-autocuidado: #96C7B3;
  --cat-social:      #F9B95C;
  --cat-outro:       #B0A0A0;
```

- [ ] **Verificar build**
```bash
cd apps/web && npm run build 2>&1 | tail -5
```
Esperado: exit 0

- [ ] **Commit**
```bash
git add apps/web/src/index.css
git commit -m "style: add nectarine accent tokens and border variables"
```

---

### Task 2: Atualizar `.glass-card` e adicionar classes globais de animação

- [ ] **Substituir o bloco `.glass-card` existente**

Localizar em `index.css`:
```css
.glass-card {
  background: var(--bg-surface);
  backdrop-filter: blur(var(--blur-glass));
  -webkit-backdrop-filter: blur(var(--blur-glass));
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: var(--shadow-sm);
}
```

Substituir por:
```css
.glass-card {
  background: var(--bg-surface);
  backdrop-filter: blur(var(--blur-glass));
  -webkit-backdrop-filter: blur(var(--blur-glass));
  border: 1px solid var(--border-card);
  box-shadow: 0 2px 8px rgba(215, 137, 127, .07),
              0 1px 2px rgba(215, 137, 127, .04);
}
```

- [ ] **Adicionar no final do arquivo** (antes do último `}` se houver, ou simplesmente append):

```css
/* ── Aura: interação opt-in ── */
.interactive-card {
  transition: transform 250ms cubic-bezier(0.4, 0, 0.6, 1),
              box-shadow 250ms cubic-bezier(0.4, 0, 0.6, 1);
}
.interactive-card:hover  { transform: scale(1.015); }
.interactive-card:active { transform: scale(0.985); }

.btn-aura {
  transition: transform 250ms cubic-bezier(0.4, 0, 0.6, 1),
              background-color 250ms cubic-bezier(0.4, 0, 0.6, 1);
}
.btn-aura:hover:not(:disabled)  { transform: scale(1.03); }
.btn-aura:active:not(:disabled) { transform: scale(0.97); }

/* ── Separadores tonais ── */
hr, .divider {
  border: none;
  border-top: 1px solid var(--border-subtle);
}

/* ── Respeitar preferência do sistema ── */
@media (prefers-reduced-motion: reduce) {
  .interactive-card,
  .btn-aura {
    transition: none !important;
    transform: none !important;
  }
}
```

- [ ] **Verificar build**
```bash
cd apps/web && npm run build 2>&1 | tail -5
```

- [ ] **Commit**
```bash
git add apps/web/src/index.css
git commit -m "style: add interactive-card, btn-aura classes and glass-card tonal shadow"
```

---

## Chunk 2: HomeScreen — Header + Check-in visível

**Files:**
- Modify: `apps/web/src/screens/HomeScreen.tsx`

**Atenção:** O header com "Bom dia / Olá, Maria" no tom Nectarine foi aprovado no mockup — manter exatamente esse visual. Check-in card e gráfico de humor devem aparecer na tela inicial.

### Task 3: Header Nectarine + cards com interactive-card

- [ ] **Leia o arquivo antes de editar**
```bash
wc -l apps/web/src/screens/HomeScreen.tsx
```

- [ ] **Localizar o header da HomeScreen** (buscar por `bg-dark` ou `--bg-dark` ou a cor hex do header)

No elemento do header, trocar a cor de fundo para `var(--accent-9)`:
- Se usar inline style: `style={{ background: 'var(--accent-9)' }}`
- Se usar classe Tailwind com hex: trocar para `bg-[var(--accent-9)]`

- [ ] **Adicionar `interactive-card` nos cards de atalho**

Localizar os cards de atalho (shortcut cards). Adicionar a string `interactive-card` no `className` de cada um. **Não alterar nenhuma outra prop ou handler.**

- [ ] **Verificar que check-in card e gráfico de humor estão visíveis**

Procurar por condicionais como `{showCheckin && ...}` ou `{hasData && ...}` que possam ocultar esses componentes. Se encontrar uma condição que esconde o check-in ou o gráfico sem motivo funcional, remover apenas essa condição de ocultação. **Não alterar a lógica de dados.**

- [ ] **Padronizar ícones do HomeScreen**

Localizar todos os componentes Lucide (ex: `<Calendar`, `<BookOpen`, `<BarChart2`, etc).
Adicionar/substituir `strokeWidth={1.5}` em todos eles.
Manter `size` existente — não alterar.

- [ ] **Verificar build**
```bash
cd apps/web && npm run build 2>&1 | tail -5
```

- [ ] **Commit**
```bash
git add apps/web/src/screens/HomeScreen.tsx
git commit -m "style: HomeScreen nectarine header, interactive-card, icons strokeWidth 1.5"
```

---

## Chunk 3: PlannerScreen + CheckinScreens

**Files:**
- Modify: `apps/web/src/screens/PlannerScreen.tsx`
- Modify: `apps/web/src/screens/CheckinScreen.tsx`
- Modify: `apps/web/src/screens/CheckinResultScreen.tsx`

### Task 4: PlannerScreen — borda 5px colorida por categoria

- [ ] **Leia o arquivo**
```bash
grep -n "catConfig\|borderLeft\|border-left\|cat-" apps/web/src/screens/PlannerScreen.tsx | head -30
```

- [ ] **Localizar o objeto `catConfig`** (ou similar) que define cor por categoria

Exemplo do que está lá:
```ts
const catConfig: Record<string, { color: string; ... }> = {
  trabalho:    { color: '#6398A9', ... },
  pessoal:     { color: '#B8A0C8', ... },
  ...
}
```

Trocar cada `color: '#XXXXXX'` pelo token CSS correspondente usando `getComputedStyle` ou diretamente pelo mapeamento. A forma mais simples e segura — trocar o valor usado no `borderLeft` inline:

Para cada bloco de timeline que renderiza `borderLeft: \`3px solid ${catConfig[block.category].color}\``, atualizar para:
```ts
borderLeft: `5px solid var(--cat-${block.category}, ${catConfig[block.category].color})`
```

Isso usa o token CSS se existir, e faz fallback para a cor antiga se não — zero risco.

- [ ] **Adicionar `interactive-card` nos blocos de timeline**

Localizar o `className` do componente `TimelineBlock` ou do container do bloco. Adicionar `interactive-card`.

- [ ] **Padronizar ícones do PlannerScreen**

Adicionar `strokeWidth={1.5}` em todos os ícones Lucide. Manter `size` existente.

- [ ] **Botão "Remover"**: apenas cor — sem mudar estrutura

Localizar o botão de remover bloco. Garantir que a cor do ícone/texto usa `var(--accent-9)` ou `#D7897F`. Manter label e `onClick` intocados.

- [ ] **Verificar build**
```bash
cd apps/web && npm run build 2>&1 | tail -5
```

- [ ] **Commit**
```bash
git add apps/web/src/screens/PlannerScreen.tsx
git commit -m "style: PlannerScreen border-left 5px tonal, interactive-card, icons 1.5"
```

---

### Task 5: CheckinScreen e CheckinResultScreen

- [ ] **CheckinScreen — inputs e botão CTA**

Em `CheckinScreen.tsx`:
- Inputs/sliders: adicionar `style={{ outlineColor: 'var(--accent-9)' }}` no `onFocus` ou via CSS class
- Botão CTA principal: adicionar `btn-aura` ao `className`, trocar cor de fundo para `var(--accent-9)`
- Ícones: `strokeWidth={1.5}` em todos

- [ ] **CheckinResultScreen — cards e ícones**

Em `CheckinResultScreen.tsx`:
- Cards de resultado: adicionar `interactive-card` ao `className`
- Ícones de estado (leve/moderado/etc.): `strokeWidth={1.5}`, manter cores `--state-*`

- [ ] **Verificar build**
```bash
cd apps/web && npm run build 2>&1 | tail -5
```

- [ ] **Commit**
```bash
git add apps/web/src/screens/CheckinScreen.tsx apps/web/src/screens/CheckinResultScreen.tsx
git commit -m "style: CheckinScreens nectarine CTA, interactive-card, icons 1.5"
```

---

## Chunk 4: InsightsScreen + JournalScreen + ObjectivesScreen

**Files:**
- Modify: `apps/web/src/screens/InsightsScreen.tsx`
- Modify: `apps/web/src/screens/JournalScreen.tsx`
- Modify: `apps/web/src/screens/ObjectivesScreen.tsx`

### Task 6: InsightsScreen

- [ ] **Ler arquivo e localizar cards e gráficos**
```bash
grep -n "className\|strokeWidth\|color.*#\|background" apps/web/src/screens/InsightsScreen.tsx | head -30
```

- [ ] **Cards**: adicionar `interactive-card`
- [ ] **Gráficos/SVG**: trocar cor de destaque por `var(--accent-9)`
- [ ] **Ícones**: `strokeWidth={1.5}`
- [ ] **Build + commit**
```bash
cd apps/web && npm run build 2>&1 | tail -3
git add apps/web/src/screens/InsightsScreen.tsx
git commit -m "style: InsightsScreen interactive-card, nectarine charts, icons 1.5"
```

---

### Task 7: JournalScreen — bolhas de chat

- [ ] **Localizar bolhas de mensagem IA e usuário**
```bash
grep -n "message\|bubble\|bot\|user\|role\|border-radius\|rounded" apps/web/src/screens/JournalScreen.tsx | head -30
```

- [ ] **Bolhas IA**: `background: 'var(--accent-surface)'`, `borderRadius: 18`
- [ ] **Bolhas usuário**: `background: 'var(--accent-9)'`, `color: '#fff'`, `borderRadius: 18`
- [ ] **Input de texto**: adicionar `style={{ borderColor: 'var(--border-interactive)' }}`, foco `var(--accent-9)`
- [ ] **Ícone de envio**: `strokeWidth={1.5}`, cor `var(--accent-9)`
- [ ] **Build + commit**
```bash
cd apps/web && npm run build 2>&1 | tail -3
git add apps/web/src/screens/JournalScreen.tsx
git commit -m "style: JournalScreen tonal bubbles, nectarine send icon"
```

---

### Task 8: ObjectivesScreen

- [ ] **Cards de objetivo**: `interactive-card`, `borderLeft: '4px solid var(--cat-trabalho)'` (ou a cor da categoria do objetivo se disponível)
- [ ] **Botão add/CTA**: `btn-aura`, `var(--accent-9)`
- [ ] **Ícones**: `strokeWidth={1.5}`
- [ ] **Build + commit**
```bash
cd apps/web && npm run build 2>&1 | tail -3
git add apps/web/src/screens/ObjectivesScreen.tsx
git commit -m "style: ObjectivesScreen interactive-card, nectarine CTA, icons 1.5"
```

---

## Chunk 5: Telas de Suporte (Pomodoro, Config, Auth, Onboarding, HarmonyCircle, DailySummary)

**Files:**
- Modify: `apps/web/src/screens/PomodoroScreen.tsx`
- Modify: `apps/web/src/screens/ConfigScreen.tsx`
- Modify: `apps/web/src/screens/AuthScreen.tsx`
- Modify: `apps/web/src/screens/OnboardingScreen.tsx`
- Modify: `apps/web/src/screens/HarmonyCircleScreen.tsx`
- Modify: `apps/web/src/screens/DailySummaryScreen.tsx`

### Task 9: PomodoroScreen

- [ ] **Timer SVG**: localizar o círculo de progresso, trocar `stroke` por `var(--accent-9)`
- [ ] **Botões play/pause/stop**: `btn-aura`, `background: 'var(--accent-9)'`
- [ ] **Ícones**: `strokeWidth={1.5}`
- [ ] **Build + commit**
```bash
cd apps/web && npm run build 2>&1 | tail -3
git add apps/web/src/screens/PomodoroScreen.tsx
git commit -m "style: PomodoroScreen nectarine timer and controls"
```

---

### Task 10: ConfigScreen

- [ ] **Toggles ativos**: cor `var(--accent-9)` no estado `checked`
- [ ] **Separadores entre seções**: adicionar classe `divider` ou `style={{ borderTop: '1px solid var(--border-subtle)' }}`
- [ ] **Ícones de seção**: `strokeWidth={1.5}`
- [ ] **Build + commit**
```bash
cd apps/web && npm run build 2>&1 | tail -3
git add apps/web/src/screens/ConfigScreen.tsx
git commit -m "style: ConfigScreen nectarine toggles, tonal dividers"
```

---

### Task 11: AuthScreen

- [ ] **Botão "Entrar e continuar"**: `btn-aura`, `background: 'var(--accent-9)'`, `boxShadow: '0 4px 14px rgba(215,137,127,.35)'`
- [ ] **Inputs**: `style={{ borderColor: 'var(--border-interactive)' }}` no estado padrão
- [ ] **Ícones**: `strokeWidth={1.5}`
- [ ] **Build + commit**
```bash
cd apps/web && npm run build 2>&1 | tail -3
git add apps/web/src/screens/AuthScreen.tsx
git commit -m "style: AuthScreen nectarine CTA with tonal shadow"
```

---

### Task 12: OnboardingScreen

- [ ] **Botões de navegação (próximo/pular/concluir)**: `btn-aura`, `var(--accent-9)`
- [ ] **Step indicators (dots)**: cor ativa `var(--accent-9)`
- [ ] **Ícones**: `strokeWidth={1.5}`
- [ ] **Build + commit**
```bash
cd apps/web && npm run build 2>&1 | tail -3
git add apps/web/src/screens/OnboardingScreen.tsx
git commit -m "style: OnboardingScreen nectarine nav and step dots"
```

---

### Task 13: HarmonyCircleScreen e DailySummaryScreen

- [ ] **HarmonyCircleScreen**:
  - Segmentos SVG: adicionar `style={{ transition: 'opacity 200ms ease' }}` no container/grupo
  - Botões de ação: `btn-aura`, `var(--accent-9)`
  - Ícones: `strokeWidth={1.5}`

- [ ] **DailySummaryScreen**:
  - Cards: `interactive-card`
  - Números/métricas de destaque: `style={{ color: 'var(--accent-9)' }}`
  - Ícones: `strokeWidth={1.5}`

- [ ] **Build + commit**
```bash
cd apps/web && npm run build 2>&1 | tail -3
git add apps/web/src/screens/HarmonyCircleScreen.tsx apps/web/src/screens/DailySummaryScreen.tsx
git commit -m "style: HarmonyCircle and DailySummary nectarine refinement"
```

---

## Chunk 6: Verificação Final

### Task 14: Smoke test visual e checklist de aceite

- [ ] **Build limpo**
```bash
cd apps/web && npm run build
```
Esperado: exit 0, zero erros TypeScript

- [ ] **Confirmar zero mudanças em stores e lib**
```bash
git diff HEAD~20 -- apps/web/src/stores/ apps/web/src/lib/
```
Esperado: nenhuma linha alterada

- [ ] **Confirmar tokens no CSS**
```bash
grep "accent-9\|border-card\|interactive-card\|btn-aura" apps/web/src/index.css
```
Esperado: todas as 4 strings presentes

- [ ] **Confirmar strokeWidth nos ícones**
```bash
grep -r "strokeWidth" apps/web/src/screens/ | grep -v "1\.5" | grep -v "node_modules"
```
Esperado: zero linhas (todos os ícones já usam 1.5)

- [ ] **Confirmar borda 5px no Planner**
```bash
grep "5px\|border-left" apps/web/src/screens/PlannerScreen.tsx | head -5
```
Esperado: referências a 5px

- [ ] **Commit final**
```bash
git add -A
git commit -m "style: Aura visual refinement complete — nectarine accent, tonal borders, icon stroke 1.5"
```

---

## Ordem de Execução Paralela

Os chunks 3, 4 e 5 são **independentes entre si** e podem ser executados em paralelo após o chunk 1 (CSS foundation) estar commitado:

```
Chunk 1 (CSS) → base para todos
Chunk 2 (HomeScreen) → independente de 3/4/5
Chunk 3 (Planner + Checkin) → paralelo com 2/4/5
Chunk 4 (Insights + Journal + Objectives) → paralelo com 2/3/5
Chunk 5 (Suporte) → paralelo com 2/3/4
Chunk 6 (Verificação) → após todos concluídos
```
