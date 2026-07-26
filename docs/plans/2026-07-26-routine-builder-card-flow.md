# Routine Builder Card Flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Entregar o Montador de Rotina em cards com persistência individual imediata, edição, descarte e aplicação dos itens restantes.

**Architecture:** O backend mantém uma única operação idempotente de aplicação, agora com seleção opcional de itens e resultado acumulado em `applyResult`. O frontend transforma o plano composto em cards deduplicados por item de origem e usa o mesmo endpoint para salvar um card ou todos os restantes.

**Tech Stack:** TypeScript, Express, Zod, Prisma JSON, React, React Router, Vitest, CSS.

---

### Task 1: Contrato de aplicação seletiva

**Files:**
- Modify: `apps/backend/src/contracts/routine-builder.contract.ts`
- Modify: `apps/backend/src/services/routine-apply.service.ts`
- Test: `apps/backend/src/services/routine-apply.service.test.ts`

**Step 1: Write the failing test**

Adicionar casos que chamam:

```ts
await service.apply({
  sessionId: 'session-1',
  userId: 'user-1',
  sourceItemIds: ['habit-1'],
});
```

Asserções:

- cria somente o hábito;
- mantém a sessão em `ready/preview`;
- registra `habit-1` em `appliedSourceItemIds`;
- uma segunda chamada não duplica;
- aplicação sem seleção salva apenas os itens restantes.

**Step 2: Run test to verify it fails**

Run: `npx ts-node-transpile-only src/services/routine-apply.service.test.ts`

Expected: FAIL porque `sourceItemIds` ainda não limita a aplicação.

**Step 3: Write minimal implementation**

Adicionar:

```ts
export const RoutineApplyRequestSchema = z.object({
  sourceItemIds: z.array(z.string().min(1).max(80)).max(200).optional(),
});
```

Filtrar itens e entradas do plano pela seleção, acumular IDs aplicados e concluir a sessão somente quando todos os itens persistíveis tiverem sido aplicados ou excluídos.

**Step 4: Run test to verify it passes**

Run: `npx ts-node-transpile-only src/services/routine-apply.service.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/src/contracts/routine-builder.contract.ts apps/backend/src/services/routine-apply.service.ts apps/backend/src/services/routine-apply.service.test.ts
git commit -m "feat(routine): persist selected plan items"
```

### Task 2: API real para adicionar um card

**Files:**
- Modify: `apps/backend/src/services/routine-builder.service.ts`
- Modify: `apps/backend/src/routes/routine-builder.routes.ts`
- Test: `apps/backend/src/routes/routine-builder.routes.test.ts`

**Step 1: Write the failing test**

Enviar:

```ts
POST /api/routine-builder/sessions/session-1/apply
{ "sourceItemIds": ["habit-1"] }
```

Verificar que a seleção chega ao serviço e que payload inválido retorna `400 validation_failed`.

**Step 2: Run test to verify it fails**

Run: `npx ts-node-transpile-only src/routes/routine-builder.routes.test.ts`

Expected: FAIL porque o corpo ainda é ignorado.

**Step 3: Write minimal implementation**

Validar `RoutineApplyRequestSchema`, encaminhar a seleção e registrar evento específico para aplicação parcial.

**Step 4: Run test to verify it passes**

Run: `npx ts-node-transpile-only src/routes/routine-builder.routes.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/src/services/routine-builder.service.ts apps/backend/src/routes/routine-builder.routes.ts apps/backend/src/routes/routine-builder.routes.test.ts
git commit -m "feat(routine): expose selective apply API"
```

### Task 3: Modelo de cards da proposta

**Files:**
- Modify: `apps/web/src/features/routine-builder/types.ts`
- Modify: `apps/web/src/features/routine-builder/helpers.ts`
- Modify: `apps/web/src/features/routine-builder/api.ts`
- Test: `apps/web/src/features/routine-builder/routine-builder.test.ts`

**Step 1: Write the failing test**

Criar um plano com três ocorrências do mesmo hábito e uma tarefa. Verificar que:

- o hábito gera um único card;
- o card exibe recorrência e primeira ocorrência;
- IDs já aplicados são marcados como salvos;
- `remainingSourceItemIds` remove salvos e descartados.

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/routine-builder/routine-builder.test.ts`

Expected: FAIL porque os helpers de cards ainda não existem.

**Step 3: Write minimal implementation**

Adicionar `buildRoutineSuggestionCards`, `remainingRoutineSourceItemIds` e suporte de `sourceItemIds` no método `routineBuilderApi.apply`.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/routine-builder/routine-builder.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/src/features/routine-builder/types.ts apps/web/src/features/routine-builder/helpers.ts apps/web/src/features/routine-builder/api.ts apps/web/src/features/routine-builder/routine-builder.test.ts
git commit -m "feat(routine): derive operational suggestion cards"
```

### Task 4: Interface em cards

**Files:**
- Create: `apps/web/src/features/routine-builder/routine-suggestion-card.tsx`
- Modify: `apps/web/src/features/routine-builder/week-preview.tsx`
- Modify: `apps/web/src/routes/routine-builder-page.tsx`
- Modify: `apps/web/src/features/routine-builder/routine-builder.css`
- Modify: arquivos de tradução em `apps/web/src/i18n/`
- Test: `apps/web/src/features/routine-builder/routine-builder.test.ts`

**Step 1: Write the failing test**

Testar as transições puras do card:

- disponível → salvando → adicionado;
- disponível → descartado;
- `Aceitar todos` ignora os dois estados.

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/routine-builder/routine-builder.test.ts`

Expected: FAIL porque o estado operacional ainda não está modelado.

**Step 3: Write minimal implementation**

Construir a tela na ordem:

1. planos recebidos;
2. aviso de revisão;
3. resumo;
4. cards;
5. `Aceitar todos`.

Conectar `Adicionar` à aplicação seletiva; manter editor real; usar descarte existente; atualizar a sessão após cada resposta.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/routine-builder/routine-builder.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/src/features/routine-builder apps/web/src/routes/routine-builder-page.tsx apps/web/src/i18n
git commit -m "feat(routine): deliver card based builder experience"
```

### Task 5: Verificação e publicação

**Files:**
- Modify: `docs/product/airia-product-contract.md`

**Step 1: Run all verification**

```bash
npm test --workspace=@app/backend
npm run build --workspace=@app/backend
npm test --workspace=@app/web
npm run typecheck --workspace=@app/web
npm run build --workspace=@app/web
git diff --check
```

Expected: PASS.

**Step 2: Review**

Aplicar `skills/airia-pr-review/SKILL.md`, verificando persistência real, erros visíveis, idempotência, horário local e ausência de superfícies de demonstração.

**Step 3: Document**

Registrar no contrato que `Adicionar` persiste imediatamente e `Aceitar todos` persiste somente os itens restantes.

**Step 4: Commit and deploy**

```bash
git add docs/product/airia-product-contract.md
git commit -m "docs(routine): define card persistence semantics"
git push origin master
```

Executar `deploy/airia/deploy.sh` na VPS e confirmar o mesmo SHA em local, GitHub e servidor, além de `/api/health` e `/home` com HTTP 200.

