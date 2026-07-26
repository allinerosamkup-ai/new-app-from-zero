import assert from 'node:assert/strict';

import { AgendaAdaptationService } from './agenda-adaptation.service';
import type { DailyContext } from './context-grounding.service';

const baseContext: DailyContext = {
  source: 'ContextGroundingService',
  date: '2026-04-30',
  pendingTaskTitles: ['Responder cliente'],
  completedTaskTitles: ['Treino'],
  pendingHabitTitles: ['Diário'],
  completedHabitTitles: ['Ginástica'],
  activeGoalTitles: ['Preparar proposta da Airia'],
  completedGoalTitles: [],
  completedSubgoalTitles: ['Separar prints'],
  recentSuggestionTitles: ['Separar roupa de treino'],
  blockedActionTitles: ['Kit do treino'],
  todayAnchorTitles: ['Responder cliente', 'Diário', 'Preparar proposta da Airia'],
  tasks: [
    {
      id: '33333333-3333-4333-8333-333333333333',
      title: 'Responder cliente',
      status: 'planned',
      category: 'trabalho',
      intensity: 'P',
      startAt: new Date('2026-04-30T11:00:00.000Z'),
      endAt: new Date('2026-04-30T12:00:00.000Z'),
    },
  ],
  habits: [],
  goals: [],
  actionFeedback: [],
  patternMemoryContext: 'Memória antiga sobre treino.',
  operationalRule: 'Contexto antigo explica padrão; ação do dia precisa de âncora operacional atual.',
};

{
  const result = AgendaAdaptationService.buildPreview({
    dailyContext: baseContext,
    requestContext: { phase: 'Turbulência' },
    trigger: 'checkin',
  });

  assert.equal(result.date, '2026-04-30');
  assert.equal(result.trigger, 'checkin');
  assert.equal(result.changes[0]?.type, 'shrink');
  assert.equal(result.changes[0]?.targetId, '33333333-3333-4333-8333-333333333333');
  assert.equal(result.changes[0]?.targetType, 'timeline');
  assert.equal(result.changes[0]?.suggestedStartTime, '11:00');
  assert.equal(result.changes[0]?.suggestedEndTime, '11:30');
  assert.equal(result.changes[0]?.impactLabel, 'reduz carga');
  assert.match(result.changes[0]?.reason ?? '', /reduzir escopo/);
  assert.match(result.changes[0]?.bioReason ?? '', /reduzir duração/);
  assert.ok(result.blockedSuggestions.includes('Treino'));
  assert.ok(result.blockedSuggestions.includes('Separar roupa de treino'));
  assert.equal(result.adaptiveAgenda.decisions[0]?.requiresConfirmation, false);
}

{
  const result = AgendaAdaptationService.buildPreview({
    dailyContext: {
      ...baseContext,
      tasks: [],
      pendingTaskTitles: [],
      pendingHabitTitles: [],
      todayAnchorTitles: [],
    },
    requestContext: { phase: 'Estável' },
  });

  assert.equal(result.changes[0]?.type, 'suggest');
  assert.equal(result.changes[0]?.kind, 'suggested_commitment');
  assert.equal(result.changes[0]?.requiresConfirmation, false);
  assert.equal(result.changes[0]?.notificationAllowed, false);
  assert.match(result.summary, /sugestão opcional/);
}

function makeMockPrisma(blocks: any[] = [], options: { protectAfterRead?: boolean; feedbackFails?: boolean } = {}) {
  const calls = {
    updates: [] as any[],
    updateManyCalls: [] as any[],
    creates: [] as any[],
    feedbackPayload: null as any,
    events: [] as any[],
  };
  const prisma = {
    timelineBlock: {
      findFirst: async ({ where }: any) => {
        const block = blocks.find((candidate) => candidate.id === where.id && candidate.userId === where.userId) ?? null;
        if (!block) return null;
        const snapshot = { ...block };
        if (options.protectAfterRead) {
          block.temporalPolicy = 'fixed';
          block.adaptationPermission = 'protected';
        }
        return snapshot;
      },
      update: async ({ where, data }: any) => {
        calls.updates.push({ where, data });
        return { ...blocks.find((block) => block.id === where.id), ...data };
      },
      updateMany: async ({ where, data }: any) => {
        calls.updateManyCalls.push({ where, data });
        const block = blocks.find((candidate) => candidate.id === where.id && candidate.userId === where.userId);
        const matchesProtectionPredicate = Boolean(block)
          && (where.gcalEventId !== null || block.gcalEventId == null)
          && (!where.temporalPolicy?.not || (block.temporalPolicy ?? 'flexible') !== where.temporalPolicy.not)
          && (!where.adaptationPermission?.not || (block.adaptationPermission ?? 'eligible') !== where.adaptationPermission.not);
        if (!block || !matchesProtectionPredicate) return { count: 0 };
        Object.assign(block, data);
        calls.updates.push({ where, data });
        return { count: 1 };
      },
      create: async ({ data }: any) => {
        calls.creates.push(data);
        return { id: `created-${calls.creates.length}`, ...data };
      },
    },
    onboardingResponse: {
      findUnique: async () => ({ aiProfilePayload: {} }),
      upsert: async (payload: any) => {
        if (options.feedbackFails) throw new Error('feedback unavailable');
        calls.feedbackPayload = payload;
        return payload;
      },
    },
    eventLog: {
      create: async (payload: any) => {
        calls.events.push(payload);
        return payload;
      },
    },
  };
  return { prisma: prisma as any, calls };
}

