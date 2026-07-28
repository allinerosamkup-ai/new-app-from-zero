import assert from 'node:assert/strict';

import {
  AuraCommandExecutorService,
  sanitizeExistingItemChanges,
} from './aura-command-executor.service';

type StoredOperation = {
  id: string;
  planId: string;
  userId: string;
  clientOperationId: string;
  type: string;
  status: string;
  selected: boolean;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: Record<string, unknown> | null;
  idempotencyKey: string | null;
  appliedAt: Date | null;
};

function createPrismaFixture(executionPolicy = 'review_required') {
  const operations: StoredOperation[] = [
    {
      id: '10000000-0000-4000-8000-000000000001',
      planId: '20000000-0000-4000-8000-000000000001',
      userId: '30000000-0000-4000-8000-000000000001',
      clientOperationId: 'task-1',
      type: 'create_planner_task',
      status: 'proposed',
      selected: true,
      payload: {
        title: 'Preparar apresentação',
        date: '2026-07-29',
        startTime: '10:00',
        durationMinutes: 45,
        category: 'trabalho',
        note: null,
        checklist: [],
      },
      result: null,
      error: null,
      idempotencyKey: null,
      appliedAt: null,
    },
    {
      id: '10000000-0000-4000-8000-000000000002',
      planId: '20000000-0000-4000-8000-000000000001',
      userId: '30000000-0000-4000-8000-000000000001',
      clientOperationId: 'calendar-1',
      type: 'create_calendar_event',
      status: 'proposed',
      selected: true,
      payload: {
        title: 'Consulta',
        date: '2026-07-29',
        startTime: '15:00',
        durationMinutes: 60,
        calendarId: 'primary',
        location: null,
        description: null,
      },
      result: null,
      error: null,
      idempotencyKey: null,
      appliedAt: null,
    },
  ];
  const timelineCreates: Array<Record<string, unknown>> = [];
  const checkinUpserts: Array<Record<string, unknown>> = [];
  const objectiveCreates: Array<Record<string, unknown>> = [];
  const plan = {
    id: '20000000-0000-4000-8000-000000000001',
    userId: '30000000-0000-4000-8000-000000000001',
    executionPolicy,
    status: 'proposed',
    operations,
  };

  const prisma: any = {
    auraCommandPlan: {
      findFirst: async ({ where }: any) =>
        where.id === plan.id && where.userId === plan.userId ? plan : null,
      update: async ({ data }: any) => Object.assign(plan, data),
    },
    auraCommandOperation: {
      update: async ({ where, data }: any) => {
        const operation = operations.find((item) => item.id === where.id);
        if (!operation) throw new Error('operation not found');
        Object.assign(operation, data);
        return operation;
      },
    },
    timelineBlock: {
      create: async ({ data }: any) => {
        timelineCreates.push(data);
        return { id: `timeline-${timelineCreates.length}`, ...data };
      },
    },
    dailyCheckin: {
      upsert: async (input: Record<string, unknown>) => {
        checkinUpserts.push(input);
        return { id: 'checkin-1' };
      },
    },
    objective: {
      create: async ({ data }: any) => {
        objectiveCreates.push(data);
        return { id: 'objective-1', ...data };
      },
    },
    $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(prisma),
  };

  return { prisma, plan, operations, timelineCreates, checkinUpserts, objectiveCreates };
}

