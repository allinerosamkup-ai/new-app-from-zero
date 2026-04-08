# Plano: Finalizar Mood Energy — Metas, Planner, Harmonia

**Data:** 2026-03-22
**Status:** Em execução

## Context
Registro histórico: o app tinha 13 telas visuais sob o sistema Aura v2, hoje já substituído pela linguagem editorial clean atual. Blocos 1-4 do plano anterior já foram executados parcialmente: store expandido com `checkinHistory` + `addCheckin`, check-in flow funcional, Insights/Harmony/DailySummary/Pomodoro conectados ao store, back buttons adicionados. **Porém**, o usuário identificou 7 problemas críticos que precisam ser resolvidos agora:

1. **GoalsPage mostra TASKS em vez de METAS** — usa `state.tasks` e `toggleTask` quando deveria mostrar `state.goals` com subtarefas
2. **FAB "+ Novo bloco" no Planner não faz nada** — falta onClick handler
3. **Calendário mensal deve ser popup/modal**, não inline toggle
4. **Ícone do calendário** (📅 emoji) inconsistente com design system — usar SVG/Lucide
5. **Harmony/Radar deve medir cumprimento de METAS**, não só check-ins
6. **Drag-and-drop** falta no Planner
7. **PRD review** — docs/ revisado integralmente, gaps identificados abaixo

## Achados da Revisão do PRD (`docs/`)

Documentos revisados: `00-estrategia-geral.md` até `06-pacote-acoes.md`, `product/api-contracts.md`, 12 planos em `plans/`, 2 specs em `superpowers/`.

**Gaps relevantes entre PRD e implementação atual:**
- PRD define 5-6 dimensões de check-in (humor, energia, clareza, irritabilidade, físico) — app atual tem só 2 (humor, energia) + emoção ← **OK para MVP, expandir depois**
- PRD pede 3 check-ins/dia (manhã, meio-dia, noite) — app atual faz 1 por vez ← **Backend suporta, frontend não diferencia slots**
- PRD define drag-and-drop no Planner como P0 ← **Falta implementar**
- PRD define "Objetivos + sub-metas" como módulo completo ← **Goal type precisa expandir**
- PRD define replanejamento por IA baseado em energia ← **Fase futura, mas estrutura deve permitir**
- Weekly insights UI existe mas com dados do store local ← **OK para agora**

---

## Plano de Execução (6 blocos)

### Bloco 1 — Expandir Goal type + store actions
**Arquivos:** `types.ts` + `data.ts` + `store.tsx`

Expandir `Goal`:
```ts
export type SubGoal = {
  id: number;
  title: string;
  done: boolean;
};

export type Goal = {
  id: number;
  title: string;
  progress: string;     // label descritivo (mantém compatibilidade)
  subtasks: SubGoal[];   // NOVO: sub-metas rastreáveis
  completedPct: number;  // NOVO: 0-100, calculado das subtasks
};
```

Expandir `initialGoals` em `data.ts` com subtasks reais.

Novas ações no store:
```ts
addGoal: (title: string) => void;
toggleSubGoal: (goalId: number, subGoalId: number) => void;
removeGoal: (goalId: number) => void;
addTask: (title: string, time: string) => void;
reorderTasks: (fromIdx: number, toIdx: number) => void;
```

### Bloco 2 — Rebuild GoalsPage para METAS
**Arquivo:** `routes/goals-page.tsx`
- Ler `state.goals` (não `state.tasks`)
- Subtasks com checkboxes, progress bars, link para Harmonia

### Bloco 3 — Conectar Harmony ao progresso de Metas
**Arquivo:** `routes/harmony-page.tsx`
- Dimensão "Metas" no radar baseada em `state.goals.completedPct`
- Link bidirecional Goals ↔ Harmony

### Bloco 4 — Planner: FAB + calendário popup + ícone SVG + drag-drop
**Arquivo:** `routes/planner-page.tsx`

### Bloco 5 — Store: addTask + reorderTasks
**Arquivo:** `store.tsx`

### Bloco 6 — Navegação bidirecional Goals ↔ Harmony

---

## Arquivos a Modificar

| Arquivo | Bloco | Mudança |
|---------|-------|---------|
| `features/aura/types.ts` | 1 | Expandir Goal com SubGoal + completedPct |
| `features/aura/data.ts` | 1 | initialGoals com subtasks reais |
| `features/aura/store.tsx` | 1,5 | addGoal, toggleSubGoal, removeGoal, addTask, reorderTasks |
| `routes/goals-page.tsx` | 2 | Rebuild: state.goals + subtasks + link harmony |
| `routes/harmony-page.tsx` | 3 | Dimensão "Metas" do goals + link goals |
| `routes/planner-page.tsx` | 4 | FAB form, calendar popup, SVG icon, drag-drop |

---

## Verificação

1. Goals: `/goals` → mostra METAS com subtasks clicáveis
2. Harmony: `/harmony` → radar inclui dimensão "Metas"
3. Planner FAB: form funcional para criar blocos
4. Planner calendário: popup modal com grid mensal
5. Planner drag-drop: reordenação visual de timeline blocks
6. Fluxo completo: Checkin → Result → Home → Goals → Harmony
