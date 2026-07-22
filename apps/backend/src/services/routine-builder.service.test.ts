import assert from 'node:assert/strict';

import { RoutineBuilderService } from './routine-builder.service';

async function run(): Promise<void> {
  let session: any = null;
  const prisma = {
    routineBuildSession: {
      create: async ({ data }: any) => { session = { id: 'session-1', ...data, questions: [], answers: [], items: [], draftPlan: null, applyResult: null }; return session; },
      findFirst: async ({ where }: any) => session && session.id === where.id && session.userId === where.userId ? session : null,
      update: async ({ data }: any) => { Object.assign(session, data); return session; },
      updateMany: async ({ data }: any) => { Object.assign(session, data); return { count: 1 }; },
    },
    objective: { findMany: async () => [{ title: 'Meta existente' }] },
    habit: {
      findMany: async () => [{ id: 'habit-existing', title: 'Tomar suplemento', frequency: 'weekly', targetDays: [1, 3, 5], durationMinutes: 5 }],
    },
    timelineBlock: {
      findMany: async () => [{ id: 'fixed-1', title: 'Consulta', localDate: new Date('2026-07-28T00:00:00.000Z'), startAt: new Date('2026-07-28T10:00:00.000Z'), endAt: new Date('2026-07-28T11:00:00.000Z'), temporalPolicy: 'fixed', adaptationPermission: 'protected' }],
    },
    dailyCheckin: { findFirst: async () => ({ energyScore: 2, moodScore: 4, recordedAt: new Date() }) },
    onboardingResponse: { findUnique: async () => ({ aiProfilePayload: {} }) },
    eventLog: { create: async () => ({ id: 'event-1' }) },
  };
  const extractor = {
    extract: async () => ({ text: 'Preciso embalar os livros.', mimeType: 'text/plain', fileName: null, sha256: 'a'.repeat(64), bytes: 30, originalCharacters: 30, truncated: false }),
  };
  const classifier = {
    classify: async () => ({ items: [{ id: 'source-1', kind: 'task', title: 'Embalar os livros', sourceExcerpt: 'Preciso embalar os livros', confidence: 0.95, reviewState: 'pending', isFixed: false }] }),
  };
  const applyService = { apply: async () => ({ sessionId: 'session-1', counts: { objectives: 0, habits: 0, timelineBlocks: 1 }, ids: { objectives: [], habits: [], timelineBlocks: ['block-1'] } }) };
  const service = new RoutineBuilderService(prisma as any, { extractor: extractor as any, classifier: classifier as any, applyService: applyService as any });

  const created = await service.createSession('user-1', {
    focus: 'Organizar a mudança', weekStart: '2026-07-27', timezone: 'America/Sao_Paulo', locale: 'pt-BR',
    limits: { wakeTime: '08:00', sleepTime: '22:00', maxDailyLoadMinutes: 360, unavailable: [] },
  });
  assert.equal(created.status, 'draft');

  const classified = await service.ingestSource({ userId: 'user-1', sessionId: 'session-1', buffer: Buffer.from('fonte'), mimeType: 'text/plain', sourceType: 'text' });
  assert.equal(classified.status, 'classified');
  assert.equal(classified.sourceText, undefined, 'raw source must never leave the service');

  const reviewed = await service.updateItems({ userId: 'user-1', sessionId: 'session-1', items: [{ ...classified.items[0], reviewState: 'confirmed' }] });
  assert.equal(reviewed.status, 'ready');

  const composed = await service.compose('user-1', 'session-1');
  assert.equal(composed.draftPlan.capacity.level, 'low');
  assert.equal(composed.draftPlan.entries.some((entry: any) => entry.sourceItemId === 'source-1'), true);
  assert.deepEqual(
    composed.draftPlan.entries.filter((entry: any) => entry.id.startsWith('existing-habit:')).map((entry: any) => entry.date),
    ['2026-07-27', '2026-07-29', '2026-07-31'],
  );

  await assert.rejects(() => service.getSession('user-2', 'session-1'), /routine_session_not_found/);
  assert.deepEqual(await service.apply('user-1', 'session-1'), await applyService.apply());
  assert.equal(await service.purgeExpiredSources(new Date('2026-07-22T20:00:00.000Z')), 1);
  assert.equal(session.sourceText, null);
}

void run().then(() => console.log('routine-builder.service tests passed'));