async function main() {
  const fixture = createPrismaFixture();
  const calendarCalls: Array<Record<string, unknown>> = [];
  const calendarGateway = {
    createOrGetEvent: async (input: Record<string, unknown>) => {
      calendarCalls.push(input);
      return {
        calendarId: 'primary',
        eventId: 'google-event-1',
        htmlLink: 'https://calendar.google.com/event?eid=1',
      };
    },
  };

  const first = await AuraCommandExecutorService.apply({
    prisma: fixture.prisma,
    calendarGateway,
    userId: fixture.plan.userId,
    planId: fixture.plan.id,
    operationIds: fixture.operations.map((item) => item.clientOperationId),
    idempotencyKey: 'command-apply-0001',
    now: new Date('2026-07-28T15:00:00.000Z'),
  });

  assert.equal(first.status, 'applied');
  assert.equal(first.operations.length, 2);
  assert.equal(calendarCalls.length, 1);
  assert.equal(fixture.timelineCreates.length, 2);
  assert.equal(fixture.timelineCreates[0].gcalEventId, undefined);
  assert.equal(fixture.timelineCreates[1].gcalEventId, 'google-event-1');
  assert.equal(fixture.timelineCreates[1].gcalCalendarId, 'primary');
  assert.equal(fixture.timelineCreates[1].gcalSyncStatus, 'synced');
  assert.equal(fixture.timelineCreates[1].sourceCommandOperationId, fixture.operations[1].id);
  assert.equal(fixture.operations[0].status, 'applied');
  assert.equal(fixture.operations[1].status, 'applied');

  const partialCheckin = createPrismaFixture('auto_apply');
  partialCheckin.operations.push({
    id: '10000000-0000-4000-8000-000000000003',
    planId: partialCheckin.plan.id,
    userId: partialCheckin.plan.userId,
    clientOperationId: 'checkin-1',
    type: 'create_checkin',
    status: 'proposed',
    selected: true,
    payload: {
      localDate: '2026-07-28',
      moodScore: 7,
      energyScore: 6,
      clarityScore: 8,
      irritabilityScore: null,
      note: null,
      emotions: [],
    },
    result: null,
    error: null,
    idempotencyKey: null,
    appliedAt: null,
  });
  await AuraCommandExecutorService.apply({
    prisma: partialCheckin.prisma,
    calendarGateway,
    userId: partialCheckin.plan.userId,
    planId: partialCheckin.plan.id,
    operationIds: ['checkin-1'],
    idempotencyKey: 'command-checkin-0001',
    now: new Date('2026-07-28T15:00:00.000Z'),
  });
  const partialUpsert = partialCheckin.checkinUpserts[0] as any;
  assert.equal(partialUpsert.create.irritabilityScore, null);
  assert.equal('irritabilityScore' in partialUpsert.update, false, 'sinal omitido não apaga o valor anterior');

  const explicitGoal = createPrismaFixture('auto_apply');
  explicitGoal.operations.push({
    id: '10000000-0000-4000-8000-000000000004',
    planId: explicitGoal.plan.id,
    userId: explicitGoal.plan.userId,
    clientOperationId: 'goal-1',
    type: 'create_goal',
    status: 'proposed',
    selected: true,
    payload: {
      title: 'Organizar portfólio',
      description: null,
      category: 'geral',
      subgoals: [{ id: 'item-1', title: 'Abrir a pasta', done: false }],
      firstAction: {
        title: 'Abrir a pasta',
        date: '2026-07-28',
        startTime: '20:00',
        durationMinutes: 25,
      },
    },
    result: null,
    error: null,
    idempotencyKey: null,
    appliedAt: null,
  });
  await AuraCommandExecutorService.apply({
    prisma: explicitGoal.prisma,
    calendarGateway,
    userId: explicitGoal.plan.userId,
    planId: explicitGoal.plan.id,
    operationIds: ['goal-1'],
    idempotencyKey: 'command-goal-0001',
    now: new Date('2026-07-28T15:00:00.000Z'),
  });
  assert.equal(explicitGoal.objectiveCreates[0]?.category, 'geral');
  assert.equal(explicitGoal.timelineCreates[0]?.category, 'pessoal');

  const second = await AuraCommandExecutorService.apply({
    prisma: fixture.prisma,
    calendarGateway,
    userId: fixture.plan.userId,
    planId: fixture.plan.id,
    operationIds: fixture.operations.map((item) => item.clientOperationId),
    idempotencyKey: 'command-apply-0001',
    now: new Date('2026-07-28T15:00:00.000Z'),
  });

  assert.equal(second.status, 'applied');
  assert.equal(calendarCalls.length, 1, 'Google event must not be created twice');
  assert.equal(fixture.timelineCreates.length, 2, 'local results must not be created twice');

  const clarification = createPrismaFixture('clarification');
  await assert.rejects(
    () => AuraCommandExecutorService.apply({
      prisma: clarification.prisma,
      calendarGateway,
      userId: clarification.plan.userId,
      planId: clarification.plan.id,
      operationIds: ['task-1'],
      idempotencyKey: 'command-apply-0002',
    }),
    /clarification/i,
  );

  assert.deepEqual(
    sanitizeExistingItemChanges('goal', {
      title: 'Meta revisada',
      progress: 50,
    }),
    {
      title: 'Meta revisada',
      progress: 50,
    },
  );
  assert.throws(
    () => sanitizeExistingItemChanges('goal', {
      title: 'Meta revisada',
      userId: '40000000-0000-4000-8000-000000000001',
    }),
    /unrecognized|unrecognized_keys/i,
  );
  assert.throws(
    () => sanitizeExistingItemChanges('habit', {
      reminderTime: '29:00',
    }),
    /invalid|validation/i,
  );

  console.log('aura-command-executor.service tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
