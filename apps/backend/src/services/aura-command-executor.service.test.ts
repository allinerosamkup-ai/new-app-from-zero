import assert from 'node:assert/strict';

import { Prisma } from '@prisma/client';
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
        Object.assign(operation, {
          ...data,
          ...(data.error === Prisma.DbNull ? { error: null } : {}),
        });
        return operation;
      },
    },
    timelineBlock: {
      create: async ({ data }: any) => {
        timelineCreates.push(data);
        return { id: `timeline-${timelineCreates.length}`, ...data };
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

  return { prisma, plan, operations, timelineCreates, objectiveCreates };
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

  const canonicalCheckin = createPrismaFixture('auto_apply');
  canonicalCheckin.operations.push({
    id: '10000000-0000-4000-8000-000000000003',
    planId: canonicalCheckin.plan.id,
    userId: canonicalCheckin.plan.userId,
    clientOperationId: 'checkin-1',
    type: 'record_checkin',
    status: 'proposed',
    selected: true,
    payload: {
      localDate: '2026-07-28',
      moodScore: 3,
      energyScore: 3,
      clarityScore: null,
      irritabilityScore: null,
      physicalScore: null,
      socialScore: null,
      sleepScore: null,
      sleepHours: null,
      note: 'Estou chateada e cansada',
      emotions: ['sad', 'tired'],
      factors: [],
      source: 'aura_text',
      sourceMessageId: 'message-1',
      idempotencyKey: 'session-message-checkin-0001',
      rawText: 'Estou chateada e cansada',
      signalMetadata: {
        mood: { provenance: 'inferred', confidence: 0.92, evidence: ['chateada'] },
        energy: { provenance: 'inferred', confidence: 0.95, evidence: ['cansada'] },
      },
    },
    result: null,
    error: { message: 'falha transitória anterior' },
    idempotencyKey: null,
    appliedAt: null,
  });
  const recorded: Array<Record<string, unknown>> = [];
  const canonicalResult = await AuraCommandExecutorService.apply({
    prisma: canonicalCheckin.prisma,
    calendarGateway,
    userId: canonicalCheckin.plan.userId,
    planId: canonicalCheckin.plan.id,
    operationIds: ['checkin-1'],
    idempotencyKey: 'command-checkin-0001',
    now: new Date('2026-07-28T15:00:00.000Z'),
    recordCheckin: async (input) => {
      recorded.push(input);
      return {
        status: 'persisted',
        checkinId: 'checkin-1',
        persistedAt: '2026-07-28T15:00:00.000Z',
        stateLabel: 'Energia protegida',
        stateSummary: 'Hoje pede carga menor.',
        riskSafety: { route: 'standard' },
      };
    },
  });
  assert.equal(canonicalResult.status, 'applied');
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].moodScore, 3);
  assert.equal(recorded[0].energyScore, 3);
  assert.equal(recorded[0].clarityScore, null);
  assert.equal(canonicalResult.operations[0]?.result?.checkinId, 'checkin-1');
  assert.equal(canonicalCheckin.operations[2]?.error, null);

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
  assert.equal(explicitGoal.timelineCreates.length, 0, 'criar objetivo não direciona ação ao Planner');
  assert.equal(explicitGoal.objectiveCreates[0]?.pathStatus, 'ready');

  const broadGoal = createPrismaFixture('auto_apply');
  broadGoal.operations.push({
    ...explicitGoal.operations[0],
    id: '10000000-0000-4000-8000-000000000005',
    planId: broadGoal.plan.id,
    userId: broadGoal.plan.userId,
    clientOperationId: 'goal-question',
    type: 'create_goal',
    status: 'proposed', selected: true, result: null, error: null, idempotencyKey: null, appliedAt: null,
    payload: {
      title: 'Organizar minhas finanças', description: null, category: 'geral', subgoals: [],
      milestones: [], pathStatus: 'needs_answer', pathQuestion: 'O foco é dívida, controle do mês ou entender os gastos?',
      firstAction: null,
    },
  });
  await AuraCommandExecutorService.apply({
    prisma: broadGoal.prisma, calendarGateway, userId: broadGoal.plan.userId, planId: broadGoal.plan.id,
    operationIds: ['goal-question'], idempotencyKey: 'command-goal-question-0001',
    now: new Date('2026-07-28T15:00:00.000Z'),
  });
  assert.equal(broadGoal.objectiveCreates[0]?.pathStatus, 'needs_answer');
  assert.match(String(broadGoal.objectiveCreates[0]?.pathQuestion ?? ''), /dívida/);
  assert.deepEqual(broadGoal.objectiveCreates[0]?.subgoals, []);

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

  const actionRows: StoredOperation[] = [
    {
      id: '10000000-0000-4000-8000-000000000101',
      planId: '20000000-0000-4000-8000-000000000101',
      userId: '30000000-0000-4000-8000-000000000101',
      clientOperationId: 'postpone-1',
      type: 'postpone_timeline_task', status: 'proposed', selected: true,
      payload: { taskId: 'timeline-1', targetDate: '2026-07-30', reason: 'dia cheio' },
      result: null, error: null, idempotencyKey: null, appliedAt: null,
    },
    {
      id: '10000000-0000-4000-8000-000000000102',
      planId: '20000000-0000-4000-8000-000000000101',
      userId: '30000000-0000-4000-8000-000000000101',
      clientOperationId: 'start-1',
      type: 'start_timeline_task', status: 'proposed', selected: true,
      payload: { taskId: 'timeline-1' },
      result: null, error: null, idempotencyKey: null, appliedAt: null,
    },
    {
      id: '10000000-0000-4000-8000-000000000103',
      planId: '20000000-0000-4000-8000-000000000101',
      userId: '30000000-0000-4000-8000-000000000101',
      clientOperationId: 'adapt-1',
      type: 'adapt_agenda', status: 'proposed', selected: true,
      payload: { localDate: '2026-07-30' },
      result: null, error: null, idempotencyKey: null, appliedAt: null,
    },
    {
      id: '10000000-0000-4000-8000-000000000104',
      planId: '20000000-0000-4000-8000-000000000101',
      userId: '30000000-0000-4000-8000-000000000101',
      clientOperationId: 'screen-1',
      type: 'open_screen', status: 'proposed', selected: true,
      payload: { screen: 'planner' },
      result: null, error: null, idempotencyKey: null, appliedAt: null,
    },
  ];
  const actionPlan: any = {
    id: '20000000-0000-4000-8000-000000000101',
    userId: '30000000-0000-4000-8000-000000000101',
    executionPolicy: 'auto_apply', status: 'proposed', operations: actionRows,
  };
  const timeline = {
    id: 'timeline-1', userId: actionPlan.userId, title: 'Enviar proposta', status: 'planned',
    localDate: new Date('2026-07-28T00:00:00.000Z'),
    startAt: new Date('2026-07-28T14:00:00.000Z'),
    endAt: new Date('2026-07-28T15:00:00.000Z'),
    gcalEventId: null, temporalPolicy: 'flexible', adaptationPermission: 'eligible',
  };
  const protectedTimeline = {
    ...timeline,
    id: 'timeline-protected', title: 'Consulta fixa', gcalEventId: 'gcal-1',
    temporalPolicy: 'fixed', adaptationPermission: 'protected',
  };
  const actionEvents: Array<Record<string, unknown>> = [];
  const actionPrisma: any = {
    auraCommandPlan: {
      findFirst: async ({ where }: any) => where.id === actionPlan.id && where.userId === actionPlan.userId ? actionPlan : null,
      update: async ({ data }: any) => Object.assign(actionPlan, data),
    },
    auraCommandOperation: {
      update: async ({ where, data }: any) => {
        const row = actionRows.find((item) => item.id === where.id);
        if (!row) throw new Error('operation not found');
        Object.assign(row, data);
        return row;
      },
    },
    timelineBlock: {
      findFirst: async ({ where }: any) => [timeline, protectedTimeline].find((block) => block.id === where.id && block.userId === where.userId) ?? null,
      updateMany: async ({ where, data }: any) => {
        const block = [timeline, protectedTimeline].find((candidate) => candidate.id === where.id && candidate.userId === where.userId);
        if (!block || (where.gcalEventId === null && block.gcalEventId !== null)
          || (where.temporalPolicy?.not && block.temporalPolicy === where.temporalPolicy.not)
          || (where.adaptationPermission?.not && block.adaptationPermission === where.adaptationPermission.not)
          || (where.status?.not && block.status === where.status.not)) return { count: 0 };
        Object.assign(block, data);
        return { count: 1 };
      },
    },
    eventLog: { create: async ({ data }: any) => { actionEvents.push(data); return data; } },
    $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(actionPrisma),
  };
  let adaptationCalls = 0;
  const actionInput = {
    prisma: actionPrisma,
    calendarGateway,
    userId: actionPlan.userId,
    planId: actionPlan.id,
    operationIds: actionRows.map((row) => row.clientOperationId),
    idempotencyKey: 'command-action-0001',
    now: new Date('2026-07-28T15:00:00.000Z'),
    adaptAgenda: async ({ localDate }: any) => {
      adaptationCalls += 1;
      return { localDate, applied: true, appliedChanges: [{ id: 'change-1' }] };
    },
  };
  const actionExecution = await AuraCommandExecutorService.apply(actionInput);
  assert.equal(actionExecution.status, 'applied');
  assert.equal(timeline.localDate.toISOString().slice(0, 10), '2026-07-30');
  assert.equal(timeline.status, 'in_progress');
  assert.equal(adaptationCalls, 1);
  assert.deepEqual(actionExecution.operations.find((item) => item.id === 'screen-1')?.result, { screen: 'planner' });
  assert.ok(actionEvents.some((event) => event.eventName === 'timeline.block_postponed'));
  assert.ok(actionEvents.some((event) => event.eventName === 'timeline.block_started'));

  const idempotentActionExecution = await AuraCommandExecutorService.apply(actionInput);
  assert.equal(idempotentActionExecution.status, 'applied');
  assert.equal(adaptationCalls, 1, 'agenda adaptation must not be applied twice');

  const protectedRow: StoredOperation = {
    id: '10000000-0000-4000-8000-000000000105',
    planId: actionPlan.id,
    userId: actionPlan.userId,
    clientOperationId: 'postpone-protected',
    type: 'postpone_timeline_task', status: 'proposed', selected: true,
    payload: { taskId: 'timeline-protected', targetDate: '2026-07-30', reason: null },
    result: null, error: null, idempotencyKey: null, appliedAt: null,
  };
  actionRows.push(protectedRow);
  const protectedExecution = await AuraCommandExecutorService.apply({
    ...actionInput,
    operationIds: ['postpone-protected'],
    idempotencyKey: 'command-action-protected-0001',
  });
  assert.equal(protectedExecution.status, 'failed');
  assert.match(protectedExecution.operations[0]?.error?.message ?? '', /protegido/i);
  assert.equal(protectedTimeline.localDate.toISOString().slice(0, 10), '2026-07-28');

  console.log('aura-command-executor.service tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
