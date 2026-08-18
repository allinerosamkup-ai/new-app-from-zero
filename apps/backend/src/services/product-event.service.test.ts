import assert from 'node:assert/strict';

import { recordProductEvent, type ProductEventRepository } from './product-event.service';

const userId = '00000000-0000-4000-8000-000000000001';
const eventId = '00000000-0000-4000-8000-000000000002';
const payload = {
  eventId,
  occurredAt: '2026-08-17T20:00:00.000Z',
  surface: 'checkin' as const,
  eventName: 'checkin.opened.v1' as const,
  properties: { entryPoint: 'home' as const, hasPreviousCheckinToday: false },
};

function createRepository(initialCount = 0) {
  const events = new Map<string, unknown>();
  let createCalls = 0;
  const repository: ProductEventRepository = {
    findByEventId: async (nextUserId, nextEventId) => events.get(`${nextUserId}:${nextEventId}`) ?? null,
    countRecent: async () => initialCount,
    create: async (data) => {
      createCalls += 1;
      const record = { id: `event-${createCalls}`, ...data };
      events.set(`${data.userId}:${data.eventId}`, record);
      return record;
    },
  };
  return { repository, getCreateCalls: () => createCalls };
}

async function run() {
  const fixture = createRepository();
  const first = await recordProductEvent(fixture.repository, userId, payload, new Date('2026-08-17T20:01:00.000Z'));
  const second = await recordProductEvent(fixture.repository, userId, payload, new Date('2026-08-17T20:01:01.000Z'));
  assert.equal(first.status, 'created');
  assert.equal(second.status, 'duplicate');
  assert.equal(fixture.getCreateCalls(), 1, 'o mesmo eventId não pode criar uma segunda linha');

  const limited = createRepository(120);
  const rateLimited = await recordProductEvent(limited.repository, userId, {
    ...payload,
    eventId: '00000000-0000-4000-8000-000000000003',
  }, new Date('2026-08-17T20:01:00.000Z'));
  assert.equal(rateLimited.status, 'rate_limited');
  assert.equal(limited.getCreateCalls(), 0);

  console.log('product-event.service tests passed');
}

void run();
