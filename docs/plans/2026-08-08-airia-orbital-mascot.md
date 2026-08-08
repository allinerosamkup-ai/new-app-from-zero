# Airia Orbital Mascot Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Criar, validar e integrar a Airia Orbital como manifestação visual responsiva às oito fases oficiais do produto.

**Architecture:** A identidade nasce de uma imagem-mestra aprovada antes da criação das variações. Os estados visuais são derivados dessa mesma referência e mapeados deterministicamente às fases do `MoodCycleEngine`; a camada de UI apenas renderiza o estado recebido e nunca infere humor. A integração começa estática, adiciona movimento funcional depois e preserva uma alternativa acessível sem animação.

**Tech Stack:** geração de imagem integrada, PNG/WebP, React 18, TypeScript, CSS, Vitest, Testing Library e `prefers-reduced-motion`.

---

### Task 1: Gerar e aprovar a imagem-mestra

**Files:**
- Reference: `apps/web/public/icons/icon-512.png`
- Reference: `apps/web/src/components/AuraIcon.tsx`
- Create after approval: `apps/web/public/mascot/airia-orbital-stable-v1.png`

**Step 1: Gerar o conceito Estável**

Usar a logo atual apenas como referência estrutural. Gerar uma criatura abstrata 3D com núcleo luminoso, dois olhos pequenos e inteligentes, quatro pétalas translúcidas em órbita, verde Airia, fundo neutro e sem texto, boca, braços ou pernas.

**Step 2: Inspecionar o resultado**

Verificar parentesco com a logo, leitura em tamanho pequeno, acabamento premium, ausência de infantilização e ausência de rosa como cor dominante.

**Step 3: Apresentar para aprovação**

Exibir a imagem-mestra. Não gerar as oito fases antes da aprovação explícita da identidade-base.

**Step 4: Salvar o conceito aprovado**

Copiar a versão aprovada para `apps/web/public/mascot/airia-orbital-stable-v1.png`, sem sobrescrever versões anteriores.

**Step 5: Commit**

```bash
git add apps/web/public/mascot/airia-orbital-stable-v1.png
git commit -m "feat: add Airia Orbital master mascot"
```

### Task 2: Criar as oito fases oficiais

**Files:**
- Create: `apps/web/public/mascot/phases/airia-orbital-high-flight.png`
- Create: `apps/web/public/mascot/phases/airia-orbital-flowing.png`
- Create: `apps/web/public/mascot/phases/airia-orbital-stable.png`
- Create: `apps/web/public/mascot/phases/airia-orbital-slowing-down.png`
- Create: `apps/web/public/mascot/phases/airia-orbital-withdrawal.png`
- Create: `apps/web/public/mascot/phases/airia-orbital-pause.png`
- Create: `apps/web/public/mascot/phases/airia-orbital-resuming.png`
- Create: `apps/web/public/mascot/phases/airia-orbital-turbulence.png`

**Step 1: Gerar uma fase por vez**

Usar a imagem-mestra aprovada como referência de identidade. Alterar somente cor, luz, olhar, distância das pétalas e sensação de movimento conforme o contrato de design.

**Step 2: Validar consistência**

Confirmar que todas as imagens representam o mesmo ser e que cada fase continua legível sem depender apenas da cor.

**Step 3: Montar a prancha comparativa**

Criar `artifacts/airia-orbital-phase-board.png` com as oito fases e seus nomes para revisão visual.

**Step 4: Commit**

```bash
git add apps/web/public/mascot/phases artifacts/airia-orbital-phase-board.png
git commit -m "feat: add Airia Orbital phase variants"
```

### Task 3: Criar o contrato de renderização

**Files:**
- Create: `apps/web/src/components/airia/AiriaMascot.tsx`
- Create: `apps/web/src/components/airia/AiriaMascot.test.tsx`
- Create: `apps/web/src/components/airia/airia-mascot.css`
- Reference: `apps/web/src/utils/mood-cycle-engine.ts`

**Step 1: Escrever o teste que falha**

Cobrir as oito fases oficiais, texto alternativo, fallback de fase desconhecida para Estável e ausência de animação quando o usuário prefere movimento reduzido.

