import assert from 'node:assert/strict';

import { JournalService } from './journal.service';

const userId = '550e8400-e29b-41d4-a716-446655440000';
const activeSession = {
  id: '7a0f7c1e-1f25-4d9a-8b9a-b3d2df6a7d11',
  userId,
  localDate: new Date('2026-03-13T00:00:00.000Z'),
  status: 'active',
  startedAt: new Date('2026-03-13T13:00:00.000Z'),
};

async function run() {
{
  const prisma = {
    journalSession: {
      findFirst: async () => activeSession,
      create: async () => {
        throw new Error('should not create when active session exists');
      },
    },
  };

  const result = await JournalService.startOrResumeSession(prisma as any, userId, new Date('2026-03-13T15:45:00.000Z'));

  assert.equal(result.session.id, activeSession.id);
  assert.equal(result.created, false);
}

{
  let createdPayload: any;

  const prisma = {
    journalSession: {
      findFirst: async () => null,
      create: async ({ data }: any) => {
        createdPayload = data;
        return {
          id: '8b5a2f17-9578-46a1-8d5d-561b8db6ea04',
          ...data,
          startedAt: new Date('2026-03-13T15:45:00.000Z'),
        };
      },
    },
  };

  const result = await JournalService.startOrResumeSession(prisma as any, userId, new Date('2026-03-13T15:45:00.000Z'));

  assert.equal(result.created, true);
  assert.equal(result.session.status, 'active');
  assert.equal(createdPayload.userId, userId);
  assert.equal(createdPayload.localDate.toISOString(), '2026-03-13T00:00:00.000Z');
}

{
  let findManyArgs: any;

  const prisma = {
    journalMessage: {
      findMany: async (args: any) => {
        findManyArgs = args;
        return [
          { id: '1', role: 'user', content: 'Oi', orderIndex: 0, createdAt: new Date('2026-03-13T12:00:00.000Z') },
          { id: '2', role: 'assistant', content: 'Oi, estou aqui.', orderIndex: 1, createdAt: new Date('2026-03-13T12:00:05.000Z') },
        ];
      },
    },
  };

  const result = await JournalService.getSessionMessages(prisma as any, activeSession.id);

  assert.equal(findManyArgs.where.sessionId, activeSession.id);
  assert.deepEqual(findManyArgs.orderBy, { orderIndex: 'asc' });
  assert.equal(result.length, 2);
}

{
  const prisma = {
    onboardingResponse: {
      findUnique: async () => ({
        routineSummary: 'Costuma trabalhar melhor no fim da manhã.',
      }),
    },
    userPreference: {
      findUnique: async () => ({
        wakeTime: '07:30',
        sleepTime: '23:30',
        morningCheckinTime: '08:00',
        eveningReviewTime: '21:30',
      }),
    },
    dailyCheckin: {
      findFirst: async () => ({
        moodScore: 4,
        energyScore: 3,
        stateLabel: 'Dia sensível',
        stateLabelType: 'sensível',
        recordedAt: new Date('2026-03-13T10:00:00.000Z'),
      }),
    },
    journalSession: {
      findMany: async () => ([
        { summary: 'Falou sobre pressão no trabalho.', themes: ['trabalho', 'rotina'] },
        { summary: 'Comentou cansaço no fim do dia.', themes: ['energia'] },
      ]),
    },
    timelineBlock: {
      findMany: async () => ([
        { category: 'trabalho', intensity: 'M', title: 'Reunião de projeto' },
        { category: 'autocuidado', intensity: 'L', title: 'Caminhada curta' },
      ]),
    },
  };

  const result = await JournalService.buildRoutineContext(prisma as any, userId, new Date('2026-03-13T15:45:00.000Z'));

  assert.equal(result.checkinToday?.stateLabel, 'Dia sensível');
  assert.equal(result.preferences?.wakeTime, '07:30');
  assert.equal(result.routineSummary, 'Costuma trabalhar melhor no fim da manhã.');
  assert.equal(result.topThemes[0], 'trabalho');
  assert.equal(result.topPlannerCategories[0], 'trabalho');
  assert.equal(result.recentSummaries[0], 'Falou sobre pressão no trabalho.');
  assert.match(result.promptSummary, /falou sobre pressão no trabalho/i);
  assert.match(result.promptSummary, /fim da manhã/i);
}

{
  const next = JournalService.nextOrderIndex([
    { orderIndex: 0 },
    { orderIndex: 1 },
    { orderIndex: 4 },
  ]);

  assert.equal(next, 5);
}

console.log('journal.service tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
