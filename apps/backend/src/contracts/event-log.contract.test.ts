import assert from 'node:assert/strict';

import { EventLogCreateSchema, validateEventLogProperties } from './event-log.contract';

const validPayload = {
  eventName: 'planner.card_opened',
  properties: {
    source: 'home',
    count: 2,
    nested: {
      variant: 'compact',
    },
  },
  path: '/planner',
};

{
  const result = EventLogCreateSchema.safeParse(validPayload);

  assert.equal(result.success, true);
}

{
  const result = EventLogCreateSchema.safeParse({
    ...validPayload,
    properties: {
      ...validPayload.properties,
      email: 'alline@example.com',
    },
  });

  assert.equal(result.success, false);
}

{
  const result = EventLogCreateSchema.safeParse({
    ...validPayload,
    properties: {
      ...validPayload.properties,
      profileName: 'Alline Silva',
    },
  });

  assert.equal(result.success, false);
}

{
  const result = validateEventLogProperties({
    path: '/account',
    referrer: 'https://example.com',
    labels: ['home', 'planner'],
  });

  assert.equal(result.success, true);
}

console.log('event-log.contract tests passed');
