# Guided Onboarding and Routine System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fazer a Airia criar o primeiro dia e uma base semanal por meio de escolhas visuais, integrando hábitos, objetivos, metas e tarefas sem exigir texto ou documento.

**Architecture:** O `RoutineBuildSession` existente continua como única sessão transacional de criação em lote. Uma nova entrada `guided` converte respostas estruturadas em candidatos e reutiliza composição, prévia e aplicação já existentes; a importação de texto/arquivo torna-se um caminho secundário. As páginas de Hábitos, Objetivos e Planner operam sobre as mesmas entidades persistidas e recebem uma camada visual mais simples, sem criar armazenamentos paralelos.

**Tech Stack:** TypeScript, React 18, Vite, React Router, Fastify/Express compatibility layer, Zod, Prisma/PostgreSQL/Supabase, OpenAI structured output apenas para texto livre, JSON i18n, Node test runner.

---

### Task 1: Contrato da entrada guiada

**Files:**
- Modify: `apps/backend/src/contracts/routine-builder.contract.ts`
- Modify: `apps/backend/src/contracts/routine-builder.contract.test.ts`
- Modify: `apps/web/src/features/routine-builder/types.ts`

**Step 1: Escrever testes que falham**

Adicionar casos para um payload estruturado sem texto:

```typescript
const guided = RoutineGuidedAnswersSchema.parse({
  lifeAreas: ['work', 'home'],
  availability: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }],
  energyDrains: ['meetings'],
  energyRestorers: ['walking'],
  intentions: ['sleep_better'],
  selectedHabits: [{
    templateId: 'evening-wind-down',
    title: 'Preparar o sono',
    frequency: 'weekly',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    timeOfDay: 'evening',
    durationMinutes: 15,
  }],
  currentState: { mood: 5, energy: 4, focus: 4, sleepQuality: 'irregular' },
});
assert.equal(guided.selectedHabits[0].durationMinutes, 15);
```

Testar também:

- rejeição de dias fora de `0..6`;
- rejeição de janela com fim anterior ao início;
- deduplicação/limite de seleções;
- `freeText` opcional;
- criação de sessão com `mode: 'guided'` e sem `focus` digitado.

**Step 2: Rodar o teste e confirmar falha**

Run:

```powershell
cd apps/backend
npx ts-node --transpile-only src/contracts/routine-builder.contract.test.ts
```

Expected: FAIL porque `RoutineGuidedAnswersSchema` ainda não existe.

**Step 3: Implementar os schemas**

Adicionar:

```typescript
export const RoutineBuilderModeSchema = z.enum(['guided', 'import']);

export const RoutineGuidedHabitSchema = z.object({
  templateId: z.string().trim().min(1).max(80),
  title: z.string().trim().min(3).max(120),
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  timesPerWeek: z.number().int().min(1).max(7).nullable().optional(),
  timeOfDay: z.enum(['morning', 'afternoon', 'evening', 'anytime']),
  durationMinutes: z.number().int().min(5).max(180),
});
```

Completar `RoutineGuidedAnswersSchema` com áreas da vida, disponibilidade, compromissos fixos, fontes de desgaste/recuperação, intenções, hábitos e estado atual. Estender `RoutineCreateSessionSchema` com `mode` e tornar `focus` opcional somente quando `mode === 'guided'`.

**Step 4: Espelhar os tipos no frontend**

Adicionar `GuidedRoutineAnswers`, `GuidedHabitChoice`, `GuidedFixedCommitment` e `RoutineBuilderMode` sem duplicar enums em componentes.

**Step 5: Rodar testes e commit**

Run:

```powershell
cd apps/backend
npx ts-node --transpile-only src/contracts/routine-builder.contract.test.ts
```

Expected: PASS.

Commit:

```powershell
git add apps/backend/src/contracts/routine-builder.contract.ts apps/backend/src/contracts/routine-builder.contract.test.ts apps/web/src/features/routine-builder/types.ts
git commit -m "feat(routine): define guided setup contracts"
```

