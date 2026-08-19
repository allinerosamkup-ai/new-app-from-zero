import assert from 'node:assert/strict';
import request from 'supertest';

import { createApp, isCurrentObjectiveContext } from './index';
import type { GoalDecomposition } from './services/goal-intelligence.service';

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const OBJECTIVE_ID = '660e8400-e29b-41d4-a716-446655440000';

function repository() {
  let preference: any = null;
  let objective: any = null;
  const events: any[] = [];
  const memories: any[] = [];
  const evidence: any[] = [];
  const prisma: any = {
    objective: {
      create: async ({ data }: any) => {
        objective = {
          id: OBJECTIVE_ID, progress: 0, archived: false, pathVersion: 1,
          resultDefinition: null, currentReality: null, pathProposal: null,
          pathProposalCreatedAt: null, pathQuestion: null, pausedAt: null,
          createdAt: new Date('2026-08-11T12:00:00.000Z'), updatedAt: new Date('2026-08-11T12:00:00.000Z'),
          ...structuredClone(data),
        };
        return structuredClone(objective);
      },
      findFirst: async ({ where }: any) => (
        objective && objective.id === where.id && objective.userId === where.userId
          ? structuredClone(objective)
          : null
      ),
      findMany: async () => objective ? [structuredClone(objective)] : [],
      updateMany: async ({ where, data }: any) => {
        if (!objective || objective.id !== where.id || objective.userId !== where.userId) return { count: 0 };
        if (where.pathVersion !== undefined && objective.pathVersion !== where.pathVersion) return { count: 0 };
        for (const [key, value] of Object.entries(data)) {
          if (value && typeof value === 'object' && 'increment' in value) objective[key] += (value as any).increment;
          else objective[key] = structuredClone(value);
        }
        return { count: 1 };
      },
    },
    userPreference: {
      findUnique: async () => preference,
      upsert: async ({ update, create }: any) => {
        preference = { ...(preference ?? create), ...update };
        return preference;
      },
    },
    eventLog: {
      create: async ({ data }: any) => { events.push(structuredClone(data)); return data; },
      findMany: async () => events,
    },
    journalMessage: { findMany: async () => [] },
    auraCommandMessage: { findMany: async () => [] },
    dailyCheckin: { findFirst: async () => null, findMany: async () => [] },
    onboardingResponse: { findUnique: async () => null },
    userMemory: {
      findMany: async () => [],
      findFirst: async ({ where }: any) => memories.find((item) => item.canonicalKey === where.canonicalKey && item.lifecycle === 'active') ?? null,
      create: async ({ data }: any) => {
        const row = { id: `memory-${memories.length + 1}`, lifecycle: 'active', ...structuredClone(data) };
        memories.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = memories.find((item) => item.id === where.id);
        Object.assign(row, structuredClone(data));
        return row;
      },
    },
    userMemoryEvidence: {
      findFirst: async ({ where }: any) => evidence.find((item) => item.memoryId === where.memoryId && item.hash === where.hash) ?? null,
      create: async ({ data }: any) => { evidence.push(structuredClone(data)); return data; },
    },
  };
  prisma.$transaction = async (operation: any) => operation(prisma);
  return { prisma, getObjective: () => objective, getPreference: () => preference, events, memories };
}

