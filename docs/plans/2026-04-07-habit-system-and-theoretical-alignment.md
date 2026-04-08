# Implementation Plan: Habit System & Theoretical Alignment (Mood & Energy Cycling)

**Goal:** Implementar o sistema de hábitos (Habit Tracker) e alinhar a inteligência da Aura com embasamento teórico robusto (TCC, Duhigg, Pennebaker, Thaler), conforme o planejamento `mudanças app .md`.

**Architecture:** 
- **Database:** Adição de modelos `Habit` e `HabitCompletion` no Prisma.
- **Backend:** `HabitService` para lógica de recorrência e streaks. `InsightService` atualizado para correlações de Pearson.
- **AI:** Atualização do `aura-prompt.ts` com diretrizes teóricas explícitas.
- **Frontend:** Exposição dos hábitos na Home e aba dedicada.

---

### Task 1: Atualização do Schema Database

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

**Step 1: Adicionar modelos Habit e HabitCompletion**
- `Habit`: title, category, frequency (daily, weekly, monthly), targetDays, userId.
- `HabitCompletion`: habitId, date, completed.

**Step 2: Executar migration**
- `npx prisma migrate dev --name add_habits`

---

### Task 2: Alinhamento Teórico nos Prompts da Aura

**Files:**
- Modify: `apps/backend/src/lib/aura-prompt.ts`

**Step 1: Injetar embasamento teórico**
- Adicionar referências a Pennebaker (Escrita Expressiva) no domínio `journal`.
- Adicionar Charles Duhigg (Habit Loop) e Thaler (Nudge) no domínio `planning`.
- Refinar o tom "Nectarine" com essas diretrizes.

---

### Task 3: Implementação do HabitService

**Files:**
- Create: `apps/backend/src/services/habit.service.ts`

**Lógica:**
- CRUD de hábitos.
- Registro de conclusão (toggle).
- Cálculo de streaks (atual e melhor).
- Filtro de hábitos para "Hoje" baseado em frequência e targetDays.

---

### Task 4: Upgrade do InsightService (Correlações)

**Files:**
- Modify: `apps/backend/src/services/insight.service.ts`

**Lógica:**
- Implementar cálculo de correlação entre conclusão de hábitos e pontuação de humor/energia.
- Expor "Descobertas" (ex: "Sempre que você medita, seu humor sobe 20%").

---

### Task 5: Endpoints de API

**Files:**
- Modify: `apps/backend/src/index.ts`

**Novas rotas:**
- `GET /api/habits`: Lista hábitos ativos para hoje.
- `POST /api/habits`: Cria novo hábito.
- `PATCH /api/habits/:id`: Atualiza ou arquiva hábito.
- `POST /api/habits/:id/toggle`: Registra conclusão.

---

### Task 6: Mock-to-React / Mobile UI (Acompanhamento)

**Files:**
- Modify: `apps/web/src/routes/home-page.tsx` (ou similar)
- Modify: `apps/mobile/src/presentation/screens/HomeScreen.tsx`

**UI:**
- Adicionar seção "Hábitos de Hoje".
- Integrar com o novo `HabitService`.

---

**Validação:**
- Testes unitários para `HabitService` (streaks).
- Testes de integração para as novas rotas.
- Verificação visual dos novos prompts (logs do backend).