### Task 2: Biblioteca determinística de escolhas

**Files:**
- Create: `apps/web/src/features/routine-builder/guided-options.ts`
- Create: `apps/web/src/features/routine-builder/guided-options.test.ts`
- Create: `apps/backend/src/lib/guided-routine-catalog.ts`
- Create: `apps/backend/src/lib/guided-routine-catalog.test.ts`
- Modify: `apps/backend/package.json`

**Step 1: Escrever testes que falham**

Exigir:

- pelo menos oito categorias de desgaste/recuperação;
- pelo menos dez categorias de hábitos;
- IDs estáveis e únicos;
- rótulos traduzíveis;
- duração, período e recorrência padrão válidos;
- correspondência entre os IDs aceitos no frontend e backend.

```typescript
assert.ok(HABIT_TEMPLATES.length >= 24);
assert.equal(new Set(HABIT_TEMPLATES.map((item) => item.id)).size, HABIT_TEMPLATES.length);
assert.ok(HABIT_TEMPLATES.every((item) => item.durationMinutes >= 5));
```

**Step 2: Confirmar a falha por módulos ausentes**

Run:

```powershell
cd apps/backend
npx ts-node --transpile-only src/lib/guided-routine-catalog.test.ts
```

**Step 3: Implementar catálogos**

Criar IDs neutros para:

- áreas da vida;
- fontes de desgaste;
- fontes de recuperação;
- intenções;
- hábitos sugeridos;
- períodos e frequências.

Não colocar nomenclatura metodológica nem diagnóstico nos rótulos.

**Step 4: Adicionar os testes ao comando oficial**

Incluir o teste backend em `test:routine` e `test`. O teste frontend entra no comando de testes web existente.

**Step 5: Rodar e commit**

Commit:

```powershell
git add apps/web/src/features/routine-builder/guided-options.ts apps/web/src/features/routine-builder/guided-options.test.ts apps/backend/src/lib/guided-routine-catalog.ts apps/backend/src/lib/guided-routine-catalog.test.ts apps/backend/package.json
git commit -m "feat(routine): add guided choice catalog"
```

### Task 3: Transformação guiada em itens operacionais

**Files:**
- Create: `apps/backend/src/services/guided-routine.service.ts`
- Create: `apps/backend/src/services/guided-routine.service.test.ts`
- Modify: `apps/backend/src/services/routine-builder.service.ts`
- Modify: `apps/backend/src/services/routine-builder.service.test.ts`

**Step 1: Escrever testes que falham**

Cobrir:

1. hábito selecionado vira `kind: 'habit'` com recorrência correta;
2. compromisso fixo vira `kind: 'calendar'` com `isFixed: true`;
3. intenção ampla vira `kind: 'goal'`, não tarefa solta;
4. uma próxima ação sugerida para a intenção vira `task` ligada por `parentItemId`;
5. seleções repetidas são deduplicadas;
6. nenhum texto/documento é necessário;
7. estado atual entra em `constraints`, não vira tarefa.

```typescript
const result = GuidedRoutineService.buildItems(answers);
assert.equal(result.items.find((item) => item.title === 'Trabalho')?.kind, 'calendar');
assert.equal(result.items.find((item) => item.title === 'Preparar o sono')?.kind, 'habit');
```

**Step 2: Rodar e confirmar falha**

Run:

```powershell
cd apps/backend
npx ts-node --transpile-only src/services/guided-routine.service.test.ts
```

**Step 3: Implementar transformação determinística**

Usar o catálogo para escolhas conhecidas. Usar o classificador com saída estruturada somente quando `otherText` ou uma intenção livre precisar ser separada em objetivo, projeto, tarefa ou hábito.

Cada item guiado deve registrar evidência legível:

```typescript
sourceExcerpt: `Escolha guiada: ${label}`,
confidence: 1,
classificationReason: 'Escolha confirmada no montador guiado',
reviewState: 'confirmed',
```

**Step 4: Adicionar `submitGuidedAnswers` ao serviço**

