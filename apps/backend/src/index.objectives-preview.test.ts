import assert from 'node:assert/strict';
import request from 'supertest';

import { createApp } from './index';
import type { GoalDecomposition } from './services/goal-intelligence.service';

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

  console.log('objective preview HTTP tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