(async () => {
{
  const { prisma, calls } = makeMockPrisma([]);
  const result = await AgendaAdaptationService.apply({
    prisma,
    userId: '550e8400-e29b-41d4-a716-446655440000',
    dailyContext: {
      ...baseContext,
      tasks: [],
      pendingTaskTitles: [],
      pendingHabitTitles: [],
      todayAnchorTitles: [],
    },
    requestContext: { phase: 'Estável', currentHour: 9, currentMinute: 0 },
    selectedDecisionIds: [],
  });

  assert.equal(result.applied, false);
  assert.equal(result.appliedChanges.length, 0);
  assert.equal(calls.updates.length, 0);
  assert.equal(calls.creates.length, 0);
}

{
  const block = {
    id: '44444444-4444-4444-8444-444444444444',
    userId: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Responder cliente',
    localDate: new Date('2026-04-30T00:00:00.000Z'),
    startAt: new Date('2026-04-30T09:00:00.000Z'),
    endAt: new Date('2026-04-30T10:00:00.000Z'),
    category: 'trabalho',
    intensity: 'P',
    status: 'planned',
  };
  const { prisma, calls } = makeMockPrisma([block]);
  const preview = AgendaAdaptationService.buildPreview({
    dailyContext: {
      ...baseContext,
      pendingTaskTitles: ['Responder cliente'],
      tasks: [{ id: block.id, title: block.title, status: 'planned', category: 'trabalho', intensity: 'P', startAt: block.startAt, endAt: block.endAt }],
    },
    requestContext: { phase: 'Estável', currentHour: 10, currentMinute: 10 },
  });
  assert.equal(preview.changes[0]?.type, 'move');

  const result = await AgendaAdaptationService.apply({
    prisma,
    userId: block.userId,
    dailyContext: {
      ...baseContext,
      pendingTaskTitles: ['Responder cliente'],
      tasks: [{ id: block.id, title: block.title, status: 'planned', category: 'trabalho', intensity: 'P', startAt: block.startAt, endAt: block.endAt }],
    },
    requestContext: { phase: 'Estável', currentHour: 10, currentMinute: 10 },
    selectedDecisionIds: [preview.changes[0].id],
  });

  assert.equal(result.applied, true);
  assert.equal(calls.updates.length, 1);
  assert.equal(calls.updates[0].data.startAt.toISOString().slice(11, 16), '10:30');
  assert.equal(calls.updates[0].data.endAt.toISOString().slice(11, 16), '11:30');
}

{
  const block = {
    id: '55555555-5555-4555-8555-555555555555',
    userId: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Responder cliente',
    localDate: new Date('2026-04-30T00:00:00.000Z'),
    startAt: new Date('2026-04-30T11:00:00.000Z'),
    endAt: new Date('2026-04-30T12:00:00.000Z'),
    category: 'trabalho',
    intensity: 'P',
    status: 'planned',
  };
  const { prisma, calls } = makeMockPrisma([block]);
  const preview = AgendaAdaptationService.buildPreview({
    dailyContext: {
      ...baseContext,
      pendingTaskTitles: ['Responder cliente'],
      tasks: [{ id: block.id, title: block.title, status: 'planned', category: 'trabalho', intensity: 'P', startAt: block.startAt, endAt: block.endAt }],
    },
    requestContext: { phase: 'Turbulência', currentHour: 8, currentMinute: 30 },
  });
  assert.equal(preview.changes[0]?.type, 'shrink');

  await AgendaAdaptationService.apply({
    prisma,
    userId: block.userId,
    dailyContext: {
      ...baseContext,
      pendingTaskTitles: ['Responder cliente'],
      tasks: [{ id: block.id, title: block.title, status: 'planned', category: 'trabalho', intensity: 'P', startAt: block.startAt, endAt: block.endAt }],
    },
    requestContext: { phase: 'Turbulência', currentHour: 8, currentMinute: 30 },
    selectedDecisionIds: [preview.changes[0].id],
  });

  assert.equal(calls.updates[0].data.startAt.toISOString().slice(11, 16), '11:00');
  assert.equal(calls.updates[0].data.endAt.toISOString().slice(11, 16), '11:30');
}

{
  const protectedBlock = {
    id: '77777777-7777-4777-8777-777777777777',
    userId: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Reunião externa',
    localDate: new Date('2026-04-30T00:00:00.000Z'),
    startAt: new Date('2026-04-30T09:00:00.000Z'),
    endAt: new Date('2026-04-30T10:00:00.000Z'),
    category: 'trabalho',
    intensity: 'P',
    status: 'planned',
    gcalEventId: 'legacy-google-event',
    temporalPolicy: 'flexible',
    adaptationPermission: 'eligible',
  };
  const staleContext: DailyContext = {
    ...baseContext,
    pendingTaskTitles: [protectedBlock.title],
    tasks: [{
      id: protectedBlock.id,
      title: protectedBlock.title,
      status: protectedBlock.status,
      category: protectedBlock.category,
      intensity: protectedBlock.intensity,
      startAt: protectedBlock.startAt,
      endAt: protectedBlock.endAt,
      temporalPolicy: 'flexible',
      adaptationPermission: 'eligible',
    }],
  };
  const preview = AgendaAdaptationService.buildPreview({
    dailyContext: staleContext,
    requestContext: { phase: 'Estável', currentHour: 10, currentMinute: 10 },
  });
  assert.equal(preview.changes[0]?.type, 'move');

  const { prisma, calls } = makeMockPrisma([protectedBlock]);
  const result = await AgendaAdaptationService.apply({
    prisma,
    userId: protectedBlock.userId,
    dailyContext: staleContext,
    requestContext: { phase: 'Estável', currentHour: 10, currentMinute: 10 },
    selectedDecisionIds: [preview.changes[0].id],
  });

  assert.equal(calls.updates.length, 0);
  assert.equal(result.appliedChanges.length, 0);
  assert.match(result.skippedChanges[0]?.reason ?? '', /protegido|fixo/i);
}

{
  const block = {
    id: '99999999-9999-4999-8999-999999999999',
    userId: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Bloco que ficou protegido durante o apply',
    localDate: new Date('2026-04-30T00:00:00.000Z'),
    startAt: new Date('2026-04-30T09:00:00.000Z'),
    endAt: new Date('2026-04-30T10:00:00.000Z'),
    category: 'trabalho',
    intensity: 'P',
    status: 'planned',
    gcalEventId: null,
    temporalPolicy: 'flexible',
    adaptationPermission: 'eligible',
  };
  const context: DailyContext = {
    ...baseContext,
    pendingTaskTitles: [block.title],
    tasks: [{
      id: block.id,
      title: block.title,
      status: block.status,
      category: block.category,
      intensity: block.intensity,
      startAt: block.startAt,
      endAt: block.endAt,
      temporalPolicy: 'flexible',
      adaptationPermission: 'eligible',
    }],
  };
  const preview = AgendaAdaptationService.buildPreview({
    dailyContext: context,
    requestContext: { phase: 'Estável', currentHour: 10, currentMinute: 10 },
  });
  assert.equal(preview.changes[0]?.type, 'move');

  const { prisma, calls } = makeMockPrisma([block], { protectAfterRead: true });
  const result = await AgendaAdaptationService.apply({
    prisma,
    userId: block.userId,
    dailyContext: context,
    requestContext: { phase: 'Estável', currentHour: 10, currentMinute: 10 },
    selectedDecisionIds: [preview.changes[0].id],
  });

  assert.equal(calls.updates.length, 0);
  assert.equal(calls.updateManyCalls.length, 1);
  assert.deepEqual(calls.updateManyCalls[0].where, {
    id: block.id,
    userId: block.userId,
    gcalEventId: null,
    temporalPolicy: { not: 'fixed' },
    adaptationPermission: { not: 'protected' },
  });
  assert.equal(result.appliedChanges.length, 0);
  assert.match(result.skippedChanges[0]?.reason ?? '', /protegido|fixo/i);
}

{
  const { prisma, calls } = makeMockPrisma([], { feedbackFails: true });
  const contextWithHabit: DailyContext = {
    ...baseContext,
    tasks: [],
    pendingTaskTitles: [],
    completedTaskTitles: [],
    completedHabitTitles: [],
    pendingHabitTitles: ['Diário'],
    activeGoalTitles: [],
    completedGoalTitles: [],
    completedSubgoalTitles: [],
    recentSuggestionTitles: [],
    blockedActionTitles: [],
    todayAnchorTitles: ['Diário'],
    habits: [{ id: '66666666-6666-4666-8666-666666666666', title: 'Diário', frequency: 'daily', completions: [] }],
  };
  const preview = AgendaAdaptationService.buildPreview({
    dailyContext: contextWithHabit,
    requestContext: { phase: 'Estável', currentHour: 9, currentMinute: 0 },
  });
  assert.equal(preview.changes[0]?.type, 'convert');

  const applied = await AgendaAdaptationService.apply({
    prisma,
    userId: '550e8400-e29b-41d4-a716-446655440000',
    dailyContext: contextWithHabit,
    requestContext: { phase: 'Estável', currentHour: 9, currentMinute: 0 },
    selectedDecisionIds: [preview.changes[0].id],
  });

  assert.equal(calls.creates.length, 1);
  assert.equal(calls.creates[0].title, 'Diário');
  assert.equal(calls.creates[0].category, 'autocuidado');
  assert.equal(calls.creates[0].isAiSuggested, true);
  assert.equal(calls.creates[0].temporalPolicy, 'flexible');
  assert.equal(calls.creates[0].adaptationPermission, 'eligible');
  assert.equal(calls.creates[0].adaptabilitySource, 'ai');
  assert.equal(calls.creates[0].adaptabilityConfidence, 0.9);
  assert.equal(applied.appliedChanges.length, 1);
  assert.equal(applied.skippedChanges.length, 0, 'feedback failure does not undo a confirmed mutation');
}

// Aplicação automática: sem lista de seleção, a Airia aplica sozinha o que é dela.
{
  const { prisma, calls } = makeMockPrisma();
  const contextWithHabit = {
    ...baseContext,
    tasks: [],
    pendingTaskTitles: [],
    completedTaskTitles: [],
    completedHabitTitles: [],
    pendingHabitTitles: ['Diário'],
    activeGoalTitles: [],
    completedGoalTitles: [],
    completedSubgoalTitles: [],
    recentSuggestionTitles: [],
    blockedActionTitles: [],
    todayAnchorTitles: ['Diário'],
    habits: [{ id: '66666666-6666-4666-8666-666666666666', title: 'Diário', frequency: 'daily', completions: [] }],
  };

  const auto = await AgendaAdaptationService.apply({
    prisma,
    userId: '550e8400-e29b-41d4-a716-446655440000',
    dailyContext: contextWithHabit,
    requestContext: { phase: 'Estável', currentHour: 9, currentMinute: 0 },
  });

  assert.equal(auto.appliedChanges.length, 1, 'sem seleção explícita, a Airia aplica sozinha');
  assert.equal(calls.creates.length, 1);
  assert.equal(calls.creates[0].title, 'Diário');
}

// Lista vazia explícita continua significando "não aplique nada".
{
  const { prisma, calls } = makeMockPrisma();
  const contextWithHabit = {
    ...baseContext,
    tasks: [],
    pendingTaskTitles: [],
    completedTaskTitles: [],
    completedHabitTitles: [],
    pendingHabitTitles: ['Diário'],
    activeGoalTitles: [],
    completedGoalTitles: [],
    completedSubgoalTitles: [],
    recentSuggestionTitles: [],
    blockedActionTitles: [],
    todayAnchorTitles: ['Diário'],
    habits: [{ id: '66666666-6666-4666-8666-666666666666', title: 'Diário', frequency: 'daily', completions: [] }],
  };

  const nothing = await AgendaAdaptationService.apply({
    prisma,
    userId: '550e8400-e29b-41d4-a716-446655440000',
    dailyContext: contextWithHabit,
    requestContext: { phase: 'Estável', currentHour: 9, currentMinute: 0 },
    selectedDecisionIds: [],
  });

  assert.equal(nothing.appliedChanges.length, 0);
  assert.equal(calls.creates.length, 0);
}

console.log('agenda-adaptation.service tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