O método deve:

- validar pertencimento e estado `draft`;
- salvar `sourceType: 'guided'`;
- guardar respostas estruturadas em `constraints`;
- persistir itens;
- calcular esclarecimentos bloqueantes;
- avançar para `ready` ou `needs_clarification`;
- registrar evento sem dados sensíveis brutos.

**Step 5: Rodar suíte de rotina e commit**

Run:

```powershell
cd apps/backend
npm run test:routine
```

Commit:

```powershell
git add apps/backend/src/services/guided-routine.service.ts apps/backend/src/services/guided-routine.service.test.ts apps/backend/src/services/routine-builder.service.ts apps/backend/src/services/routine-builder.service.test.ts
git commit -m "feat(routine): build plans from guided answers"
```

### Task 4: Endpoint guiado e erros específicos

**Files:**
- Modify: `apps/backend/src/routes/routine-builder.routes.ts`
- Modify: `apps/backend/src/routes/routine-builder.routes.test.ts`
- Modify: `apps/web/src/features/routine-builder/api.ts`

**Step 1: Escrever testes de rota que falham**

Adicionar casos para:

- `POST /sessions/:id/guided`;
- autenticação;
- pertencimento;
- payload inválido com `details`;
- segunda submissão retornando conflito específico;
- sessão recuperável após erro;
- ausência de `validation_failed` sem detalhes.

**Step 2: Confirmar falha**

Run:

```powershell
cd apps/backend
npx ts-node --transpile-only src/routes/routine-builder.routes.test.ts
```

**Step 3: Implementar a rota**

```typescript
router.post('/sessions/:sessionId/guided', heavyOperationLimiter, asyncRoute(async (req, res) => {
  const answers = RoutineGuidedAnswersSchema.parse(req.body);
  res.json(await dependencies.service.submitGuidedAnswers({
    userId: userId(req),
    sessionId: req.params.sessionId,
    answers,
  }));
}));
```

Incluir `submitGuidedAnswers` no tipo de dependências.

**Step 4: Implementar cliente web**

```typescript
submitGuided(sessionId: string, answers: GuidedRoutineAnswers) {
  return api.post(`${base}/${sessionId}/guided`, answers) as Promise<RoutineSession>;
}
```

**Step 5: Rodar e commit**

Commit:

```powershell
git add apps/backend/src/routes/routine-builder.routes.ts apps/backend/src/routes/routine-builder.routes.test.ts apps/web/src/features/routine-builder/api.ts
git commit -m "feat(routine): expose guided routine endpoint"
```

### Task 5: Estado do onboarding sem texto obrigatório

**Files:**
- Modify: `apps/web/src/features/aura/onboarding.ts`
- Modify: `apps/web/src/features/aura/onboarding.test.ts`
- Modify: `apps/backend/src/contracts/onboarding.contract.ts`
- Modify: `apps/backend/src/contracts/onboarding.contract.test.ts`
- Modify: `apps/backend/src/index.onboarding.test.ts`

**Step 1: Escrever testes que falham**

Exigir que:

- `routineText` e `currentFeeling` não sejam obrigatórios;
- respostas estruturadas gerem resumos de compatibilidade;
- nome ausente use nome do perfil;
- “Outro” vazio seja descartado;
- seleções e horários sobrevivam a avançar/voltar;
- refazer onboarding limpe somente o rascunho, não hábitos e agenda existentes.

**Step 2: Confirmar as falhas**

Run:

```powershell
cd apps/web
npm test -- onboarding.test.ts
```

**Step 3: Estender `OnboardingDraft`**

Adicionar:

```typescript
lifeAreas: string[];
availability: GuidedAvailability[];
fixedCommitments: GuidedFixedCommitment[];
energyDrains: string[];
energyRestorers: string[];
intentions: string[];
selectedHabits: GuidedHabitChoice[];
currentState: { mood: number; energy: number; focus: number; sleepQuality: string };
```

