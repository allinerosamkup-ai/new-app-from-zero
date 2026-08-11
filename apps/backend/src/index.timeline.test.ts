import assert from 'node:assert/strict';
import http from 'node:http';

import { createApp } from './index';

async function run() {
  const createdBlocks: any[] = [];
  const upsertedBlocks: any[] = [];
  let existingBlocks: any[] = [];
  const storedBlocks = new Map<string, any>();

  const prisma = {
    $queryRaw: async () => [],
    $executeRaw: async () => ({}),
    $transaction: async (operations: Promise<unknown>[] | ((tx: any) => Promise<unknown>)) =>
      typeof operations === 'function' ? operations(prisma) : Promise.all(operations),
    timelineBlock: {
      findMany: async () => existingBlocks,
      deleteMany: async () => ({ count: 0 }),
      create: async ({ data }: any) => {
        const created = {
          id: `11111111-1111-4111-8111-${String(createdBlocks.length + 1).padStart(12, '0')}`,
          ...data,
        };
        createdBlocks.push(created);
        storedBlocks.set(created.id, created);
        return created;
      },
      upsert: async ({ where, update, create }: any) => {
        const previous = storedBlocks.get(where.id);
        const persistedUpdate = Object.fromEntries(
          Object.entries(update).filter(([, value]) => value !== undefined),
        );
        const upserted = previous
          ? { ...previous, ...persistedUpdate, id: where.id }
          : { ...create, id: where.id };
        upsertedBlocks.push(upserted);
        storedBlocks.set(where.id, upserted);
        return upserted;
      },
    },
  };

  const app = createApp({
    capabilities: { planner: true, habits: false, connectedCalendar: false },
    prisma: prisma as any,
    authMiddleware: (req: any, _res: any, next: any) => {
      req.userId = '550e8400-e29b-41d4-a716-446655440000';
      next();
    },
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('failed to open test server');
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const createResponse = await fetch(`${baseUrl}/api/timeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: '2026-04-06',
        forceSave: true,
        blocks: [
          {
            title: 'Consulta médica',
            startTime: '14:30',
            endTime: '15:00',
            category: 'pessoal',
            intensity: 'P',
            status: 'planned',
          },
        ],
      }),
    });

    assert.equal(createResponse.status, 200);
    assert.equal(createdBlocks.length, 1);
    assert.equal(createdBlocks[0].title, 'Consulta médica');
    assert.equal(createdBlocks[0].intensity, 'P');
    assert.equal(createdBlocks[0].status, 'planned');
    assert.equal(createdBlocks[0].temporalPolicy, 'windowed');
    assert.equal(createdBlocks[0].adaptationPermission, 'preview');
    assert.equal(createdBlocks[0].adaptabilitySource, 'language');
    assert.equal(createdBlocks[0].adaptabilityConfidence, 0.68);

    const updateResponse = await fetch(`${baseUrl}/api/timeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: '2026-04-06',
        forceSave: true,
        blocks: [
          {
            id: '22222222-2222-4222-8222-222222222222',
            title: 'Consulta médica',
            startTime: '14:30',
            endTime: '15:00',
            category: 'pessoal',
            intensity: 'P',
            status: 'completed',
          },
        ],
      }),
    });

    assert.equal(updateResponse.status, 200);
    assert.equal(upsertedBlocks.length, 1);
    assert.equal(upsertedBlocks[0].id, '22222222-2222-4222-8222-222222222222');
    assert.equal(upsertedBlocks[0].status, 'completed');

    const metadataCreateResponse = await fetch(`${baseUrl}/api/timeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: '2026-04-06',
        forceSave: true,
        blocks: [
          {
            title: 'Preparar consulta',
            startTime: '16:00',
            endTime: '16:30',
            category: 'pessoal',
            intensity: 'M',
            status: 'planned',
            noteMode: 'checklist',
            note: 'Levar exames anteriores.',
            checklist: [{ id: 'item-1', text: 'Separar exames', done: false }],
            recurring: { enabled: true, frequency: 'weekly', days: [0, 2], everyNDays: 1 },
            energyLevel: 'leve',
            lastResetDate: '2026-04-05',
            persistentReminderEnabled: true,
            persistentReminderIntervalMinutes: 60,
            isAiSuggested: true,
            aiReasoning: 'Sugerido pela Airia.',
            gcalEventId: 'google-event-protected',
            temporalPolicy: 'flexible',
            adaptationPermission: 'eligible',
          },
        ],
      }),
    });

    assert.equal(metadataCreateResponse.status, 200);
    assert.equal(createdBlocks.length, 2);
    assert.equal(createdBlocks[1].noteMode, 'checklist');
    assert.equal(createdBlocks[1].note, 'Levar exames anteriores.');
    assert.deepEqual(createdBlocks[1].checklist, [{ id: 'item-1', text: 'Separar exames', done: false }]);
    assert.equal(createdBlocks[1].recurring.frequency, 'weekly');
    assert.equal(createdBlocks[1].energyLevel, 'leve');
    assert.equal(createdBlocks[1].lastResetDate.toISOString(), '2026-04-05T00:00:00.000Z');
    assert.equal(createdBlocks[1].persistentReminderEnabled, true);
    assert.equal(createdBlocks[1].persistentReminderIntervalMinutes, 60);
    assert.equal(createdBlocks[1].isAiSuggested, true);
    assert.equal(createdBlocks[1].aiReasoning, 'Sugerido pela Airia.');
    assert.equal(createdBlocks[1].temporalPolicy, 'fixed');
    assert.equal(createdBlocks[1].adaptationPermission, 'protected');
    assert.equal(createdBlocks[1].adaptabilitySource, 'gcal');
    assert.equal(createdBlocks[1].adaptabilityConfidence, 1);

    const metadataBlockId = '44444444-4444-4444-8444-444444444444';
    const metadataUpsertResponse = await fetch(`${baseUrl}/api/timeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: '2026-04-06',
        forceSave: true,
        blocks: [
          {
            id: metadataBlockId,
            title: 'Bloco com nota',
            startTime: '17:00',
            endTime: '17:30',
            category: 'pessoal',
            intensity: 'M',
            status: 'planned',
            noteMode: 'text',
            note: 'Nota que nao pode sumir.',
            checklist: [],
            recurring: { enabled: false, frequency: 'daily', days: [], everyNDays: 1 },
            energyLevel: 'media',
          },
        ],
      }),
    });

    assert.equal(metadataUpsertResponse.status, 200);

    const partialUpdateResponse = await fetch(`${baseUrl}/api/timeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: '2026-04-06',
        forceSave: true,
        blocks: [
          {
            id: metadataBlockId,
            title: 'Bloco com nota',
            startTime: '18:00',
            endTime: '18:30',
            category: 'pessoal',
            intensity: 'M',
            status: 'completed',
          },
        ],
      }),
    });

    const partialUpdateBody = await partialUpdateResponse.json();
    assert.equal(partialUpdateResponse.status, 200);
    assert.equal(partialUpdateBody.savedBlocks[0].status, 'completed');
    assert.equal(partialUpdateBody.savedBlocks[0].note, 'Nota que nao pode sumir.');
    assert.equal(partialUpdateBody.savedBlocks[0].noteMode, 'text');

    const protectedBlockId = '88888888-8888-4888-8888-888888888888';
    const protectedCreateResponse = await fetch(`${baseUrl}/api/timeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: '2026-04-06',
        forceSave: true,
        blocks: [{
          id: protectedBlockId,
          title: 'Âncora protegida',
          startTime: '19:00',
          endTime: '19:30',
          category: 'trabalho',
          intensity: 'M',
          status: 'planned',
          temporalPolicy: 'fixed',
          adaptationPermission: 'protected',
          adaptabilitySource: 'manual',
          adaptabilityConfidence: 1,
        }],
      }),
    });
    assert.equal(protectedCreateResponse.status, 200);

    const protectedPartialUpdateResponse = await fetch(`${baseUrl}/api/timeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: '2026-04-06',
        forceSave: true,
        blocks: [{
          id: protectedBlockId,
          title: 'Âncora protegida renomeada',
          startTime: '19:00',
          endTime: '19:30',
          category: 'trabalho',
          intensity: 'M',
          status: 'planned',
        }],
      }),
    });
    const protectedPartialUpdateBody = await protectedPartialUpdateResponse.json();
    assert.equal(protectedPartialUpdateResponse.status, 200);
    assert.equal(protectedPartialUpdateBody.savedBlocks[0].temporalPolicy, 'fixed');
    assert.equal(protectedPartialUpdateBody.savedBlocks[0].adaptationPermission, 'protected');
    assert.equal(protectedPartialUpdateBody.savedBlocks[0].adaptabilitySource, 'manual');
    assert.equal(protectedPartialUpdateBody.savedBlocks[0].adaptabilityConfidence, 1);

    const explicitAdaptabilityUpdateResponse = await fetch(`${baseUrl}/api/timeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: '2026-04-06',
        forceSave: true,
        blocks: [{
          id: protectedBlockId,
          title: 'Âncora com janela',
          startTime: '19:00',
          endTime: '19:30',
          category: 'trabalho',
          intensity: 'M',
          status: 'planned',
          temporalPolicy: 'windowed',
          adaptationPermission: 'preview',
        }],
      }),
    });
    const explicitAdaptabilityUpdateBody = await explicitAdaptabilityUpdateResponse.json();
    assert.equal(explicitAdaptabilityUpdateResponse.status, 200);
    assert.equal(explicitAdaptabilityUpdateBody.savedBlocks[0].temporalPolicy, 'windowed');
    assert.equal(explicitAdaptabilityUpdateBody.savedBlocks[0].adaptationPermission, 'preview');

    existingBlocks = [
      {
        id: '33333333-3333-4333-8333-333333333333',
        title: 'Bloco existente',
        startAt: new Date('2026-04-06T10:00:00.000Z'),
        endAt: new Date('2026-04-06T11:00:00.000Z'),
      },
    ];

    const conflictResponse = await fetch(`${baseUrl}/api/timeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: '2026-04-06',
        forceSave: false,
        blocks: [
          {
            title: 'Sugestão da Airia',
            startTime: '10:30',
            endTime: '11:30',
            category: 'autocuidado',
            intensity: 'L',
            status: 'planned',
          },
        ],
      }),
    });

    const conflictBody = await conflictResponse.json();
    assert.equal(conflictResponse.status, 409);
    assert.match(conflictBody.error, /Conflitos de horário/);
    assert.equal(createdBlocks.length, 2);

    existingBlocks = [
      {
        id: '55555555-5555-4555-8555-555555555555',
        title: 'Bloco retornado',
        startAt: new Date('2026-04-06T08:00:00.000Z'),
        endAt: new Date('2026-04-06T08:30:00.000Z'),
        category: 'autocuidado',
        intensity: 'L',
        status: 'planned',
        isAiSuggested: true,
        noteMode: 'checklist',
        note: 'Respirar antes de abrir mensagens.',
        checklist: [{ id: 'item-1', text: 'Respirar 3 vezes', done: true }],
        recurring: { enabled: true, frequency: 'daily', days: [], everyNDays: 1 },
        energyLevel: 'leve',
        lastResetDate: new Date('2026-04-05T00:00:00.000Z'),
        persistentReminderEnabled: true,
        persistentReminderIntervalMinutes: 120,
        gcalEventId: 'legacy-google-event',
        temporalPolicy: 'flexible',
        adaptationPermission: 'eligible',
      },
    ];

    const getResponse = await fetch(`${baseUrl}/api/timeline/2026-04-06`);
    const getBody = await getResponse.json();
    assert.equal(getResponse.status, 200);
    assert.equal(getBody[0].noteMode, 'checklist');
    assert.equal(getBody[0].note, 'Respirar antes de abrir mensagens.');
    assert.equal(getBody[0].checklist[0].done, true);
    assert.equal(getBody[0].recurring.frequency, 'daily');
    assert.equal(getBody[0].energyLevel, 'leve');
    assert.equal(getBody[0].lastResetDate, '2026-04-05');
    assert.equal(getBody[0].persistentReminderEnabled, true);
    assert.equal(getBody[0].persistentReminderIntervalMinutes, 120);
    assert.equal(getBody[0].temporalPolicy, 'fixed');
    assert.equal(getBody[0].adaptationPermission, 'protected');
    assert.equal(getBody[0].adaptabilitySource, 'gcal');
    assert.equal(getBody[0].adaptabilityConfidence, 1);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

run()
  .then(() => {
    console.log('index.timeline tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