**Step 2: Rodar o teste e confirmar a falha**

Run: `npm run test --workspace=@app/web -- AiriaMascot.test.tsx`

Expected: FAIL porque `AiriaMascot` ainda não existe.

**Step 3: Implementar o componente mínimo**

Criar um mapa tipado de fase para asset e rótulo. O componente recebe a fase pronta; não calcula nem infere estado.

**Step 4: Implementar movimento funcional**

Adicionar somente flutuação, órbita, pulso e transições de estado. Desabilitar movimento não essencial dentro de `@media (prefers-reduced-motion: reduce)`.

**Step 5: Rodar testes e build**

Run: `npm run test --workspace=@app/web -- AiriaMascot.test.tsx`

Expected: PASS.

Run: `npm run build --workspace=@app/web`

Expected: build concluído sem erros TypeScript ou Vite.

**Step 6: Commit**

```bash
git add apps/web/src/components/airia/AiriaMascot.tsx apps/web/src/components/airia/AiriaMascot.test.tsx apps/web/src/components/airia/airia-mascot.css
git commit -m "feat: add phase-aware Airia mascot"
```

### Task 4: Integrar nas superfícies atuais

**Files:**
- Modify: `apps/web/src/routes/home-page.tsx`
- Modify: `apps/web/src/routes/checkin-page.tsx`
- Modify: `apps/web/src/routes/goals-page.tsx`
- Modify: `apps/web/src/routes/insights-page.tsx`
- Modify: `apps/web/src/routes/journal-page.tsx`
- Modify: `apps/web/src/routes/aura-chat-page.tsx`
- Test: testes das rotas realmente alteradas

**Step 1: Definir critérios por superfície**

Home mostra a fase atual; Check-in reage após persistência confirmada; Objetivos usa o estado apenas como apoio à próxima ação real; Padrões assume postura observadora; Diário usa escuta; Aura usa a presença visual na conversa.

**Step 2: Escrever os testes que falham**

Cobrir renderização, origem da fase, momento da reação do Check-in e ausência total de dependência do Planner.

**Step 3: Rodar os testes e confirmar as falhas**

Run: `npm run test --workspace=@app/web`

Expected: os novos testes falham antes da integração.

**Step 4: Integrar uma superfície por vez**

Usar o mesmo componente e manter o mascote fora do caminho das ações principais. Não adicionar copy de venda, demonstração, placeholder ou sucesso simulado.

**Step 5: Rodar testes e build**

Run: `npm run test --workspace=@app/web`

Expected: PASS.

Run: `npm run build --workspace=@app/web`

Expected: PASS.

**Step 6: Validar no navegador autenticado**

Percorrer Home, Check-in com persistência confirmada, Objetivos, Padrões, Diário e Aura em viewport móvel e desktop. Capturar evidência visual, testar erro visível e confirmar que `/planner` continua redirecionando para a Home.

**Step 7: Commit**

```bash
git add apps/web/src/routes apps/web/src/components/airia
git commit -m "feat: integrate Airia Orbital across core surfaces"
```

### Task 5: Revisão final do produto

**Files:**
- Modify if needed: `docs/plans/2026-08-08-airia-orbital-mascot-design.md`
- Modify: `docs/agent-memory/CURRENT_STATE.md`
- Reference: `docs/product/pr-review-skill-roadmap.md`
- Reference: `skills/airia-pr-review/SKILL.md`

**Step 1: Executar a checklist de revisão Airia**

Confirmar grounding, acessibilidade, segurança, escopo consumidor, ausência de Planner e coerência frontend/backend.

**Step 2: Executar regressão completa relevante**

Run: `npm run test --workspace=@app/web`

Run: `npm run build --workspace=@app/web`

Expected: ambos concluídos com sucesso.

**Step 3: Registrar a evidência**

Atualizar a memória operacional com os assets finais, superfícies validadas, testes executados e qualquer pendência real.

**Step 4: Commit**

```bash
git add docs/agent-memory/CURRENT_STATE.md docs/plans/2026-08-08-airia-orbital-mascot-design.md
git commit -m "docs: record Airia Orbital validation"
```