Manter `routineText` opcional apenas para compatibilidade. `buildOnboardingProcessPayload()` deve gerar `routineText`, `currentFeeling`, `mainEnergyPressure` e `supportGoals` a partir das seleções.

**Step 4: Tornar o contrato backend retrocompatível**

Aceitar os novos campos opcionais e manter clientes antigos funcionando.

**Step 5: Rodar testes e commit**

Commit:

```powershell
git add apps/web/src/features/aura/onboarding.ts apps/web/src/features/aura/onboarding.test.ts apps/backend/src/contracts/onboarding.contract.ts apps/backend/src/contracts/onboarding.contract.test.ts apps/backend/src/index.onboarding.test.ts
git commit -m "feat(onboarding): support structured routine answers"
```

### Task 6: Novo onboarding visual

**Files:**
- Create: `apps/web/src/features/onboarding/choice-grid.tsx`
- Create: `apps/web/src/features/onboarding/time-window-picker.tsx`
- Create: `apps/web/src/features/onboarding/habit-picker.tsx`
- Create: `apps/web/src/features/onboarding/guided-onboarding.css`
- Modify: `apps/web/src/routes/onboarding-page.tsx`
- Modify: `apps/web/src/routes/onboarding-energy-page.tsx`
- Modify: `apps/web/src/routes/onboarding-preferences-page.tsx`
- Modify: `apps/web/src/routes/onboarding-sleep-page.tsx`
- Modify: `apps/web/src/routes/onboarding-done-page.tsx`
- Modify: `apps/web/src/i18n/locales/pt.json`
- Modify: `apps/web/src/i18n/locales/en.json`
- Create: `apps/web/src/features/onboarding/guided-onboarding.test.tsx`

**Step 1: Escrever testes de interação que falham**

Cobrir:

- navegação completa sem preencher textarea;
- seleção por botões;
- “Outro” opcional;
- progresso visível;
- teclado e leitor de tela;
- máximo de duas perguntas bloqueantes;
- criação da sessão guiada ao finalizar;
- navegação para prévia, não para uma tela de documento.

**Step 2: Confirmar falhas**

Run:

```powershell
cd apps/web
npm test -- guided-onboarding.test.tsx
```

**Step 3: Implementar componentes visuais reutilizáveis**

`ChoiceGrid` deve usar botões reais com `aria-pressed`. `TimeWindowPicker` deve validar intervalos e mostrar erro junto ao campo. `HabitPicker` deve oferecer categorias, busca opcional e frequência por chips.

**Step 4: Reorganizar as rotas existentes**

Manter URLs atuais para compatibilidade, mas transformar as etapas em:

1. identidade e realidade;
2. disponibilidade e energia;
3. intenções e hábitos;
4. estado atual;
5. criação e prévia.

`OnboardingDonePage` deve:

1. persistir perfil;
2. criar `RoutineBuildSession` com `mode: 'guided'`;
3. enviar respostas;
4. compor;
5. navegar para `/routine-builder?session=<id>`.

**Step 5: Aplicar identidade da Airia**

Usar tokens existentes, cartões grandes, contraste AA, alvos de toque de 44 px e sem copiar textos/ativos externos.

**Step 6: Rodar testes, build e commit**

Run:

```powershell
cd apps/web
npm test -- guided-onboarding.test.tsx
npm run build
```

Commit:

```powershell
git add apps/web/src/features/onboarding apps/web/src/routes/onboarding-page.tsx apps/web/src/routes/onboarding-energy-page.tsx apps/web/src/routes/onboarding-preferences-page.tsx apps/web/src/routes/onboarding-sleep-page.tsx apps/web/src/routes/onboarding-done-page.tsx apps/web/src/i18n/locales/pt.json apps/web/src/i18n/locales/en.json
git commit -m "feat(onboarding): build routine with guided choices"
```

### Task 7: Montador com entrada guiada principal

**Files:**
- Modify: `apps/web/src/routes/routine-builder-page.tsx`
- Modify: `apps/web/src/features/routine-builder/helpers.ts`
- Modify: `apps/web/src/features/routine-builder/routine-builder.css`
- Modify: `apps/web/src/features/routine-builder/routine-builder.test.ts`
- Modify: `apps/web/src/features/routine-builder/week-preview.tsx`

