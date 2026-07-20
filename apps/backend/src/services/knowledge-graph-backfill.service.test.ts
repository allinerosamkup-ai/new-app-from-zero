import assert from 'node:assert/strict';

import { KnowledgeGraphBackfillService } from './knowledge-graph-backfill.service';

async function run() {
  const memories: any[] = [];
  const evidence: any[] = [];
  const projections: any[] = [];
  const db: any = {
    eventLog: {
      findFirst: async () => null,
      create: async () => ({}),
    },
    journalMessage: {
      findMany: async () => [
        { id: 'message-1', sessionId: 'session-1', role: 'user', content: 'Eu trabalho melhor depois das dez.', orderIndex: 1, createdAt: new Date('2026-07-01T10:00:00Z') },
        { id: 'message-2', sessionId: 'session-1', role: 'assistant', content: 'Entendi.', orderIndex: 2, createdAt: new Date('2026-07-01T10:01:00Z') },
      ],
    },
    dailyCheckin: {
      findMany: async () => [{ id: 'checkin-1', note: 'Minha energia melhora no fim da manhã.', recordedAt: new Date('2026-07-02T10:00:00Z') }],
    },
    userMemory: {
      findFirst: async ({ where }: any) => memories.find((memory) => memory.canonicalKey === where.canonicalKey && memory.lifecycle === 'active') ?? null,
      create: async ({ data }: any) => { const memory = { id: `memory-${memories.length + 1}`, ...data }; memories.push(memory); return memory; },
      update: async ({ where, data }: any) => { const memory = memories.find((item) => item.id === where.id); Object.assign(memory, data); return memory; },
    },
    userMemoryEvidence: {
      findFirst: async ({ where }: any) => evidence.find((item) => item.memoryId === where.memoryId && item.hash === where.hash) ?? null,
      create: async ({ data }: any) => { evidence.push(data); return data; },
      findMany: async ({ where }: any) => evidence.filter((item) => item.memoryId === where.memoryId),
    },
  };

  KnowledgeGraphBackfillService.configureForTests({
    prisma: db,
    memoryService: {
      retrieve: async () => [],
      store: async (input: any) => { projections.push(input); },
    } as any,
    extractFromMessage: async (userId: string, message: string, options: any) => {
      await options.canonicalMemoryService.write({
        userId,
        kind: 'fact',
        scope: options.source,
        canonicalKey: `${options.source}.backfill`,
        content: message,
        source: options.source,
        sourceId: `${options.source}-source-1`,
      });
      return { extracted: null, saved: true };
    },
  });

  try {
    const result = await KnowledgeGraphBackfillService.runForUser('user-1', { forceFromScratch: true });
    assert.equal(result.sessionsProcessed, 1);
    assert.equal(result.checkinsProcessed, 1);
    assert.equal(projections.length, 2);
    assert.ok(projections.every((projection) => projection.memoryId && projection.contentId === `canonical:${projection.memoryId}`));
  } finally {
    KnowledgeGraphBackfillService.configureForTests(null);
  }

  let cursorEvent: any = {
    properties: { lastMessageId: 'uuid-z' },
    createdAt: new Date('2026-07-01T10:30:00Z'),
  };
  const processed: string[] = [];
  const cursorMessages = [
    { id: 'uuid-z', sessionId: 'session-old', role: 'user', content: 'first by timestamp', orderIndex: 1, createdAt: new Date('2026-07-01T10:00:00Z') },
    { id: 'uuid-b', sessionId: 'session-new', role: 'user', content: 'second session first message', orderIndex: 1, createdAt: new Date('2026-07-01T11:00:00Z') },
    { id: 'uuid-a', sessionId: 'session-new', role: 'user', content: 'second session lower uuid later in time', orderIndex: 2, createdAt: new Date('2026-07-01T12:00:00Z') },
  ];
  const cursorDb: any = {
    eventLog: {
      findFirst: async () => cursorEvent,
      create: async ({ data }: any) => { cursorEvent = { properties: data.properties, createdAt: new Date() }; return cursorEvent; },
    },
    journalMessage: {
      findUnique: async ({ where }: any) => cursorMessages.find((message) => message.id === where.id) ?? null,
      findMany: async ({ where, take }: any) => {
      const cursorAt = where.OR?.[0]?.createdAt?.gt as Date | undefined;
      const cursorId = where.OR?.[1]?.id?.gt as string | undefined;
      const legacyId = where.id?.gt as string | undefined;
      return cursorMessages
        .filter((message) => (!legacyId || message.id > legacyId)
          && (!cursorAt || message.createdAt > cursorAt || (message.createdAt.getTime() === cursorAt.getTime() && message.id > (cursorId ?? ''))))
        .slice(0, take);
      },
    },
    dailyCheckin: { findMany: async () => [] },
  };
  KnowledgeGraphBackfillService.configureForTests({
    prisma: cursorDb,
    canonicalMemoryService: { write: async () => ({ accepted: true, evidenceCreated: true }) } as any,
    memoryService: { retrieve: async () => [], store: async () => {} } as any,
    extractFromMessage: async (_userId, message) => { processed.push(message); return { extracted: null, saved: true }; },
  });
  try {
    await KnowledgeGraphBackfillService.runForUser('user-cursor', { limit: 1 });
    await KnowledgeGraphBackfillService.runForUser('user-cursor', { limit: 1 });
    assert.deepEqual(processed, ['second session first message', 'second session lower uuid later in time'], 'legacy UUID cursors are upgraded to timestamp/id pagination across sessions and messages');
  } finally {
    KnowledgeGraphBackfillService.configureForTests(null);
  }

  let orphanCursorEvent: any = {
    properties: { lastMessageId: 'deleted-message-z', lastCheckinId: 'deleted-checkin-z' },
    createdAt: new Date('2026-07-01T10:30:00Z'),
  };
  const orphanProcessed: string[] = [];
  const orphanMessages = [
    { id: 'message-a', sessionId: 'session-a', role: 'user', content: 'Mensagem historica ainda nao processada.', createdAt: new Date('2026-06-01T10:00:00Z') },
  ];
  const orphanCheckins = [
    { id: 'checkin-a', note: 'Nota historica ainda nao processada.', recordedAt: new Date('2026-06-02T10:00:00Z') },
  ];
  const orphanDb: any = {
    eventLog: {
      findFirst: async () => orphanCursorEvent,
      create: async ({ data }: any) => { orphanCursorEvent = { properties: data.properties, createdAt: new Date() }; return orphanCursorEvent; },
    },
    journalMessage: {
      findUnique: async () => null,
      findMany: async ({ where }: any) => orphanMessages.filter((message) => !where.id?.gt || message.id > where.id.gt),
    },
    dailyCheckin: {
      findUnique: async () => null,
      findMany: async ({ where }: any) => orphanCheckins.filter((checkin) => !where.id?.gt || checkin.id > where.id.gt),
    },
  };
  KnowledgeGraphBackfillService.configureForTests({
    prisma: orphanDb,
    canonicalMemoryService: { write: async () => ({ accepted: true, evidenceCreated: true }) } as any,
    memoryService: { retrieve: async () => [], store: async () => {} } as any,
    extractFromMessage: async (_userId, message) => { orphanProcessed.push(message); return { extracted: null, saved: true }; },
  });
  try {
    await KnowledgeGraphBackfillService.runForUser('user-orphan', { limit: 4 });
    assert.deepEqual(orphanProcessed, [
      'Mensagem historica ainda nao processada.',
      'Nota historica ainda nao processada.',
    ], 'an orphaned UUID-only cursor safely restarts idempotent backfill instead of lexically skipping records');
  } finally {
    KnowledgeGraphBackfillService.configureForTests(null);
  }

  let shortNoteCursorEvent: any = null;
  const shortNoteProcessed: string[] = [];
  const shortNoteCheckins = [
    { id: 'checkin-short-a', note: 'ok', recordedAt: new Date('2026-07-01T08:00:00Z') },
    { id: 'checkin-short-b', note: 'sem nota', recordedAt: new Date('2026-07-01T09:00:00Z') },
    { id: 'checkin-valid-c', note: 'Minha energia melhora depois de caminhar.', recordedAt: new Date('2026-07-01T10:00:00Z') },
  ];
  const shortNoteDb: any = {
    eventLog: {
      findFirst: async () => shortNoteCursorEvent,
      create: async ({ data }: any) => {
        shortNoteCursorEvent = { properties: data.properties, createdAt: new Date() };
        return shortNoteCursorEvent;
      },
    },
    journalMessage: { findMany: async () => [] },
    dailyCheckin: {
      findMany: async ({ where, take }: any) => {
        const cursorAt = where.OR?.[0]?.recordedAt?.gt as Date | undefined;
        const cursorId = where.OR?.[1]?.id?.gt as string | undefined;
        return shortNoteCheckins
          .filter((checkin) => !cursorAt || checkin.recordedAt > cursorAt
            || (checkin.recordedAt.getTime() === cursorAt.getTime() && checkin.id > (cursorId ?? '')))
          .slice(0, take);
      },
    },
  };
  KnowledgeGraphBackfillService.configureForTests({
    prisma: shortNoteDb,
    canonicalMemoryService: { write: async () => ({ accepted: true, evidenceCreated: true }) } as any,
    memoryService: { retrieve: async () => [], store: async () => {} } as any,
    extractFromMessage: async (_userId, message) => { shortNoteProcessed.push(message); return { extracted: null, saved: true }; },
  });
  try {
    await KnowledgeGraphBackfillService.runForUser('user-short-notes', { limit: 8 });
    assert.equal(shortNoteCursorEvent?.properties.lastCheckinId, 'checkin-short-b', 'cursor advances across every inspected short note in a saturated batch');
    await KnowledgeGraphBackfillService.runForUser('user-short-notes', { limit: 8 });
    assert.deepEqual(shortNoteProcessed, ['Minha energia melhora depois de caminhar.'], 'a valid note after a saturated batch of ignored notes is reached exactly once');
  } finally {
    KnowledgeGraphBackfillService.configureForTests(null);
  }
}

run().then(() => console.log('knowledge-graph-backfill.service tests passed')).catch((error) => { console.error(error); process.exit(1); });