async function run() {
  const reference = new Date('2026-08-11T15:00:00.000Z');
  assert.equal(isCurrentObjectiveContext('2026-08-11T14:00:00.000Z', reference), true);
  assert.equal(isCurrentObjectiveContext('2026-08-08T14:00:00.000Z', reference), false);

  const state = repository();
  let next: GoalDecomposition = {
    mode: 'question', resultDefinition: null, currentReality: null, currentMilestoneId: null,
    milestones: [], assumptions: [], steps: [],
    question: 'O principal agora é reduzir dívida, controlar o mês ou entender para onde o dinheiro vai?',
  };
  const app = createApp({
    prisma: state.prisma,
    authMiddleware: (req, _res, nextMiddleware) => { (req as any).userId = USER_ID; nextMiddleware(); },
    goalDecompose: async () => structuredClone(next),
    memoryService: {
      store: async () => undefined,
      retrieve: async () => [],
      formatForPrompt: () => '',
      deleteAll: async () => undefined,
    } as any,
  });

  const created = await request(app).post('/api/objectives').send({
    title: 'Organizar minhas finanças', deadline: null, locale: 'pt-BR',
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.id, OBJECTIVE_ID);
  assert.equal(created.body.pathStatus, 'needs_answer');
  assert.match(created.body.pathQuestion, /dívida/);
  assert.deepEqual(created.body.subgoals, []);

  next = {
    mode: 'actions', resultDefinition: 'Dívida prioritária quitada',
    currentReality: 'A pessoa informou que a dívida é a prioridade', currentMilestoneId: 'm-1',
    assumptions: [], question: null,
    milestones: [
      { id: 'm-1', title: 'Dimensionar a dívida', order: 0, doneWhen: 'Valor e condição conhecidos', actions: [] },
      { id: 'm-2', title: 'Executar a quitação', order: 1, doneWhen: 'Dívida quitada', actions: [] },
    ],
    steps: [{
      title: 'Registrar o valor atual da dívida mencionada', basedOn: 'stated', milestoneId: 'm-1',
      doneWhen: 'Valor registrado', effortSize: 'small', evidenceRefs: ['objective:answer'],
    }],
  };
  const answered = await request(app).post(`/api/objectives/${OBJECTIVE_ID}/path/answer`).send({
    answer: 'Quero priorizar a dívida que já mencionei.', locale: 'pt-BR',
  });
  assert.equal(answered.status, 200);
  assert.equal(answered.body.status, 'ready');
  assert.equal(answered.body.objective.pathVersion, 2);
  assert.equal(answered.body.objective.subgoals[0].milestoneId, 'm-1');
  assert.equal(state.memories.some((memory) => memory.canonicalKey.includes('confirmed_path')), true);

  const primary = await request(app).put('/api/objectives/primary').send({ objectiveId: OBJECTIVE_ID });
  assert.equal(primary.status, 200);
  assert.equal(state.getPreference().primaryObjectiveId, OBJECTIVE_ID);

  const action = state.getObjective().subgoals[0];
  const dated = await request(app).patch(`/api/objectives/${OBJECTIVE_ID}/actions/${action.id}`).send({
    expectedVersion: 2, scheduledFor: '2026-08-20',
  });
  assert.equal(dated.status, 200);
  assert.equal(dated.body.action.scheduledFor, '2026-08-20');
  assert.equal(state.getObjective().pathVersion, 3);
  assert.equal(state.events.some((event) => event.eventName === 'objective_action_scheduled'), true);
  assert.equal(state.memories.some((memory) => memory.canonicalKey.endsWith('.scheduled') && String(memory.content).includes('2026-08-20')), true);

  const edited = await request(app).patch(`/api/objectives/${OBJECTIVE_ID}/actions/${action.id}`).send({
    expectedVersion: 3, title: 'Registrar o valor total da dívida prioritária',
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.pathVersion, 4);
  assert.equal(state.memories.some((memory) => memory.canonicalKey.endsWith('.edited')), true);

  const manualAction = await request(app).post(`/api/objectives/${OBJECTIVE_ID}/actions`).send({
    expectedVersion: 4,
    title: 'Abrir o app do banco e anotar o saldo atual',
    doneWhen: 'o saldo estiver anotado em uma nota',
  });
  assert.equal(manualAction.status, 201);
  assert.equal(manualAction.body.action.title, 'Abrir o app do banco e anotar o saldo atual');
  assert.equal(manualAction.body.action.doneWhen, 'o saldo estiver anotado em uma nota');
  assert.equal(state.getObjective().subgoals.at(-1).doneWhen, 'o saldo estiver anotado em uma nota');

  const abstractAction = await request(app).post(`/api/objectives/${OBJECTIVE_ID}/actions`).send({
    expectedVersion: 5,
    title: 'Separar uma decisão financeira reversível para hoje',
    doneWhen: 'a decisão estiver separada',
  });
  assert.equal(abstractAction.status, 422);
  assert.equal(abstractAction.body.error, 'abstract_or_circular_action');

  const beforeUnsafePatch = structuredClone(state.getObjective().subgoals);
  const unsafePatch = await request(app).patch(`/api/objectives/${OBJECTIVE_ID}`).send({ subgoals: [] });
  assert.equal(unsafePatch.status, 400);
  assert.deepEqual(state.getObjective().subgoals, beforeUnsafePatch);

  for (const route of ['/api/timeline', '/api/habits', '/api/gcal/events', '/api/agenda/adapt', '/api/routine-builder/sessions']) {
    const disabled = await request(app).post(route).send({});
    assert.equal(disabled.status, 404, `${route} must stay disabled in this release`);
    assert.equal(disabled.body.error, 'capability_disabled');
  }

  const failingState = repository();
  const failingApp = createApp({
    prisma: failingState.prisma,
    authMiddleware: (req, _res, nextMiddleware) => { (req as any).userId = USER_ID; nextMiddleware(); },
    goalDecompose: async () => { throw new Error('path transaction unavailable'); },
    memoryService: {
      store: async () => undefined, retrieve: async () => [], formatForPrompt: () => '', deleteAll: async () => undefined,
    } as any,
  });
  const preserved = await request(failingApp).post('/api/objectives').send({ title: 'Objetivo preservado', locale: 'pt-BR' });
  assert.equal(preserved.status, 201);
  assert.equal(preserved.body.pathStatus, 'ready');
  assert.equal(failingState.getObjective().title, 'Objetivo preservado');
}

run().then(() => console.log('objective intelligence API tests passed'));