**Step 1: Escrever testes que falham**

Exigir:

- tela inicial guiada sem `sourceText` e sem arquivo;
- retomada de sessão pelo query param;
- abas Hoje, Semana, Hábitos e Objetivos;
- edição antes de confirmar;
- importação como ação secundária;
- “Usar esta rotina” chama `apply` uma vez;
- erro mantém a prévia.

**Step 2: Confirmar falha**

Run:

```powershell
cd apps/web
npm test -- routine-builder.test.ts
```

**Step 3: Remover o bloqueio de fonte**

Excluir a condição:

```typescript
if (!focus.trim() || (!sourceText.trim() && !file)) return;
```

O fluxo guiado deve criar e submeter respostas estruturadas. A entrada importada mantém `sendText` e `upload`.

**Step 4: Construir a prévia por intenção**

Agrupar `draftPlan` em:

- hoje;
- semana;
- hábitos;
- objetivos/contexto;
- não encaixados.

Mostrar motivo concreto, duração, recorrência e origem sem nomenclatura interna.

**Step 5: Rodar e commit**

Commit:

```powershell
git add apps/web/src/routes/routine-builder-page.tsx apps/web/src/features/routine-builder
git commit -m "feat(routine): make guided setup the primary builder"
```

### Task 8: Hábitos com biblioteca e calendário correto

**Files:**
- Modify: `apps/web/src/routes/habits-page.tsx`
- Modify: `apps/web/src/features/aura/HabitIdeasModal.tsx`
- Create: `apps/web/src/features/habits/habit-library.tsx`
- Create: `apps/web/src/features/habits/habit-frequency-picker.tsx`
- Create: `apps/web/src/features/habits/habits-page.test.tsx`
- Modify: `apps/web/src/features/aura/habit-helpers.ts`
- Modify: `apps/web/src/routes/home-page.helpers.test.ts`
- Modify: `apps/web/src/routes/planner-page.tsx`
- Modify: `apps/web/src/i18n/locales/pt.json`
- Modify: `apps/web/src/i18n/locales/en.json`

**Step 1: Escrever testes que falham**

Cobrir:

- hábito de segunda/quarta/sexta não aparece na terça;
- hábito de terça aparece na terça na página, Home e Planner;
- visões Hoje e Todos;
- criação por biblioteca em até três escolhas;
- dias específicos e “algumas vezes por semana”;
- editar, pausar e arquivar;
- conclusão em um toque;
- hábito sem horário não recebe horário inventado.

**Step 2: Confirmar falhas**

Run:

```powershell
cd apps/web
npm test -- habits-page.test.tsx home-page.helpers.test.ts
```

**Step 3: Centralizar a regra de vencimento**

Todas as superfícies devem usar `isHabitDueOnWeekday()` com a data local selecionada. Remover filtros duplicados.

**Step 4: Implementar biblioteca visual**

Usar o catálogo da Task 2. A criação segue:

1. escolher hábito;
2. escolher frequência/dias;
3. escolher período e lembrete opcional;
4. salvar.

**Step 5: Rodar testes, build e commit**

Commit:

```powershell
git add apps/web/src/routes/habits-page.tsx apps/web/src/features/aura/HabitIdeasModal.tsx apps/web/src/features/habits apps/web/src/features/aura/habit-helpers.ts apps/web/src/routes/home-page.helpers.test.ts apps/web/src/routes/planner-page.tsx apps/web/src/i18n/locales/pt.json apps/web/src/i18n/locales/en.json
git commit -m "feat(habits): add guided library and reliable due dates"
```

### Task 9: Objetivos e metas com próxima ação

