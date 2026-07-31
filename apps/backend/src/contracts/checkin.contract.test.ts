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
    userId: validCheckin.userId,
    localDate: validCheckin.localDate,
    moodScore: 3,
    energyScore: 3,
    source: 'aura_text',
    sourceMessageId: 'message-1',
    idempotencyKey: 'session-1:message-1',
    signalMetadata: {
      mood: { provenance: 'inferred', confidence: 0.9, evidence: ['chateada'] },
      energy: { provenance: 'inferred', confidence: 0.95, evidence: ['cansada'] },
    },
  });

  assert.equal(result.success, true, 'sinais opcionais não podem ser inventados para validar o check-in');
}

{
  const result = CheckinCreateSchema.safeParse({
    userId: validCheckin.userId,
    localDate: validCheckin.localDate,
    energyScore: 3,
  });

  assert.equal(result.success, false, 'humor e energia continuam sendo os dois sinais centrais');
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

// Diagnostic-aware optional fields
{
  const result = CheckinCreateSchema.safeParse({
    ...validCheckin,
    medicationTakenToday: true,
    focusScore: 4,
    hyperfocusOccurred: false,
    mixedEpisodeNote: 'energia alta mas humor baixo',
    dayType: 'mixed',
  });
  assert.equal(result.success, true);
}

{
  const result = CheckinCreateSchema.safeParse({
    ...validCheckin,
    focusScore: 11,
  });
  assert.equal(result.success, false);
}

{
  const result = CheckinCreateSchema.safeParse({
    ...validCheckin,
    dayType: 'whatever',
  });
  assert.equal(result.success, false);
}

console.log('checkin.contract tests passed');
