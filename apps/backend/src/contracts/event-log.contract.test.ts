import assert from 'node:assert/strict';

import { EventLogCreateSchema, ProductEventCreateSchema, validateEventLogProperties } from './event-log.contract';

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

const productEvent = {
  eventId: '00000000-0000-4000-8000-000000000001',
  occurredAt: new Date().toISOString(),
  surface: 'checkin' as const,
  eventName: 'checkin.opened.v1' as const,
  properties: { entryPoint: 'home' as const, hasPreviousCheckinToday: false },
};

{
  const result = ProductEventCreateSchema.safeParse(productEvent);
  assert.equal(result.success, true);
}

{
  const result = ProductEventCreateSchema.safeParse({ ...productEvent, eventName: 'checkin.opened' });
  assert.equal(result.success, false, 'nomes desconhecidos ou sem versão devem ser rejeitados');
}

{
  const result = ProductEventCreateSchema.safeParse({
    ...productEvent,
    properties: { ...productEvent.properties, note: 'texto íntimo não permitido' },
  });
  assert.equal(result.success, false, 'texto livre pessoal não deve ser aceito nas propriedades');
}

{
  const result = ProductEventCreateSchema.safeParse({
    ...productEvent,
    occurredAt: '2020-01-01T00:00:00.000Z',
  });
  assert.equal(result.success, false, 'ocorrências fora da janela de retenção não devem ser aceitas');
}

console.log('event-log.contract tests passed');