**Files:**
- Modify: `apps/web/src/routes/goals-page.tsx`
- Create: `apps/web/src/features/goals/goal-intention-picker.tsx`
- Create: `apps/web/src/features/goals/goal-preview-card.tsx`
- Create: `apps/web/src/features/goals/goals-page.test.tsx`
- Modify: `apps/backend/src/lib/objective-subgoals.ts`
- Modify: `apps/backend/src/lib/objective-subgoals.test.ts`
- Modify: `apps/backend/src/index.ts`
- Modify: `apps/backend/src/index.timeline.test.ts`
- Modify: `apps/web/src/i18n/locales/pt.json`
- Modify: `apps/web/src/i18n/locales/en.json`

**Step 1: Escrever testes que falham**

Exigir:

- captura de direção ampla não vira tarefa;
- resultado verificável vira objetivo/meta;
- ação concluível vira subtarefa ou bloco do Planner;
- objetivo ativo mostra uma única próxima ação;
- “Fazer agora” abre a tarefa correta;
- “Planejar” cria prévia, não mutação silenciosa;
- “Transformar em hábito” reaproveita título e pede frequência;
- cartões concluídos ficam fora dos ativos.

**Step 2: Confirmar falhas**

Run:

```powershell
cd apps/web
npm test -- goals-page.test.tsx
```

**Step 3: Simplificar a hierarquia visual**

Substituir a mistura atual de captura/GTD por:

- Direções;
- Metas e projetos;
- Próximas ações.

Preservar os endpoints `/api/objectives` e o JSON de `subgoals`. Não criar uma segunda entidade até haver necessidade comprovada.

**Step 4: Melhorar a classificação**

O backend deve retornar prévia:

```json
{
  "intentType": "direction|goal|project|task|habit",
  "title": "string",
  "nextActions": ["string"],
  "reviewRequired": true
}
```

Perguntas só quando a resposta muda tipo, prazo ou recorrência.

**Step 5: Rodar backend/web e commit**

Commit:

```powershell
git add apps/web/src/routes/goals-page.tsx apps/web/src/features/goals apps/backend/src/lib/objective-subgoals.ts apps/backend/src/lib/objective-subgoals.test.ts apps/backend/src/index.ts apps/backend/src/index.timeline.test.ts apps/web/src/i18n/locales/pt.json apps/web/src/i18n/locales/en.json
git commit -m "feat(goals): connect intentions to concrete next actions"
```

### Task 10: Visão de tarefas dentro do Planner

**Files:**
- Modify: `apps/web/src/routes/planner-page.tsx`
- Modify: `apps/web/src/routes/planner-page.helpers.ts`
- Modify: `apps/web/src/routes/planner-page.helpers.test.ts`
- Create: `apps/web/src/features/planner/task-list-view.tsx`
- Create: `apps/web/src/features/planner/quick-task-form.tsx`
- Create: `apps/web/src/features/planner/task-list-view.test.tsx`
- Modify: `apps/web/src/i18n/locales/pt.json`
- Modify: `apps/web/src/i18n/locales/en.json`

**Step 1: Escrever testes que falham**

Cobrir:

- abas Hoje, Próximas, Sem data e Concluídas;
- data local correta;
- tarefa ligada a objetivo;
- criação rápida com texto, duração e momento;
- item sem data não aparece hoje;
- tarefa concluída sai da lista ativa;
- uma tarefa não aparece duplicada na timeline e lista.

**Step 2: Confirmar falhas**

Run:

```powershell
cd apps/web
npm test -- task-list-view.test.tsx planner-page.helpers.test.ts
```

**Step 3: Implementar como visão dos mesmos `TimelineBlock`**

Não criar novo armazenamento. A lista e a timeline são duas representações do mesmo bloco.

**Step 4: Implementar cadastro rápido**

Campos:

- texto da tarefa;
- duração em chips;
- hoje, amanhã ou sem data;
- horário opcional;
- objetivo relacionado opcional.

**Step 5: Rodar build e commit**

Commit:

```powershell
git add apps/web/src/routes/planner-page.tsx apps/web/src/routes/planner-page.helpers.ts apps/web/src/routes/planner-page.helpers.test.ts apps/web/src/features/planner apps/web/src/i18n/locales/pt.json apps/web/src/i18n/locales/en.json
git commit -m "feat(planner): add an intuitive task view"
```

