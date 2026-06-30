import assert from 'node:assert/strict';
import http from 'node:http';

import { createApp } from './index';

async function run() {
  const createdEvents: any[] = [];
  const eventRows = [
    {
      id: 'event-2',
      userId: '550e8400-e29b-41d4-a716-446655440000',
      eventName: 'planner.card_opened',
      properties: { source: 'home' },
      path: '/planner',
      userAgent: 'Mozilla/5.0',
      createdAt: new Date('2026-04-20T11:00:00.000Z'),
    },
    {
      id: 'event-1',
      userId: '550e8400-e29b-41d4-a716-446655440000',
      eventName: 'checkin.saved',
      properties: { slot: 'morning' },
      path: '/checkin',
      userAgent: 'Mozilla/5.0',
      createdAt: new Date('2026-04-20T10:00:00.000Z'),
    },
  ];

  const prisma = {
    $queryRaw: async () => [],
    $executeRaw: async () => ({}),
    eventLog: {
      create: async ({ data }: any) => {
        createdEvents.push(data);
        return { id: 'event-created', createdAt: new Date(), ...data };
      },
      findMany: async ({ where, take, orderBy }: any) => {
        assert.equal(where.userId, '550e8400-e29b-41d4-a716-446655440000');
        assert.equal(take, 2);
        assert.deepEqual(orderBy, [{ createdAt: 'desc' }]);
        return eventRows.slice(0, take);
      },
    },
  };

  const app = createApp({
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
    const createResponse = await fetch(`${baseUrl}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
      body: JSON.stringify({
        eventName: 'planner.card_opened',
        properties: { source: 'home' },
        path: '/planner',
      }),
    });

    assert.equal(createResponse.status, 201);
    const createBody = await createResponse.json();
    assert.equal(createBody.eventName, 'planner.card_opened');
    assert.equal(createdEvents[0].userId, '550e8400-e29b-41d4-a716-446655440000');
    assert.equal(createdEvents[0].userAgent, 'Mozilla/5.0');

    const listResponse = await fetch(`${baseUrl}/api/events?limit=2`);
    assert.equal(listResponse.status, 200);
    const listBody = await listResponse.json();
    assert.equal(listBody.events.length, 2);
    assert.equal(listBody.events[0].eventName, 'planner.card_opened');
    assert.equal(listBody.events[1].eventName, 'checkin.saved');
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
    console.log('index.event-log tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
