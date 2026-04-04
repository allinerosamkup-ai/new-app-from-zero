# Aura Visual Refinement — Design Spec (v3)
**Data:** 2026-03-18
**Projeto:** Mood Energy (`apps/web`)
**Escopo:** Todas as 13 telas — **apenas refinamento visual, zero mudança funcional ou de layout**

---

## 1. Premissa

O objetivo é elegância de detalhe, não reestruturação. Três eixos de melhoria:

1. **Cor** — trocar accent primário de `--lagune` (#6398A9) para `--nectarine` (#D7897F)
2. **Linhas** — bordas mais finas, sutis e tonais; separadores leves
3. **Ícones** — stroke consistente `1.5px`, tamanho uniforme `20px`, cor semântica

Tamanhos de card, grids, fontes e layouts **não mudam** salvo onde explicitamente indicado abaixo.

---

## 2. Token Map — `src/index.css`

### 2.1 Cor accent: Nectarine

```css
:root {
  /* Accent primário → Nectarine */
  --accent-9:        #D7897F;
  --accent-10:       #C46B60;
  --accent-11:       #A8544A;
  --accent-surface:  rgba(215, 137, 127, .09);

  /* Categorias do Planner — cobre todas as 5 usadas no catConfig */
  --cat-trabalho:    #6398A9;
  --cat-pessoal:     #B8A0C8;
  --cat-autocuidado: #96C7B3;
  --cat-social:      #F9B95C;
  --cat-outro:       #B0A0A0;
}
```

Tokens consumidos via `var(--accent-9)` em inline styles existentes e `bg-[var(--accent-9)]` em classes arbitrárias. `tailwind.config.js` não é alterado.

### 2.2 Linhas e bordas

```css
/* Substituir bordas opacas por tonais em todo o app */
--border-subtle:      rgba(215, 137, 127, .10);
--border-interactive: rgba(215, 137, 127, .22);
--border-card:        rgba(255, 255, 255, .65);

/* glass-card: borda levemente mais visível, sombra tonal */
.glass-card {
  border: 1px solid var(--border-card);
  box-shadow: 0 2px 8px rgba(215, 137, 127, .07),
              0 1px 2px rgba(215, 137, 127, .04);
}

/* Separadores horizontais */
hr, .divider {
  border: none;
  border-top: 1px solid var(--border-subtle);
}
```

### 2.3 Blocos do Planner — borda lateral colorida

```css
/* era 3px → 5px para dar ponto de cor visível */
.timeline-block {
  border-left-width: 5px;
}
```

Cor da borda via `var(--cat-{categoria})` — substituir hex inline no `catConfig` do PlannerScreen.

### 2.4 Animações opt-in

```css
.interactive-card {
  transition: transform 250ms cubic-bezier(0.4, 0, 0.6, 1),
              box-shadow 250ms cubic-bezier(0.4, 0, 0.6, 1);
}
.interactive-card:hover  { transform: scale(1.015); }
.interactive-card:active { transform: scale(0.985); }

.btn-aura {
  transition: transform 250ms cubic-bezier(0.4, 0, 0.6, 1);
}
.btn-aura:hover:not(:disabled)  { transform: scale(1.03); }
.btn-aura:active:not(:disabled) { transform: scale(0.97); }

@media (prefers-reduced-motion: reduce) {
  .interactive-card, .btn-aura {
    transition: none !important;
    transform: none !important;
  }
}
```

---

## 3. Ícones — regra universal para todas as telas

Toda ocorrência de `<LucideIcon>` recebe:
- `size={20}` (se não tiver tamanho específico de contexto — ex: ícone nav usa `22px`)
- `strokeWidth={1.5}` (era misto entre 1.5 e 2)
- Cor: `var(--accent-9)` para ícones de ação primária, `var(--text-muted)` para ícones de suporte

Não criar novos ícones nem trocar quais ícones são usados — apenas padronizar `size` e `strokeWidth`.

---

## 4. Mudanças por Tela

> Layout, grid, tamanho de card e hierarquia de texto: **não mudam**.
> Cada tela recebe: cor accent atualizada + bordas tonais + ícones padronizados + `interactive-card`/`btn-aura` nos elementos interativos.

### HomeScreen (`home`) — atenção especial
- Header: cor de fundo `var(--accent-9)` (nectarine) — **manter exatamente como ficou no mockup aprovado**
- **Check-in card e gráfico de humor**: garantir que estão visíveis no scroll inicial — se estiverem ocultos por alguma condição, remover a ocultação (sem alterar a lógica de dados)
- Cards de atalho: `interactive-card` + bordas `var(--border-card)`
- Botão de check-in CTA: `btn-aura` + `var(--accent-9)`
- Atalhos mantêm o layout atual (grid existente) — não alterar número de colunas

### PlannerScreen (`planner`)
- Blocos: `border-left: 5px solid var(--cat-{categoria})`
- Blocos: `interactive-card`
- Botão "Remover": manter label + comportamento, apenas cor `var(--accent-9)` ghost/outline

### CheckinScreen (`checkin`)
- Inputs: `border: 1px solid var(--border-interactive)`, foco `outline: 2px solid var(--accent-9)`
- Botão CTA: `btn-aura` + `var(--accent-9)`
- Ícones: padronizar `strokeWidth={1.5}`

### CheckinResultScreen (`checkin-result`)
- Cards: `interactive-card`, sombra tonal
- Ícones de estado: `strokeWidth={1.5}`

### InsightsScreen (`insights`)
- Cards: `interactive-card`
- Gráficos: cor de destaque `var(--accent-9)`
- Ícones: `strokeWidth={1.5}`

### JournalScreen (`journal`)
- Bolhas IA: bg `var(--accent-surface)`, `border-radius: 18px`
- Bolhas usuário: bg `var(--accent-9)`, texto branco, `border-radius: 18px`
- Input: `border: 1px solid var(--border-interactive)`, foco `var(--accent-9)`
- Ícone enviar: `strokeWidth={1.5}`, cor `var(--accent-9)`

### ObjectivesScreen (`objectives`)
- Cards: `interactive-card`, borda left `4px var(--cat-*)`
- Botão add: `btn-aura` + `var(--accent-9)`
- Ícones: `strokeWidth={1.5}`

### PomodoroScreen (`pomodoro`)
- Timer SVG stroke: `var(--accent-9)`
- Botões play/pause/stop: `btn-aura` + `var(--accent-9)`
- Ícones: `strokeWidth={1.5}`

### ConfigScreen (`config`)
- Toggles: cor ativa `var(--accent-9)`
- Separadores: `border-top: 1px solid var(--border-subtle)`
- Ícones de seção: `strokeWidth={1.5}`

### AuthScreen (`auth`)
- Botão "Entrar e continuar": `btn-aura` + `var(--accent-9)` + `box-shadow: 0 4px 14px rgba(215,137,127,.35)`
- Inputs: `border: 1px solid var(--border-interactive)`, foco `var(--accent-9)`

### OnboardingScreen (`onboarding`)
- Botões navegação: `btn-aura` + `var(--accent-9)`
- Step dots: cor ativa `var(--accent-9)`
- Ícones: `strokeWidth={1.5}`

### HarmonyCircleScreen (`harmony-circle`)
- Segmentos SVG: `transition: opacity 200ms ease` no hover
- Botões: `btn-aura` + `var(--accent-9)`

### DailySummaryScreen (`daily-summary`)
- Cards: `interactive-card`
- Métricas de destaque: `color: var(--accent-9)`
- Ícones: `strokeWidth={1.5}`

---

## 5. O que NÃO muda

- Nenhum store Zustand, nenhuma chamada de API, nenhuma rota de navegação
- Grids, layouts, tamanhos de card, hierarquia tipográfica
- Fontes (Poppins + Inter), `tailwind.config.js`
- Funcionalidades de SSE, Supabase, Pomodoro, check-in

---

## 6. Critérios de Aceite

- [ ] `npm run build` em `apps/web` termina exit 0
- [ ] Cor `#D7897F` visível em botões primários e headers em todas as 13 telas
- [ ] Hover `scale` funcionando em cards (`.interactive-card`) e botões (`.btn-aura`)
- [ ] `prefers-reduced-motion` desativa transitions (DevTools > Rendering)
- [ ] Blocos do Planner com `border-left: 5px` colorido por categoria
- [ ] Check-in card e gráfico de humor visíveis na HomeScreen
- [ ] Todos os ícones com `strokeWidth={1.5}`
- [ ] `git diff apps/web/src/stores/ apps/web/src/lib/` — zero mudanças