### Task 11: Configurações, importação opcional e refazer onboarding

**Files:**
- Modify: `apps/web/src/routes/preferences-page.tsx`
- Create: `apps/web/src/features/routine-builder/import-routine-dialog.tsx`
- Create: `apps/web/src/features/routine-builder/import-routine-dialog.test.tsx`
- Modify: `apps/web/src/features/aura/onboarding.ts`
- Modify: `apps/web/src/i18n/locales/pt.json`
- Modify: `apps/web/src/i18n/locales/en.json`

**Step 1: Escrever testes que falham**

Exigir:

- “Refazer onboarding” aparece uma única vez;
- não apaga agenda/hábitos existentes;
- “Importar rotina ou documento” abre diálogo opcional;
- cancelar não cria sessão;
- arquivo inválido mostra formato e limite;
- importação abre revisão, nunca aplica automaticamente.

**Step 2: Confirmar falha**

Run:

```powershell
cd apps/web
npm test -- import-routine-dialog.test.tsx
```

**Step 3: Remover duplicações no bloco atual**

Antes de editar, comparar o arquivo completo com o commit atual. Preservar alterações da usuária e remover somente handlers/atributos duplicados do botão de onboarding.

**Step 4: Implementar os dois controles**

- “Refazer onboarding” reinicia rascunho e navega.
- “Importar rotina ou documento” cria sessão `mode: 'import'` e usa o fluxo secundário.

**Step 5: Rodar e commit**

Commit:

```powershell
git add apps/web/src/routes/preferences-page.tsx apps/web/src/features/routine-builder/import-routine-dialog.tsx apps/web/src/features/routine-builder/import-routine-dialog.test.tsx apps/web/src/features/aura/onboarding.ts apps/web/src/i18n/locales/pt.json apps/web/src/i18n/locales/en.json
git commit -m "feat(settings): make routine import optional"
```

### Task 12: Airia conversa por padrão e abre o Montador quando solicitado

**Files:**
- Modify: `apps/backend/src/contracts/aura-command.contract.ts`
- Modify: `apps/backend/src/services/aura-command.service.ts`
- Modify: `apps/backend/src/services/aura-command.service.test.ts`
- Modify: `apps/backend/src/services/airia-cognitive-interpreter.service.ts`
- Modify: `apps/backend/src/services/airia-cognitive-interpreter.service.test.ts`
- Modify: `apps/web/src/routes/aura-chat-page.tsx`
- Modify: `apps/backend/src/index.aura-command.test.ts`

**Step 1: Escrever testes que falham**

Cobrir:

- relato/checklist sem pedido operacional retorna `action: 'respond'`;
- “monte minha rotina” retorna `action: 'start_routine_builder'`;
- documento anexado cria sessão de importação revisável;
- pedido explícito de tarefa continua criando prévia;
- resposta conversacional não mostra “não vou transformar” como fallback genérico.

**Step 2: Confirmar falhas**

Run:

```powershell
cd apps/backend
npx ts-node --transpile-only src/services/aura-command.service.test.ts
npx ts-node --transpile-only src/index.aura-command.test.ts
```

**Step 3: Estender o contrato**

Adicionar:

```typescript
action: z.enum([
  'respond',
  'start_routine_builder',
  // ações existentes
]),
intent: z.enum([
  'conversation',
  'routine_build',
  // intenções existentes
]),
```

**Step 4: Integrar a rota no frontend**

`start_routine_builder` navega para a sessão. `respond` mantém a conversa e não altera entidades.

**Step 5: Rodar e commit**

Commit:

```powershell
git add apps/backend/src/contracts/aura-command.contract.ts apps/backend/src/services/aura-command.service.ts apps/backend/src/services/aura-command.service.test.ts apps/backend/src/services/airia-cognitive-interpreter.service.ts apps/backend/src/services/airia-cognitive-interpreter.service.test.ts apps/web/src/routes/aura-chat-page.tsx apps/backend/src/index.aura-command.test.ts
git commit -m "feat(aura): route routine requests without blocking conversation"
```

