import assert from 'node:assert/strict';

import { RoutineApplyService } from './routine-apply.service';

function createFakePrisma(options?: {
  failTimeline?: boolean;
  preexisting?: boolean;
  preexistingUserId?: string;
  preexistingStartTime?: string;
}) {
  const existingUserId = options?.preexistingUserId ?? 'user-1';
  const state = {
    session: {
      id: 'session-1',
      userId: 'user-1',
      status: 'ready',
      items: [
        { id: 'goal-1', kind: 'goal', title: 'Concluir a mudança', sourceExcerpt: 'Quero concluir a mudança', confidence: 0.9, reviewState: 'confirmed' },
        {
          id: 'habit-1',
          kind: 'habit',
          title: 'Caminhar',
          sourceExcerpt: 'Caminhar terça',
          confidence: 0.9,
          reviewState: 'confirmed',
          durationMinutes: 30,
          timeWindow: {
            startTime: '18:00',
            endTime: '22:00',
            minDurationMinutes: 15,
            maxDurationMinutes: 45,
          },
          recurrence: { frequency: 'weekly', daysOfWeek: [], timesPerWeek: 1, interval: 1 },
        },
        { id: 'task-1', kind: 'task', title: 'Embalar livros', sourceExcerpt: 'Embalar os livros', confidence: 0.9, reviewState: 'confirmed', parentItemId: 'goal-1' },
      ],
      draftPlan: {
        weekStart: '2026-07-27',
        capacity: { level: 'balanced', reason: 'Energia estável.' },
        entries: [{
          id: 'task:task-1:2026-07-27', sourceItemId: 'task-1', kind: 'task', date: '2026-07-27',
          startTime: '09:00', endTime: '09:30', title: 'Embalar livros', durationMinutes: 30,
          isFixed: false, persist: true, reason: 'Cabe na carga do dia.',
        }, {
          id: 'habit:habit-1:2026-07-28', sourceItemId: 'habit-1', kind: 'habit', date: '2026-07-28',
          startTime: '18:30', endTime: '19:00', title: 'Caminhar', durationMinutes: 30,
          isFixed: false, persist: true, reason: 'Cabe no período escolhido.',
        }],
        days: [], contextItems: [], unscheduled: [],
      },
      applyResult: null as unknown,
      appliedAt: null as Date | null,
      sourceText: 'fonte bruta temporária',
    },
    objectives: options?.preexisting ? [{
      id: 'objective-existing',
      userId: existingUserId,
      title: '  concluir A mudança! ',
      subgoals: [],
      archived: false,
    }] as any[] : [] as any[],
    habits: options?.preexisting ? [{
      id: 'habit-existing',
      userId: existingUserId,
      title: 'CAMINHAR',
      frequency: 'weekly',
      targetDays: [1],
      timeOfDay: 'morning',
      durationMinutes: 10,
      reminderTime: '08:00',
      archived: false,
    }] as any[] : [] as any[],
    blocks: options?.preexisting ? [{
      id: 'block-existing',
      userId: existingUserId,
      title: 'Embalar livros.',
      localDate: new Date('2026-07-27T00:00:00.000Z'),
      startAt: new Date(`2026-07-27T${options?.preexistingStartTime ?? '09:00'}:00.000Z`),
      endAt: new Date(`2026-07-27T${options?.preexistingStartTime === '18:00' ? '18:30' : '09:30'}:00.000Z`),
      status: 'planned',
      isAiSuggested: true,
    }] as any[] : [] as any[],
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
      findMany: async ({ where }: any) => state.objectives.filter((value) => (
        value.userId === where.userId && value.archived === false
      )),
      update: async ({ where, data }: any) => {
        const value = state.objectives.find((objective) => objective.id === where.id);
        if (!value) throw new Error('objective not found');
        Object.assign(value, data);
        return value;
      },
      create: async ({ data }: any) => {
        const value = { id: `objective-${state.objectives.length + 1}`, ...data };
        state.objectives.push(value);
        return value;
      },
    },
    habit: {
      findMany: async ({ where }: any) => state.habits.filter((value) => (
        value.userId === where.userId && value.archived === false
      )),
      update: async ({ where, data }: any) => {
        const value = state.habits.find((habit) => habit.id === where.id);
        if (!value) throw new Error('habit not found');
        Object.assign(value, data);
        return value;
      },
      create: async ({ data }: any) => {
        const value = { id: `habit-${state.habits.length + 1}`, ...data };
        state.habits.push(value);
        return value;
      },
    },
    timelineBlock: {
      findMany: async ({ where }: any) => state.blocks.filter((value) => value.userId === where.userId),
      update: async ({ where, data }: any) => {
        const value = state.blocks.find((block) => block.id === where.id);
        if (!value) throw new Error('timeline block not found');
        Object.assign(value, data);
        return value;
      },
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

  const partial = await service.apply({
    sessionId: 'session-1',
    userId: 'user-1',
    sourceItemIds: ['habit-1'],
  } as any);

  assert.deepEqual(partial.counts, { objectives: 0, habits: 1, timelineBlocks: 0 });
  assert.deepEqual(partial.appliedSourceItemIds, ['habit-1']);
  assert.equal(state.session.status, 'ready');
  assert.equal((state.session as any).stage, 'preview');
  assert.equal(state.session.sourceText, 'fonte bruta temporária');
  assert.equal(state.objectives.length, 0);
  assert.equal(state.habits.length, 1);
  assert.equal(state.blocks.length, 0);

  const repeated = await service.apply({
    sessionId: 'session-1',
    userId: 'user-1',
    sourceItemIds: ['habit-1'],
  } as any);
  assert.deepEqual(repeated, partial);
  assert.equal(state.habits.length, 1, 'adicionar o mesmo card novamente não duplica o hábito');

  const completed = await service.apply({ sessionId: 'session-1', userId: 'user-1' });
  assert.deepEqual(completed.counts, { objectives: 1, habits: 1, timelineBlocks: 1 });
  assert.deepEqual(completed.appliedSourceItemIds.sort(), ['goal-1', 'habit-1', 'task-1']);
  assert.equal(state.session.status, 'applied');
  assert.equal(state.session.sourceText, null);
}

{
  const { prisma, state } = createFakePrisma();
  const service = new RoutineApplyService(prisma as any);
  await service.apply({
    sessionId: 'session-1',
    userId: 'user-1',
    sourceItemIds: ['habit-1'],
  });
  state.session.items = state.session.items.map((item: any) => (
    item.id === 'habit-1' ? item : { ...item, reviewState: 'excluded' }
  ));

  const completedAfterDiscard = await service.apply({
    sessionId: 'session-1',
    userId: 'user-1',
  });

  assert.equal(state.session.status, 'applied');
  assert.deepEqual(completedAfterDiscard.appliedSourceItemIds, ['habit-1']);
  assert.equal(state.objectives.length, 0);
  assert.equal(state.blocks.length, 0);
}

{
  const { prisma, state } = createFakePrisma();
  const service = new RoutineApplyService(prisma as any);
  const result = await service.apply({ sessionId: 'session-1', userId: 'user-1' });

  assert.deepEqual(result.counts, { objectives: 1, habits: 1, timelineBlocks: 1 });
  assert.equal(state.session.status, 'applied');
  assert.equal(state.session.sourceText, null);
  assert.equal(state.objectives[0].userId, 'user-1');
  assert.deepEqual(state.objectives[0].subgoals, [{ id: 'task-1', title: 'Embalar livros', done: false }]);
  assert.deepEqual(state.habits[0].targetDays, [2]);
  assert.equal(state.habits[0].targetCount, 1);
  assert.equal(state.habits[0].timeOfDay, 'evening');
  assert.equal(state.habits[0].durationMinutes, 30);
  assert.equal(state.habits[0].reminderTime, '18:30');
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
  const { prisma, state } = createFakePrisma({ preexisting: true });
  const service = new RoutineApplyService(prisma as any);
  const result = await service.apply({ sessionId: 'session-1', userId: 'user-1' });

  assert.deepEqual(result.counts, { objectives: 0, habits: 0, timelineBlocks: 0 });
  assert.deepEqual(result.ids, { objectives: [], habits: [], timelineBlocks: [] });
  assert.equal(state.objectives.length, 1, 'same operational objective must not be duplicated across sessions');
  assert.deepEqual(
    state.objectives[0].subgoals,
    [{ id: 'task-1', title: 'Embalar livros', done: false }],
    'refazer rotina atualiza as próximas ações do objetivo existente',
  );
  assert.equal(state.habits.length, 1, 'same operational habit must not be duplicated across sessions');
  assert.deepEqual(state.habits[0].targetDays, [2], 'refazer rotina recalibra os dias do hábito existente');
  assert.equal(state.habits[0].timeOfDay, 'evening');
  assert.equal(state.habits[0].durationMinutes, 30);
  assert.equal(state.habits[0].reminderTime, '18:30');
  assert.equal(state.blocks.length, 1, 'same operational block must not be duplicated across sessions');
}

{
  const { prisma, state } = createFakePrisma({ preexisting: true, preexistingUserId: 'user-2' });
  const service = new RoutineApplyService(prisma as any);
  const result = await service.apply({ sessionId: 'session-1', userId: 'user-1' });

  assert.deepEqual(result.counts, { objectives: 1, habits: 1, timelineBlocks: 1 });
  assert.equal(state.objectives.length, 2, 'identity must always be scoped by userId');
  assert.equal(state.habits.length, 2);
  assert.equal(state.blocks.length, 2);
}

{
  const { prisma, state } = createFakePrisma({ preexisting: true, preexistingStartTime: '18:00' });
  const service = new RoutineApplyService(prisma as any);
  const result = await service.apply({ sessionId: 'session-1', userId: 'user-1' });

  assert.equal(result.counts.timelineBlocks, 0, 'refazer rotina move o bloco gerado em vez de duplicá-lo');
  assert.equal(state.blocks.length, 1);
  assert.equal(state.blocks[0].startAt.toISOString(), '2026-07-27T09:00:00.000Z');
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
