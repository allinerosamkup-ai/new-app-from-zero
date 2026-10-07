import assert from 'node:assert/strict';
import request from 'supertest';

import { createApp } from './index';
import type { GoalDecomposition } from './services/goal-intelligence.service';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';

function repository() {
  const objectives: any[] = [{
    id: '660e8400-e29b-41d4-a716-446655440000',
    userId: USER_ID,
    title: 'Rotina da semana',
    archived: false,
    notes: [],
    subgoals: [
      { id: 'a1', title: 'Ginástica', done: false, order: 0, scheduledFor: '2026-09-07', effortSize: 'medium', doneWhen: 'o treino estiver feito' },
      { id: 'a2', title: 'Leitura', done: false, order: 1, scheduledFor: '2026-09-09', effortSize: 'small', doneWhen: 'o capítulo estiver lido' },
    ],
    pathVersion: 1,
  }];
  const prisma: any = {
    objective: {
      findMany: async ({ where }: any) => objectives.filter((item) => item.userId === where.userId && item.archived === false),
      findFirst: async () => objectives[0],
    },
    journalMessage: { findMany: async () => [] },
    auraCommandMessage: { findMany: async () => [] },
    eventLog: { findMany: async () => [] },
    userMemory: { findMany: async () => [] },
    dailyCheckin: { findFirst: async () => null },
    onboardingResponse: { findUnique: async () => null },
  };
  return { prisma };
}

async function run() {
  const state = repository();
  const next: GoalDecomposition = {
    mode: 'actions',
    resultDefinition: 'App publicado',
    currentReality: 'Sem conta ainda',
    currentMilestoneId: 'm-1',
    assumptions: [],
    question: null,
    milestones: [
      { id: 'm-1', title: 'Preparar a loja', order: 0, doneWhen: 'Conta pronta', actions: [
        { title: 'Abrir a conta de desenvolvedor', basedOn: 'inferred', doneWhen: 'a conta estiver criada', effortSize: 'medium' },
      ] },
    ],
    steps: [
      { title: 'Abrir a conta de desenvolvedor', basedOn: 'inferred', doneWhen: 'a conta estiver criada', effortSize: 'medium' },
    ],
  };
  const app = createApp({
    prisma: state.prisma,
    authMiddleware: (req, _res, nextMiddleware) => { (req as any).userId = USER_ID; nextMiddleware(); },
    goalDecompose: async () => structuredClone(next),
    memoryService: { store: async () => undefined, retrieve: async () => [], formatForPrompt: () => '', deleteAll: async () => undefined } as any,
  });

  const breakdown = await request(app).post('/api/objectives/preview-breakdown').send({
    title: 'Lançar app na Play Store',
  });
  assert.equal(breakdown.status, 200, breakdown.text);
  assert.equal(breakdown.body.suggestedTitle, 'Lançar app na Play Store');
  assert.ok(Array.isArray(breakdown.body.tasks) && breakdown.body.tasks.length >= 2);
  assert.equal(breakdown.body.suggestedSubgoals[0].title, 'Abrir a conta de desenvolvedor');

  const fromNote = await request(app).post('/api/objectives/preview-breakdown').send({
    note: 'Ideia: criar curso de Angular avançado',
  });
  assert.equal(fromNote.status, 200);

  const invalid = await request(app).post('/api/objectives/preview-breakdown').send({});
  assert.equal(invalid.status, 400);

  const reschedule = await request(app).post('/api/objectives/preview-reschedule').send({
    naturalLanguage: 'Mova ginástica e leitura para terça e quinta',
  });
  assert.equal(reschedule.status, 200, reschedule.text);
  assert.equal(reschedule.body.moves.length, 2);
  assert.equal(reschedule.body.moves[0].objectiveId, '660e8400-e29b-41d4-a716-446655440000');

  // Execute the real UI adapter against the actual strict HTTP route, rather
  // than duplicating its shape in a test-only schema.
  const helpersSource = readFileSync(path.resolve(__dirname, '../../web/src/routes/objectives-workspace/helpers.ts'), 'utf8');
  const compiled = ts.transpileModule(helpersSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const uiHelpers: any = {};
  new Function('exports', compiled)(uiHelpers);
  const rawActions = [...breakdown.body.suggestedSubgoals, { ...breakdown.body.suggestedSubgoals[0], id: 'second-contract-action', title: 'Escrever o roteiro de teste', order: 5 }].reverse();
  const originalPreviewOrder = rawActions.map((item: any) => item.order);
  assert.ok(rawActions.every((item: any) => Number.isInteger(item.order)));
  let createdObjective: any = null;
  state.prisma.objective.create = async ({ data }: any) => {
    createdObjective = { ...data, id: '770e8400-e29b-41d4-a716-446655440000', archived: false, progress: 0, createdAt: new Date(), updatedAt: new Date(), pathVersion: 1 };
    return createdObjective;
  };
  state.prisma.objective.findFirst = async () => createdObjective;
  const invalidPreviewWrite = await request(app).post('/api/objectives').send({ title: 'Publish test app', subgoals: rawActions });
  assert.equal(invalidPreviewWrite.status, 400, 'raw preview metadata must remain rejected by strict validation');
  assert.equal(createdObjective, null, 'invalid input must not create a goal');
  const writeActions = uiHelpers.previewToWriteSubgoals(rawActions);
  const createdFromUi = await request(app).post('/api/objectives').send({ title: 'Publish test app', subgoals: writeActions });
  assert.equal(createdFromUi.status, 201, createdFromUi.text);
  const persisted = await state.prisma.objective.findFirst();
  assert.deepEqual(persisted.subgoals.map((item: any) => item.id), [...rawActions].sort((a: any, b: any) => a.order - b.order).map((item: any) => item.id));
  assert.deepEqual(persisted.subgoals.map((item: any) => item.order), writeActions.map((_item: any, index: number) => index));
  assert.deepEqual(rawActions.map((item: any) => item.order), originalPreviewOrder, 'adapter must not mutate preview');

  console.log('objective preview HTTP tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
