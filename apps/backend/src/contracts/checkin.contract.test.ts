import assert from 'node:assert/strict';

import { CheckinCreateSchema, CheckinResponseSchema } from './checkin.contract';

const validCheckin = {
  userId: '550e8400-e29b-41d4-a716-446655440000',
  localDate: '2026-03-13',
  moodScore: 4,
  energyScore: 5,
  clarityScore: 5,
  irritabilityScore: 2,
  physicalScore: 5,
  socialScore: 5,
  note: 'Acordei melhor hoje.',
};

{
  const result = CheckinCreateSchema.safeParse(validCheckin);

  assert.equal(result.success, true);
}

{
  const result = CheckinCreateSchema.safeParse({
    ...validCheckin,
    checkinSlot: 'midday',
  });

  assert.equal(result.success, true);
}

{
  const result = CheckinCreateSchema.safeParse({
    ...validCheckin,
    energyScore: 11,
  });

  assert.equal(result.success, false);
}

{
  const result = CheckinCreateSchema.safeParse({
    ...validCheckin,
    physicalScore: 11,
  });

  assert.equal(result.success, false);
}

{
  const result = CheckinCreateSchema.safeParse({
    ...validCheckin,
    socialScore: 11,
  });

  assert.equal(result.success, false);
}

{
  const result = CheckinResponseSchema.safeParse({
    id: validCheckin.userId,
    stateLabel: 'queda de energia',
    riskSafety: {
      riskLevel: 'low',
      signals: ['sono muito baixo'],
      route: 'adapt_day',
      message: 'A Airia pode oferecer autoapoio pratico e adaptacao leve do dia.',
    },
  });

  assert.equal(result.success, true);
}

console.log('checkin.contract tests passed');
