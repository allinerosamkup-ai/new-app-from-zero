import assert from 'node:assert/strict';

import request from 'supertest';

import { createApp } from './index';

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const EVENT_ID = '550e8400-e29b-41d4-a716-446655440001';

function eventPayload(eventId = EVENT_ID) {
  return {
    eventId,
    occurredAt: new Date().toISOString(),
    eventName: 'home.opened.v1',
    surface: 'home',
    path: '/home',
    properties: { hasCheckinToday: false, evidenceBand: 'limited' },
  };
}

async function run() {
  const records = new Map<string, Record<string, unknown>>();
  let recentCount = 0;
  const prisma = {
    eventLog: {
      findFirst: async ({ where }: { where: { eventId: string } }) => records.get(where.eventId) ?? null,
      count: async () => recentCount,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        records.set(String(data.eventId), data);
        return data;
      },
    },
  };
  const authenticatedApp = createApp({
    prisma: prisma as any,
    authMiddleware: (req, _res, next) => { (req as any).userId = USER_ID; next(); },
  });

  const created = await request(authenticatedApp).post('/api/events/product').send(eventPayload()).expect(201);
  assert.equal(created.body.duplicate, false);
  assert.equal(records.size, 1);

  const duplicate = await request(authenticatedApp).post('/api/events/product').send(eventPayload()).expect(200);
  assert.equal(duplicate.body.duplicate, true);
  assert.equal(records.size, 1, 'the same idempotency key cannot create a second event');

  await request(authenticatedApp)
    .post('/api/events/product')
    .send({ ...eventPayload('550e8400-e29b-41d4-a716-446655440002'), properties: { note: 'conteúdo íntimo' } })
    .expect(400);

  recentCount = 120;
  await request(authenticatedApp)
    .post('/api/events/product')
    .send(eventPayload('550e8400-e29b-41d4-a716-446655440003'))
    .expect(429);

  const anonymousApp = createApp({
    prisma: prisma as any,
    authMiddleware: (_req, res) => res.status(401).json({ error: 'Unauthorized' }),
  });
  await request(anonymousApp).post('/api/events/product').send(eventPayload()).expect(401);

  console.log('product-events HTTP route tests passed');
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
