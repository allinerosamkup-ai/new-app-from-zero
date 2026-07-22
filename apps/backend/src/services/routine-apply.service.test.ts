import assert from 'node:assert/strict';

import { RoutineApplyService } from './routine-apply.service';

function createFakePrisma(options?: { failTimeline?: boolean }) {
  const state = {
    session: {
      id: 'session-1',
      userId: 'user-1',
      status: 'ready',
      items: [
        { id: 'goal-1', kind: 'goal', title: 'Concluir a mudança', sourceExcerpt: 'Quero concluir a mudança', confidence: 0.9, reviewState: 'confirmed' },
        { id: 'habit-1', kind: 'habit', title: 'Caminhar', sourceExcerpt: 'Caminhar terça', confidence: 0.9, reviewState: 'confirmed', durationMinutes: 30, recurrence: { frequency: 'weekly', daysOfWeek: [2], interval: 1 } },
        { id: 'task-1', kind: 'task', title: 'Embalar livros', sourceExcerpt: 'Embalar os livros', confidence: 0.9, reviewState: 'confirmed' },
      ],
      draftPlan: {
        weekStart: '2026-07-27',
        capacity: { level: 'balanced', reason: 'Energia estável.' },
        entries: [{
          id: 'task:task-1:2026-07-27', sourceItemId: 'task-1', kind: 'task', date: '2026-07-27',
          startTime: '09:00', endTime: '09:30', title: 'Embalar livros', durationMinutes: 30,
          isFixed: false, persist: true, reason: 'Cabe na carga do dia.',
        }],
        days: [], contextItems: [], unscheduled: [],
      },
      applyResult: null as unknown,
      appliedAt: null as Date | null,
      sourceText: 'fonte bruta temporária',
    },
    objectives: [] as any[],
    habits: [] as any[],
    blocks: [] as any[],
  };

  const transactionClient = {
    routineBuildSession: {
      findFirst: async ({ where }: any) => state.session.id === where.id && state.session.userId === where.userId ? state.session : null,
      updateMany: async ({ where, data }: any) => {
        if (state.session.id !== where.id || state.session.userId !== where.userId || state.session.status !== where.status) return { count: 0 };
        Object.assign(state.session, data);
        return { count: 1 };
      },
      update: async ({ data }: any) => {
        Object.assign(state.session, data);
        return state.session;
      },
    },
    objective: {
      create: async ({ data }: any) => {
        const value = { id: `objective-${state.objectives.length + 1}`, ...data };
        state.objectives.push(value);
        return value;
      },
    },
    habit: {
      create: async ({ data }: any) => {
        const value = { id: `habit-${state.habits.length + 1}`, ...data };
        state.habits.push(value);
        return value;
      },
    },
    timelineBlock: {
      create: async ({ data }: any) => {
        if (options?.failTimeline) throw new Error('timeline failed');
        const value = { id: `block-${state.blocks.length + 1}`, ...data };
        state.blocks.push(value);
        return value;
      },
    },
  };

  const prisma = {
    $transaction: async (callback: (tx: typeof transactionClient) => Promise<unknown>) => {
      const snapshot = structuredClone(state);
      try {
        return await callback(transactionClient);
      } catch (error) {
        Object.assign(state, snapshot);
        throw error;
      }
    },
    routineBuildSession: transactionClient.routineBuildSession,
  };

  return { prisma, state };
}

async function run(): Promise<void> {
{
  const { prisma, state } = createFakePrisma();
  const service = new RoutineApplyService(prisma as any);
  const result = await service.apply({ sessionId: 'session-1', userId: 'user-1' });

  assert.deepEqual(result.counts, { objectives: 1, habits: 1, timelineBlocks: 1 });
  assert.equal(state.session.status, 'applied');
  assert.equal(state.session.sourceText, null);
  assert.equal(state.objectives[0].userId, 'user-1');
  assert.deepEqual(state.habits[0].targetDays, [2]);
  assert.equal(state.blocks[0].isAiSuggested, true);
  assert.equal(state.blocks[0].temporalPolicy, 'flexible');

  const second = await service.apply({ sessionId: 'session-1', userId: 'user-1' });
  assert.deepEqual(second, result);
  assert.deepEqual(result, state.session.applyResult);
  assert.equal(state.objectives.length, 1);
  assert.equal(state.habits.length, 1);
  assert.equal(state.blocks.length, 1);
}

{
  const { prisma, state } = createFakePrisma({ failTimeline: true });
  const service = new RoutineApplyService(prisma as any);
  await assert.rejects(() => service.apply({ sessionId: 'session-1', userId: 'user-1' }), /timeline failed/);
  assert.equal(state.session.status, 'ready');
  assert.equal(state.objectives.length, 0);
  assert.equal(state.habits.length, 0);
  assert.equal(state.blocks.length, 0);
}

console.log('routine-apply.service tests passed');
}

void run();
