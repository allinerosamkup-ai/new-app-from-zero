import assert from 'node:assert/strict';

import {
  DeletionConfirmError,
  PRIVACY_DELETION_CONSTANTS,
  PRIVACY_DELETION_EVENT_NAMES,
  cancelDeletion,
  confirmDeletion,
  getDeletionStatus,
  requestDeletion,
} from './privacy-delete.service';

type FakeEvent = {
  eventName: string;
  properties: Record<string, unknown>;
  createdAt: Date;
};

function makePrisma(initial: FakeEvent[] = []) {
  const events: FakeEvent[] = [...initial];
  let counter = 0;
  return {
    events,
    eventLog: {
      findFirst: async () => {
        if (events.length === 0) return null;
        // Iterate from newest to oldest based on insertion order — stable
        // and immune to same-millisecond clock collisions in tests.
        return events[events.length - 1];
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        counter += 1;
        events.push({
          eventName: String(data.eventName),
          properties: (data.properties as Record<string, unknown>) ?? {},
          createdAt: new Date(Date.now() + counter),
        });
      },
    },
  };
}

async function testNoneByDefault() {
  const prisma = makePrisma();
  const status = await getDeletionStatus(prisma, 'user-1');
  assert.equal(status.status, 'none');
}

async function testRequestProducesToken() {
  const prisma = makePrisma();
  const status = await requestDeletion(prisma, 'user-1');
  assert.equal(status.status, 'requested');
  if (status.status !== 'requested') return;
  assert.ok(status.token.length >= 16);
  assert.equal(prisma.events.length, 1);
  assert.equal(prisma.events[0].eventName, PRIVACY_DELETION_EVENT_NAMES.requested);
}

async function testRequestIsIdempotent() {
  const prisma = makePrisma();
  const a = await requestDeletion(prisma, 'user-1');
  const b = await requestDeletion(prisma, 'user-1');
  assert.equal(a.status, 'requested');
  assert.equal(b.status, 'requested');
  if (a.status !== 'requested' || b.status !== 'requested') return;
  assert.equal(a.token, b.token);
  assert.equal(prisma.events.length, 1, 'second request must not create a new event');
}

async function testConfirmRequiresMatchingToken() {
  const prisma = makePrisma();
  const requested = await requestDeletion(prisma, 'user-1');
  if (requested.status !== 'requested') throw new Error('precondition');

  await assert.rejects(
    () => confirmDeletion(prisma, 'user-1', 'wrong-token'),
    (err: unknown) => err instanceof DeletionConfirmError && err.code === 'invalid_token',
  );

  const confirmed = await confirmDeletion(prisma, 'user-1', requested.token);
  assert.equal(confirmed.status, 'confirmed');
  if (confirmed.status !== 'confirmed') return;
  assert.ok(confirmed.scheduledFor);

  const eta = new Date(confirmed.scheduledFor).getTime() - Date.now();
  const expected = PRIVACY_DELETION_CONSTANTS.gracePeriodDays * 24 * 60 * 60 * 1000;
  assert.ok(Math.abs(eta - expected) < 5_000, 'scheduledFor must be ~grace period away');
}

async function testConfirmRejectsWithoutRequest() {
  const prisma = makePrisma();
  await assert.rejects(
    () => confirmDeletion(prisma, 'user-1', 'whatever'),
    (err: unknown) => err instanceof DeletionConfirmError && err.code === 'no_request',
  );
}

async function testCancelClearsState() {
  const prisma = makePrisma();
  const requested = await requestDeletion(prisma, 'user-1');
  if (requested.status !== 'requested') throw new Error('precondition');
  await confirmDeletion(prisma, 'user-1', requested.token);

  const cancelled = await cancelDeletion(prisma, 'user-1');
  assert.equal(cancelled.status, 'cancelled');

  const status = await getDeletionStatus(prisma, 'user-1');
  assert.equal(status.status, 'cancelled');
}

async function testExpiredRequestIsTreatedAsNone() {
  const prisma = makePrisma();
  const oldDate = new Date();
  oldDate.setUTCDate(oldDate.getUTCDate() - 2);
  prisma.events.push({
    eventName: PRIVACY_DELETION_EVENT_NAMES.requested,
    properties: {
      token: 'abc',
      confirmDeadline: new Date(oldDate.getTime() + 1000).toISOString(),
    },
    createdAt: oldDate,
  });

  const status = await getDeletionStatus(prisma, 'user-1');
  assert.equal(status.status, 'none');
}

async function run() {
  await testNoneByDefault();
  await testRequestProducesToken();
  await testRequestIsIdempotent();
  await testConfirmRequiresMatchingToken();
  await testConfirmRejectsWithoutRequest();
  await testCancelClearsState();
  await testExpiredRequestIsTreatedAsNone();
  console.log('privacy-delete.service tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