### Task 13: Integração entre Home, Planner, Hábitos e Objetivos

**Files:**
- Modify: `apps/web/src/routes/home-page.helpers.ts`
- Modify: `apps/web/src/routes/home-page.helpers.test.ts`
- Modify: `apps/web/src/routes/home-page.tsx`
- Modify: `apps/web/src/routes/planner-page.tsx`
- Modify: `apps/web/src/features/aura/store.tsx`
- Create: `apps/web/src/features/routine-builder/routine-integration.test.ts`

**Step 1: Escrever testes ponta a ponta de estado**

Depois de aplicar uma sessão:

- objetivo aparece em Objetivos;
- próxima ação aparece no Planner;
- hábito aparece somente nos dias configurados;
- Home mostra apenas itens de hoje;
- nenhum item aparece duplicado;
- item rejeitado não volta como sugestão nova.

**Step 2: Confirmar falhas**

Run:

```powershell
cd apps/web
npm test -- routine-integration.test.ts home-page.helpers.test.ts
```

**Step 3: Reutilizar os helpers canônicos**

Centralizar:

- data local;
- vencimento de hábito;
- normalização/deduplicação de título;
- filtro de itens concluídos/rejeitados;
- vínculo objetivo → próxima ação.

**Step 4: Remover botões duplicados**

Quando dois botões executarem a mesma função, manter uma ação primária e transformar a outra em navegação ou removê-la.

**Step 5: Rodar e commit**

Commit:

```powershell
git add apps/web/src/routes/home-page.helpers.ts apps/web/src/routes/home-page.helpers.test.ts apps/web/src/routes/home-page.tsx apps/web/src/routes/planner-page.tsx apps/web/src/features/aura/store.tsx apps/web/src/features/routine-builder/routine-integration.test.ts
git commit -m "fix(routine): keep all planning surfaces consistent"
```

### Task 14: Documentação, revisão e produção

**Files:**
- Modify: `docs/product/airia-product-contract.md`
- Modify: `docs/product/airia-memory-architecture.md`
- Modify: `apps/backend/CLAUDE.md`
- Modify: `docs/plans/2026-07-23-guided-onboarding-routine-design.md` somente se a implementação exigir ajuste aprovado

**Step 1: Documentar o contrato final**

Registrar:

- Montador como única criação em lote;
- entrada guiada principal;
- importação opcional;
- relação objetivo/meta/tarefa/hábito;
- confirmação obrigatória;
- regras de contexto, rejeição e deduplicação.

**Step 2: Rodar testes e builds completos**

Run:

```powershell
cd apps/backend
npm test
npm run build
cd ../web
npm test
npm run build
```

Expected: todas as suítes e builds passam.

**Step 3: Aplicar revisão Airia**

Ler e executar:

- `docs/product/pr-review-skill-roadmap.md`
- `skills/airia-pr-review/SKILL.md`

Verificar especialmente:

- produto real vs. demo;
- grounding;
- sincronização frontend/backend;
- timezone;
- i18n;
- privacidade;
- mensagens de erro;
- mudanças recentes da usuária preservadas.

**Step 4: Push e deploy**

Fazer push da branch atual. Usar o fluxo oficial em `deploy/airia/deploy.sh`.

**Step 5: Verificar produção**

Confirmar:

- SHA local = remoto = VPS;
- `/api/health` retorna 200;
- `/home` retorna 200;
- onboarding guiado autenticado;
- composição e aplicação;
- hábitos nos dias corretos;
- objetivo com próxima ação;
- tarefa no Planner;
- importação opcional;
- ausência de erro genérico de validação.

**Step 6: Commit documental final**

```powershell
git add docs/product/airia-product-contract.md docs/product/airia-memory-architecture.md apps/backend/CLAUDE.md
git commit -m "docs: define guided routine product contract"
```
